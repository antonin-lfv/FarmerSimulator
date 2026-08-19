import json
import random
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Action,
    ActionHistoryEntry,
    ActionRequirement,
    Catalog,
    OngoingAction,
    Pack,
    Parcel,
    UsedAccessory,
    UsedVehicle,
)
from app.seed_traits import get_traits
from app.services import calendar_service, catalog_service, market_service, storage_service, wallet_service

# Legacy `complete_finished_actions` only granted harvest rewards when
# "récolter" (with an accent) appeared in `action_type`. "recolter raisins"
# (seed data, no accent) and "couper le bois" never matched, so grapes and
# wood harvests silently gave nothing — clearly unintended, since the legacy
# code already had a dead `elif "bois" in action_type` reward branch. Ported
# here as an explicit, typo-proof action_type -> reward mapping instead.
#
# Grapes and wood reward their own distinct "raisins"/"bois" packs rather than
# more of the planting input ("graines raisins"/"pousses arbres") — the two
# are conceptually different goods (seed stock vs. harvested crop) and reward
# ing the seed item made vigne/forêt's output indistinguishable from what you
# buy to plant them in the first place.
HARVEST_REWARDS: dict[str, str] = {
    "récolter céréales": "graines céréales",
    "récolter coton": "graines coton",
    "récolter patates": "graines patates",
    "recolter raisins": "raisins",
    "couper le bois": "bois",
}

# Completing one of these plants a fresh crop: reset crop health to 100% and
# clear any fertilizer bonus from a previous cycle.
GROWTH_RESET_ACTIONS = {"semer", "planter des vignes", "planter des arbres"}

# Real Catalog subcategories for the three champ seed families — kept distinct
# (unlike forêt/vigne, which only ever had one subcategory each) so market
# pricing stays per-crop even though the *action* the player takes is unified
# below into a single generic "semer".
CHAMP_SEED_SUBCATEGORIES = {"graines céréales", "graines coton", "graines patates"}

# Pseudo-subcategory stored on the "semer" ActionRequirement row instead of one
# specific crop family's real subcategory — the player was previously forced
# through three separate action types ("semer céréales"/"coton"/"patates") that
# all did the exact same thing except which seed pack they required; now
# there's one "semer" action and the seed choice itself picks the crop.
# start_action() and the frontend ResourcePicker special-case this marker to
# mean "any item from CHAMP_SEED_SUBCATEGORIES".
CHAMP_SEED_MARKER = "graines"

CHAMP_SEED_TO_FERTILIZE_ACTION = {
    "graines céréales": "mettre engrais céréales",
    "graines coton": "mettre engrais coton",
    "graines patates": "mettre engrais patates",
}

# The "packs" subcategories/markers that represent a seed/sapling choice —
# whichever item is picked for one of these when a GROWTH_RESET_ACTIONS action
# starts becomes the parcel's `planted_seed_item_id` for the whole growing
# cycle (see app/seed_traits.py).
SEED_SUBCATEGORIES = {CHAMP_SEED_MARKER, "graines raisins", "pousses arbres"}

# Every plantable seed/sapling item's *real* Catalog subcategory — distinct
# from SEED_SUBCATEGORIES above, which includes the champ pseudo-subcategory
# instead of the three real ones. Used wherever code needs to recognize an
# actual catalog item as "a seed" (e.g. catalog_detail_service's trait
# display), not a requirement slot.
PLANTABLE_ITEM_SUBCATEGORIES = CHAMP_SEED_SUBCATEGORIES | {"graines raisins", "pousses arbres"}

# Equipment quality/speed trade-off: within any vehicule/accessoire
# subcategory (tracteur, accessoire pour semer, coupe de moissonneuse...),
# the priciest variant is the fastest and the cheapest is the slowest —
# computed from each item's price *relative to its own subcategory's siblings*
# rather than a hand-maintained item_id table, so a bigger/pricier tractor is
# automatically faster than a small one, any newly added catalog tier picks
# up a sensible multiplier for free, and a subcategory with only one item
# (nothing to compare against) gets no bonus/penalty at all.
EQUIPMENT_SPEED_SLOWEST_MULTIPLIER = 1.15
EQUIPMENT_SPEED_FASTEST_MULTIPLIER = 0.80


