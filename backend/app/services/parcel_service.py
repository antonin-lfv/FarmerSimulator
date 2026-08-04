from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Action, ActionRequirement, Catalog, Parcel, TypeSurface, Worker
from app.services import calendar_service, catalog_service, wallet_service

# Weather -> the "accessoires" subcategory that discounts protection cost when
# owned (see catalog items 42/43: Brasero anti-gel / Système d'irrigation).
PROTECTION_EQUIPMENT_SUBCATEGORY = {
    "gel": "protection gel",
    "canicule": "protection canicule",
}


def _owns_protection_equipment(db: Session, weather: str) -> bool:
    subcategory = PROTECTION_EQUIPMENT_SUBCATEGORY.get(weather)
    if subcategory is None:
        return False
    items = db.execute(
        select(Catalog).where(Catalog.category == "accessoires", Catalog.subcategory == subcategory)
    ).scalars().all()
    return any(catalog_service.owned_amount(db, item.item_id, "accessoires") > 0 for item in items)


def _parcel_dict(db: Session, parcel: Parcel) -> dict:
    type_surface = db.get(TypeSurface, parcel.type_surface_id)
    today = calendar_service.current_day_index(db)
    planted_seed = (
        db.get(Catalog, parcel.planted_seed_item_id) if parcel.planted_seed_item_id else None
    )
    required_days = calendar_service.required_growth_days(
        parcel.parcel_next_action, parcel.planted_seed_item_id
    )
    growth_progress_percent = (
        min(100.0, (parcel.growth_progress / required_days) * 100) if required_days else None
    )
    return {
        "parcel_id": parcel.parcel_id,
        "superficie": parcel.superficie,
        "type_surface": type_surface.type_surface if type_surface else "",
        "prix": parcel.prix,
        "is_purchased": parcel.is_purchased,
        "parcel_next_action": parcel.parcel_next_action,
        "yield_health": parcel.yield_health,
        "fertilized": parcel.fertilized,
        "storage_level": parcel.storage_level,
        "protected_today": parcel.protected_until_day == today,
        "planted_seed_name": planted_seed.name if planted_seed else None,
        "growth_progress_percent": growth_progress_percent,
    }


def list_parcels(db: Session) -> list[dict]:
    parcels = db.execute(select(Parcel).order_by(Parcel.parcel_id)).scalars().all()
    return [_parcel_dict(db, parcel) for parcel in parcels]


def get_parcel(db: Session, parcel_id: int) -> Parcel | None:
    return db.get(Parcel, parcel_id)


def get_possible_actions(db: Session, parcel: Parcel) -> list[dict]:
    if not parcel.parcel_next_action:
        return []

    action = db.execute(
        select(Action).where(
            Action.type_surface_id == parcel.type_surface_id,
            Action.action_type == parcel.parcel_next_action,
        )
    ).scalar_one_or_none()
    if action is None:
        return []

    requirements = db.execute(
        select(ActionRequirement).where(ActionRequirement.action_id == action.action_id)
    ).scalars().all()

    return [
        {
            "action_id": action.action_id,
            "action_type": action.action_type,
            "action_time_minutes": action.action_time,
            "next_action": action.next_action,
            "requirements": [
                {
                    "subcategory": req.subcategory,
                    "amount": (
                        req.amount * catalog_service.pack_units_for_superficie(parcel.superficie)
                        if catalog_service.subcategory_category(db, req.subcategory) == "packs"
                        else req.amount
                    ),
                }
                for req in requirements
            ],
        }
    ]


def get_parcel_detail(db: Session, parcel: Parcel) -> dict:
    return {**_parcel_dict(db, parcel), "possible_actions": get_possible_actions(db, parcel)}


def buy_parcel(db: Session, parcel: Parcel) -> tuple[bool, str, float]:
    if parcel.is_purchased:
        return False, "Parcelle déjà achetée.", wallet_service.get_balance(db)

    if not wallet_service.debit(db, parcel.prix):
        return False, "Solde insuffisant.", wallet_service.get_balance(db)

    parcel.is_purchased = True
    type_surface = db.get(TypeSurface, parcel.type_surface_id)
    if type_surface and type_surface.type_surface == "entrepôt":
        parcel.storage_level = 1
    db.commit()
    return True, "Parcelle achetée avec succès.", wallet_service.get_balance(db)


def upgrade_storage(db: Session, parcel: Parcel) -> tuple[bool, str, float]:
    type_surface = db.get(TypeSurface, parcel.type_surface_id)
    if not parcel.is_purchased or type_surface is None or type_surface.type_surface != "entrepôt":
        return False, "Seul un entrepôt possédé peut être amélioré.", wallet_service.get_balance(db)

    cost = settings.storage_upgrade_base_cost * parcel.storage_level
    if not wallet_service.debit(db, cost):
        return False, "Solde insuffisant.", wallet_service.get_balance(db)

    parcel.storage_level += 1
    db.commit()
    return True, f"Entrepôt amélioré au niveau {parcel.storage_level}.", wallet_service.get_balance(db)


