from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Action, ActionRequirement, Catalog, Parcel, TypeSurface
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


def _previous_action_index(db: Session) -> dict[tuple[int, str], str]:
    """Maps (type_surface_id, next_action) -> action_type for every action that
    has a next_action, built in one query instead of one filtered SELECT per
    parcel — list_parcels is polled every 8s by several components at once, so
    that used to be ~54 extra round trips per poll for this alone."""
    rows = db.execute(select(Action).order_by(Action.action_id)).scalars().all()
    index: dict[tuple[int, str], str] = {}
    for action in rows:
        if action.next_action is not None:
            index.setdefault((action.type_surface_id, action.next_action), action.action_type)
    return index


def _previous_action(parcel: Parcel, ctx: dict) -> str | None:
    """The action that, once completed, put this parcel into its current
    parcel_next_action state — i.e. the step the player just finished. Derived
    from the same Action.next_action chain the server already uses to advance
    parcel_next_action (see action_service.complete_finished_actions), rather
    than duplicating the cycle order as a second source of truth."""
    if parcel.parcel_next_action is None:
        return None
    # "mettre engrais céréales/coton/patates" are only ever reached dynamically
    # from "semer" now (action_service._next_fertilize_action) — never via a
    # static Action.next_action row — so the generic lookup below can't find
    # them.
    if parcel.parcel_next_action in ctx["fertilize_targets"]:
        return "semer"
    return ctx["prev_index"].get((parcel.type_surface_id, parcel.parcel_next_action))


def _build_parcel_context(db: Session) -> dict:
    """Everything list_parcels/_parcel_dict need that's shared across every
    parcel — computed once per call instead of once per parcel."""
    from app.services import action_service  # deferred: action_service imports this module's siblings

    return {
        "today": calendar_service.current_day_index(db),
        "type_surfaces": {
            t.type_surface_id: t.type_surface for t in db.execute(select(TypeSurface)).scalars().all()
        },
        "prev_index": _previous_action_index(db),
        "fertilize_targets": set(action_service.CHAMP_SEED_TO_FERTILIZE_ACTION.values()),
    }


def _parcel_dict(db: Session, parcel: Parcel, ctx: dict | None = None) -> dict:
    if ctx is None:
        ctx = _build_parcel_context(db)
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
        "type_surface": ctx["type_surfaces"].get(parcel.type_surface_id, ""),
        "prix": parcel.prix,
        "is_purchased": parcel.is_purchased,
        "parcel_next_action": parcel.parcel_next_action,
        "previous_action": _previous_action(parcel, ctx),
        "yield_health": parcel.yield_health,
        "fertilized": parcel.fertilized,
        "storage_level": parcel.storage_level,
        "protected_today": parcel.protected_until_day == ctx["today"],
        "planted_seed_name": planted_seed.name if planted_seed else None,
        "growth_progress_percent": growth_progress_percent,
        "soil_fertility": parcel.soil_fertility,
    }


def list_parcels(db: Session) -> list[dict]:
    ctx = _build_parcel_context(db)
    parcels = db.execute(select(Parcel).order_by(Parcel.parcel_id)).scalars().all()
    return [_parcel_dict(db, parcel, ctx) for parcel in parcels]


def get_parcel(db: Session, parcel_id: int) -> Parcel | None:
    return db.get(Parcel, parcel_id)


def get_possible_actions(db: Session, parcel: Parcel) -> list[dict]:
    from app.services import action_service  # deferred: action_service imports this module's siblings

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
                        # CHAMP_SEED_MARKER ("graines") isn't a real Catalog
                        # subcategory, so subcategory_category() can't resolve
                        # it — but it's always a packs slot.
                        if req.subcategory == action_service.CHAMP_SEED_MARKER
                        or catalog_service.subcategory_category(db, req.subcategory) == "packs"
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

    if not wallet_service.debit(
        db, parcel.prix, "achat_parcelle", f"Achat de la parcelle {parcel.parcel_id}"
    ):
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
    if not wallet_service.debit(
        db, cost, "amelioration_stockage", f"Amélioration entrepôt {parcel.parcel_id} → niveau {parcel.storage_level + 1}"
    ):
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

    if not wallet_service.debit(
        db, cost, "protection", f"Protection parcelle {parcel.parcel_id} contre {weather}"
    ):
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
        if not wallet_service.debit(
            db, unit_cost, "protection", f"Protection parcelle {parcel.parcel_id} contre {weather}"
        ):
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
    """Start the same action (same resource picks) across every owned parcel for
    which it's the next step — labor has no shared capacity limit, so this
    simply starts every eligible parcel in one pass (equipment availability can
    still make an individual parcel fail, e.g. only one tractor to go around)."""
    from app.services import action_service  # deferred: action_service imports this module's siblings

    parcels = db.execute(
        select(Parcel).where(
            Parcel.is_purchased.is_(True),
            Parcel.parcel_next_action == action_type,
        ).order_by(Parcel.parcel_id)
    ).scalars().all()
    eligible = [p for p in parcels if not action_service._parcel_has_ongoing_action(db, p.parcel_id)]

    started = 0
    failures: list[dict] = []
    for parcel in eligible:
        success, message, _ = action_service.start_action(db, parcel, action_type, resources)
        if success:
            started += 1
        else:
            failures.append({"parcel_id": parcel.parcel_id, "message": message})

    return {
        "started": started,
        "total_eligible": len(eligible),
        "failures": failures,
        "balance_usd": wallet_service.get_balance(db),
    }