def equipment_duration_multiplier(db: Session, category: str, subcategory: str, price: float) -> float:
    if category not in ("vehicules", "accessoires"):
        return 1.0
    prices = db.execute(
        select(Catalog.price).where(Catalog.category == category, Catalog.subcategory == subcategory)
    ).scalars().all()
    if len(prices) <= 1:
        return 1.0
    lo, hi = min(prices), max(prices)
    if hi == lo:
        return 1.0
    t = (price - lo) / (hi - lo)
    return EQUIPMENT_SPEED_SLOWEST_MULTIPLIER + (EQUIPMENT_SPEED_FASTEST_MULTIPLIER - EQUIPMENT_SPEED_SLOWEST_MULTIPLIER) * t

# Completing one of these grants a permanent (for this cycle) yield bonus.
FERTILIZE_ACTIONS = {"mettre engrais céréales", "mettre engrais coton", "mettre engrais patates"}


def _next_fertilize_action(db: Session, parcel: Parcel) -> str:
    """Which crop-specific "mettre engrais X" a just-completed generic "semer"
    leads into — resolved from what was actually planted (parcel.planted_seed_item_id,
    set moments earlier in the same start_action() call) rather than a fixed
    Action.next_action, since "semer" no longer has just one possible successor."""
    planted = db.get(Catalog, parcel.planted_seed_item_id) if parcel.planted_seed_item_id else None
    if planted is not None:
        action = CHAMP_SEED_TO_FERTILIZE_ACTION.get(planted.subcategory)
        if action is not None:
            return action
    return "mettre engrais céréales"  # defensive fallback, shouldn't happen in practice


def _parcel_has_ongoing_action(db: Session, parcel_id: int) -> bool:
    current_time = time.time()
    ongoing = db.execute(
        select(OngoingAction).where(
            OngoingAction.parcel_id == parcel_id, OngoingAction.end_time > current_time
        )
    ).first()
    return ongoing is not None