def protect_parcel(db: Session, parcel: Parcel) -> tuple[bool, str, float]:
    if not parcel.is_purchased:
        return False, "Cette parcelle n'est pas possédée.", wallet_service.get_balance(db)

    today = calendar_service.current_day_index(db)
    if parcel.protected_until_day == today:
        return False, "Déjà protégée pour aujourd'hui.", wallet_service.get_balance(db)

    weather = calendar_service.get_weather(today)
    equipped = _owns_protection_equipment(db, weather)
    cost = settings.protection_cost_with_equipment_usd if equipped else settings.protection_cost_usd

    if not wallet_service.debit(db, cost):
        return False, "Solde insuffisant.", wallet_service.get_balance(db)

    parcel.protected_until_day = today
    db.commit()
    message = (
        f"Parcelle protégée pour la journée ({cost:.0f}$, équipement possédé)."
        if equipped
        else f"Parcelle protégée pour la journée ({cost:.0f}$, prestataire externe)."
    )
    return True, message, wallet_service.get_balance(db)


def protect_all_at_risk(db: Session) -> dict:
    """Protect every owned, currently-growing parcel exposed to today's frost/heatwave
    in one pass — the one-click answer to "gel aujourd'hui, protège tous mes champs"
    instead of clicking "Protéger" 40 times. Mirrors the single-parcel eligibility
    rules in `protect_parcel` exactly, just applied in bulk."""
    today = calendar_service.current_day_index(db)
    weather = calendar_service.get_weather(today)
    if weather not in ("gel", "canicule"):
        return {
            "protected": 0,
            "skipped": 0,
            "total_cost": 0.0,
            "weather": weather,
            "message": "Aucun risque météo aujourd'hui — rien à protéger.",
            "balance_usd": wallet_service.get_balance(db),
        }

    at_risk = db.execute(
        select(Parcel).where(
            Parcel.is_purchased.is_(True),
            Parcel.parcel_next_action.in_(calendar_service.GROWING_NEXT_ACTIONS),
            or_(Parcel.protected_until_day.is_(None), Parcel.protected_until_day != today),
        ).order_by(Parcel.parcel_id)
    ).scalars().all()

    equipped = _owns_protection_equipment(db, weather)
    unit_cost = settings.protection_cost_with_equipment_usd if equipped else settings.protection_cost_usd

    protected = 0
    total_cost = 0.0
    for parcel in at_risk:
        if not wallet_service.debit(db, unit_cost):
            break
        parcel.protected_until_day = today
        protected += 1
        total_cost += unit_cost

    skipped = len(at_risk) - protected
    db.commit()

    if protected == 0:
        message = "Solde insuffisant pour protéger la moindre parcelle."
    elif skipped:
        message = f"{protected} parcelle(s) protégée(s) ({total_cost:.0f}$), {skipped} non protégée(s) — solde insuffisant."
    else:
        message = f"{protected} parcelle(s) protégée(s) pour la journée ({total_cost:.0f}$)."

    return {
        "protected": protected,
        "skipped": skipped,
        "total_cost": total_cost,
        "weather": weather,
        "message": message,
        "balance_usd": wallet_service.get_balance(db),
    }


def bulk_start_action(db: Session, action_type: str, resources: list[dict]) -> dict:
    """Start the same action (worker auto-assigned, same resource picks) across every
    owned parcel for which it's the next step. Real workers are a shared, limited pool
    (5 by default) — this starts as many as have a free worker right now and reports
    the rest as waiting; running it again once actions complete picks up where it left
    off, since it only ever targets parcels still awaiting that action."""
    from app.services import action_service  # deferred: action_service imports this module's siblings

    parcels = db.execute(
        select(Parcel).where(
            Parcel.is_purchased.is_(True),
            Parcel.parcel_next_action == action_type,
        ).order_by(Parcel.parcel_id)
    ).scalars().all()
    eligible = [p for p in parcels if not action_service._parcel_has_ongoing_action(db, p.parcel_id)]

    workers = db.execute(select(Worker).where(Worker.available.is_(True))).scalars().all()

    started = 0
    no_worker = 0
    failures: list[dict] = []
    for parcel in eligible:
        worker = next((w for w in workers if action_service.is_worker_available(db, w.worker_id)), None)
        if worker is None:
            no_worker += 1
            continue
        success, message, _ = action_service.start_action(db, parcel, action_type, worker.worker_id, resources)
        if success:
            started += 1
        else:
            failures.append({"parcel_id": parcel.parcel_id, "message": message})

    return {
        "started": started,
        "no_worker": no_worker,
        "total_eligible": len(eligible),
        "failures": failures,
        "balance_usd": wallet_service.get_balance(db),
    }