def start_action(
    db: Session,
    parcel: Parcel,
    action_type: str,
    resources: list[dict],
) -> tuple[bool, str, int | None]:
    if not parcel.is_purchased:
        return False, "Cette parcelle n'est pas possédée.", None

    if parcel.parcel_next_action != action_type:
        return False, f"« {action_type} » n'est pas la prochaine action disponible pour cette parcelle.", None

    if _parcel_has_ongoing_action(db, parcel.parcel_id):
        return False, "Cette parcelle a déjà une action en cours.", None

    if action_type in HARVEST_REWARDS:
        required = calendar_service.required_growth_days(action_type, parcel.planted_seed_item_id)
        if required is not None and parcel.growth_progress < required:
            remaining = required - parcel.growth_progress
            return (
                False,
                f"La récolte n'est pas encore prête — encore environ {remaining:.1f} jour(s) de pousse.",
                None,
            )

    action = db.execute(
        select(Action).where(
            Action.type_surface_id == parcel.type_surface_id,
            Action.action_type == action_type,
        )
    ).scalar_one_or_none()
    if action is None:
        return False, "Action introuvable pour ce type de surface.", None

    requirements = db.execute(
        select(ActionRequirement).where(ActionRequirement.action_id == action.action_id)
    ).scalars().all()

    selections_by_subcategory = {res["subcategory"]: res for res in resources}
    resolved: list[dict] = []
    for req in requirements:
        selection = selections_by_subcategory.get(req.subcategory)
        if selection is None:
            return False, f"Sélection de ressource manquante pour « {req.subcategory} ».", None

        item = db.get(Catalog, selection["item_id"])
        if item is None:
            return False, f"Article invalide sélectionné pour « {req.subcategory} ».", None
        # The "semer" (champ) requirement stores CHAMP_SEED_MARKER instead of one
        # specific crop family's real subcategory — any of the three counts.
        expected_subcategories = (
            CHAMP_SEED_SUBCATEGORIES if req.subcategory == CHAMP_SEED_MARKER else {req.subcategory}
        )
        if item.subcategory not in expected_subcategories:
            return False, f"Article invalide sélectionné pour « {req.subcategory} ».", None

        mode = selection.get("mode", "own")
        # A contractor brings their own vehicle *and* the attachments it needs
        # (header, trailer...) — packs (consumables) can't be "rented".
        if mode == "rent" and item.category not in ("vehicules", "accessoires"):
            return False, "Seuls les véhicules et leurs accessoires peuvent être loués à un prestataire.", None

        # Consumable packs (seeds, fertilizer) scale with parcel size — a
        # bigger field needs more packs per action, never a flat 1.
        amount = req.amount
        if item.category == "packs":
            amount *= catalog_service.pack_units_for_superficie(parcel.superficie)

        resolved.append(
            {
                "subcategory": req.subcategory,
                "item_id": item.item_id,
                "category": item.category,
                "amount": amount,
                "mode": mode,
                "price": item.price,
            }
        )

    rental_fee = 0.0
    for res in resolved:
        if res["mode"] == "rent":
            rental_fee += res["price"] * settings.rental_fee_rate
        elif res["category"] == "vehicules":
            if not catalog_service.check_vehicle_availability(db, res["item_id"], res["amount"]):
                return False, f"Aucun véhicule « {res['subcategory']} » disponible pour le moment.", None
        elif res["category"] == "accessoires":
            if not catalog_service.check_accessory_availability(db, res["item_id"], res["amount"]):
                return False, f"Aucun(e) « {res['subcategory']} » disponible pour le moment.", None
        elif res["category"] == "packs":
            if catalog_service.owned_amount(db, res["item_id"], "packs") < res["amount"]:
                return False, f"Vous ne possédez pas assez de « {res['subcategory']} » ({res['amount']} requis pour {parcel.superficie} ha).", None

    equipment_multiplier = 1.0
    for res in resolved:
        equipment_multiplier *= equipment_duration_multiplier(db, res["category"], res["subcategory"], res["price"])

    # Better-quality equipment shortens the job itself, not just the wait —
    # applied here (before cost) so a faster tractor also costs less labor
    # time, not just a smaller internal clock.
    action_time_minutes = action.action_time * parcel.superficie * equipment_multiplier
    total_cost = settings.labor_rate_usd * action_time_minutes + rental_fee

    if not wallet_service.debit(
        db, total_cost, "cout_action", f"{action_type.capitalize()} — parcelle {parcel.parcel_id}"
    ):
        return False, "Solde insuffisant.", None

    for res in resolved:
        if res["category"] == "packs":
            pack = db.execute(
                select(Pack).where(Pack.item_id == res["item_id"])
            ).scalar_one_or_none()
            if pack is not None:
                pack.amount -= res["amount"]

    planted_item_id = None
    if action_type in GROWTH_RESET_ACTIONS:
        for res in resolved:
            if res["category"] == "packs" and res["subcategory"] in SEED_SUBCATEGORIES:
                planted_item_id = res["item_id"]
                break

    # Crop rotation (champ only — "semer" is the one GROWTH_RESET_ACTIONS entry
    # that has an actual choice of family; vigne/forêt are always the same
    # single crop, so there's nothing to rotate). Sowing the same family two
    # cycles in a row depletes the soil; alternating replenishes it. Kept to
    # one simple rule (compare only to the immediately previous crop) rather
    # than a longer rotation history, on purpose — easy to reason about.
    if action_type == "semer" and planted_item_id is not None:
        new_family = db.get(Catalog, planted_item_id).subcategory
        if parcel.last_crop_subcategory is not None:
            if new_family == parcel.last_crop_subcategory:
                parcel.soil_fertility = max(0.0, parcel.soil_fertility - settings.soil_fertility_penalty)
            else:
                parcel.soil_fertility = min(100.0, parcel.soil_fertility + settings.soil_fertility_bonus)
        parcel.last_crop_subcategory = new_family

    duration_seconds = (
        settings.debug_action_seconds
        if settings.debug_action_seconds is not None
        else action_time_minutes * settings.game_minute_in_seconds
    )
    # NOTE: crop growth (parcel.growth_progress) accumulates on its own daily
    # tick in calendar_service._accumulate_growth, entirely independent of any
    # OngoingAction's duration — weather's growth_multiplier must not also be
    # applied here, or every action in the game (labourer, récolter, stockage,
    # not just growing ones) would silently get faster/slower with the weather
    # for free, with no matching cost change. Only the planted variety's own
    # trait (a real per-item trade-off, see seed_traits.py) affects this timer.
    if action_type in GROWTH_RESET_ACTIONS:
        duration_seconds *= get_traits(planted_item_id).growth_multiplier
    start_time = time.time()
    end_time = start_time + duration_seconds

    if action_type in GROWTH_RESET_ACTIONS:
        parcel.planted_seed_item_id = planted_item_id
        parcel.growth_progress = 0.0

    ongoing = OngoingAction(
        parcel_id=parcel.parcel_id,
        action_type=action_type,
        start_time=start_time,
        end_time=end_time,
        resources_used=json.dumps(resolved),
        cost=total_cost,
    )
    db.add(ongoing)
    db.flush()

    for res in resolved:
        if res["mode"] != "own":
            continue
        if res["category"] == "vehicules":
            for _ in range(res["amount"]):
                db.add(UsedVehicle(item_id=res["item_id"], ongoing_action_id=ongoing.ongoing_action_id))
        elif res["category"] == "accessoires":
            for _ in range(res["amount"]):
                db.add(UsedAccessory(item_id=res["item_id"], ongoing_action_id=ongoing.ongoing_action_id))

    db.commit()
    return True, "Action démarrée.", ongoing.ongoing_action_id


def get_ongoing_actions(db: Session) -> list[dict]:
    current_time = time.time()
    rows = db.execute(
        select(OngoingAction).where(OngoingAction.end_time > current_time)
        .order_by(OngoingAction.end_time)
    ).scalars().all()

    results = []
    for ongoing in rows:
        parcel = db.get(Parcel, ongoing.parcel_id)
        total_duration = ongoing.end_time - ongoing.start_time
        elapsed = current_time - ongoing.start_time
        progress = min(100.0, max(0.0, (elapsed / total_duration) * 100)) if total_duration > 0 else 100.0
        remaining_minutes = max(0.0, (ongoing.end_time - current_time) / 60)

        results.append(
            {
                "ongoing_action_id": ongoing.ongoing_action_id,
                "parcel_id": ongoing.parcel_id,
                "action_type": ongoing.action_type,
                "progress_percent": progress,
                "remaining_minutes": remaining_minutes,
                "cost": ongoing.cost,
                "superficie": parcel.superficie if parcel else 0.0,
            }
        )
    return results


def list_action_history(db: Session, limit: int = 100) -> list[dict]:
    rows = db.execute(
        select(ActionHistoryEntry)
        .order_by(ActionHistoryEntry.end_time.desc(), ActionHistoryEntry.action_history_id.desc())
        .limit(limit)
    ).scalars().all()
    return [
        {
            "action_history_id": e.action_history_id,
            "parcel_id": e.parcel_id,
            "action_type": e.action_type,
            "start_time": e.start_time,
            "end_time": e.end_time,
            "duration_minutes": (e.end_time - e.start_time) / 60,
            "superficie": e.superficie,
            "cost": e.cost,
        }
        for e in rows
    ]


def complete_finished_actions(db: Session) -> None:
    current_time = time.time()
    finished = db.execute(
        select(OngoingAction).where(OngoingAction.end_time <= current_time)
    ).scalars().all()

    for ongoing in finished:
        parcel = db.get(Parcel, ongoing.parcel_id)
        if parcel is None:
            db.delete(ongoing)
            continue

        if ongoing.action_type in GROWTH_RESET_ACTIONS:
            parcel.yield_health = 100.0
            parcel.fertilized = False
        elif ongoing.action_type in FERTILIZE_ACTIONS:
            parcel.fertilized = True

        reward_subcategory = HARVEST_REWARDS.get(ongoing.action_type)
        if reward_subcategory is not None:
            # If this subcategory is itself a seed/sapling family (e.g. "graines
            # céréales"), reward back the exact variety that was planted rather
            # than always the same one — you harvest what you sowed. Falls back
            # to the lowest item_id (deterministic) for output-only goods like
            # "raisins"/"bois", which aren't planting subcategories themselves.
            reward_item = None
            if reward_subcategory in SEED_SUBCATEGORIES and parcel.planted_seed_item_id is not None:
                planted_item = db.get(Catalog, parcel.planted_seed_item_id)
                if planted_item is not None and planted_item.subcategory == reward_subcategory:
                    reward_item = planted_item
            if reward_item is None:
                reward_item = db.execute(
                    select(Catalog)
                    .where(Catalog.subcategory == reward_subcategory, Catalog.category == "packs")
                    .order_by(Catalog.item_id)
                    .limit(1)
                ).scalars().first()
            if reward_item is not None:
                packs_per_hectare = random.randint(3, 8)
                base_packs = packs_per_hectare * parcel.superficie
                # Frost damage (yield_health), the fertilizer bonus, the
                # planted variety's own yield trait and soil fertility (crop
                # rotation) all apply at harvest time, on top of the random
                # base yield. soil_fertility stays at its 100 default for
                # vigne/forêt (rotation only ever touches champ parcels), so
                # this multiplier is transparently 1.0 there.
                fertilizer_bonus = settings.fertilizer_yield_multiplier if parcel.fertilized else 1.0
                variety_bonus = get_traits(parcel.planted_seed_item_id).yield_multiplier
                soil_bonus = settings.soil_fertility_min_yield_multiplier + (
                    parcel.soil_fertility / 100.0
                ) * (1 - settings.soil_fertility_min_yield_multiplier)
                total_packs = int(
                    base_packs * (parcel.yield_health / 100.0) * fertilizer_bonus * variety_bonus * soil_bonus
                )

                # Silos aren't infinite: whatever doesn't fit in remaining storage
                # capacity is sold on the spot at the current market price instead
                # of being thrown away — a farmer with no room left still sells,
                # doesn't dump the harvest. This is what gives the entrepôt
                # surface type an actual gameplay role (see storage_service).
                storable = min(total_packs, int(storage_service.remaining_capacity(db)))
                overflow = total_packs - storable

                if storable > 0:
                    pack = db.execute(
                        select(Pack).where(Pack.item_id == reward_item.item_id)
                    ).scalar_one_or_none()
                    if pack is not None:
                        pack.amount += storable
                    else:
                        db.add(Pack(item_id=reward_item.item_id, amount=storable))

                if overflow > 0:
                    harvest_subcategory = market_service.PACK_SUBCATEGORY_TO_HARVEST.get(
                        reward_item.subcategory, reward_item.subcategory
                    )
                    price = market_service.get_price(db, "harvest", harvest_subcategory)
                    if price is not None:
                        wallet_service.credit(
                            db,
                            price * overflow,
                            "vente_recolte",
                            f"Récolte vendue directement (entrepôt plein) — {reward_item.name} ×{overflow}",
                            item_name=reward_item.name,
                            quantity=overflow,
                            unit_price=price,
                        )

            # Crop cycle is over either way — back to a clean slate for the next one.
            parcel.yield_health = 100.0
            parcel.fertilized = False
            parcel.planted_seed_item_id = None
            parcel.growth_progress = 0.0

        if ongoing.action_type == "semer":
            # "semer" is one generic action for all champ crop families now —
            # which crop-specific "mettre engrais X" comes next depends on
            # which seed was actually chosen, not a fixed Action.next_action.
            parcel.parcel_next_action = _next_fertilize_action(db, parcel)
        else:
            next_action_row = db.execute(
                select(Action).where(
                    Action.action_type == ongoing.action_type,
                    Action.type_surface_id == parcel.type_surface_id,
                )
            ).scalar_one_or_none()
            if next_action_row is not None:
                parcel.parcel_next_action = next_action_row.next_action

        db.add(
            ActionHistoryEntry(
                parcel_id=ongoing.parcel_id,
                action_type=ongoing.action_type,
                start_time=ongoing.start_time,
                end_time=ongoing.end_time,
                superficie=parcel.superficie,
                cost=ongoing.cost,
                resources_used=ongoing.resources_used,
            )
        )

        db.execute(
            UsedVehicle.__table__.delete().where(
                UsedVehicle.ongoing_action_id == ongoing.ongoing_action_id
            )
        )
        db.execute(
            UsedAccessory.__table__.delete().where(
                UsedAccessory.ongoing_action_id == ongoing.ongoing_action_id
            )
        )
        db.delete(ongoing)

    db.commit()
