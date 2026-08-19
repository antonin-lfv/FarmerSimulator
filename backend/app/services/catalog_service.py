import math
import time

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Accessory, Catalog, OngoingAction, Pack, UsedAccessory, UsedVehicle, Vehicule
from app.services import storage_service, wallet_service

OWNERSHIP_MODELS = {
    "vehicules": Vehicule,
    "accessoires": Accessory,
    "packs": Pack,
}


def pack_units_for_superficie(superficie: float) -> int:
    """How many packs a consumable requirement needs for a parcel this size —
    settings.pack_hectares_per_unit hectares per pack, always rounded up."""
    return math.ceil(superficie / settings.pack_hectares_per_unit)


def subcategory_category(db: Session, subcategory: str) -> str | None:
    return db.execute(
        select(Catalog.category).where(Catalog.subcategory == subcategory).limit(1)
    ).scalars().first()


def owned_amount(db: Session, item_id: int, category: str) -> int:
    model = OWNERSHIP_MODELS.get(category)
    if model is None:
        return 0
    row = db.execute(select(model).where(model.item_id == item_id)).scalar_one_or_none()
    return row.amount if row else 0


def _used_counts(db: Session, model, current_time: float) -> dict[int, int]:
    rows = db.execute(
        select(model.item_id, func.count())
        .join(OngoingAction, model.ongoing_action_id == OngoingAction.ongoing_action_id)
        .where(OngoingAction.end_time > current_time)
        .group_by(model.item_id)
    ).all()
    return dict(rows)


def list_catalog(
    db: Session, category: str | None = None, subcategory: str | None = None
) -> list[dict]:
    query = select(Catalog)
    if category:
        query = query.where(Catalog.category == category)
    if subcategory:
        query = query.where(Catalog.subcategory == subcategory)
    query = query.order_by(Catalog.category, Catalog.subcategory, Catalog.price)

    items = db.execute(query).scalars().all()

    # Batched instead of 1-2 queries per item (this endpoint is polled every
    # ~10s from two components) — one ownership query per category, one
    # grouped "currently in use" query for each of vehicules/accessoires.
    owned_by_category = {
        cat: dict(db.execute(select(model.item_id, model.amount)).all())
        for cat, model in OWNERSHIP_MODELS.items()
    }
    current_time = time.time()
    used_vehicles = _used_counts(db, UsedVehicle, current_time)
    used_accessories = _used_counts(db, UsedAccessory, current_time)

    result = []
    for item in items:
        owned = owned_by_category.get(item.category, {}).get(item.item_id, 0)
        if item.category == "vehicules":
            available_now = max(0, owned - used_vehicles.get(item.item_id, 0))
        elif item.category == "accessoires":
            available_now = max(0, owned - used_accessories.get(item.item_id, 0))
        else:
            available_now = owned
        result.append(
            {
                "item_id": item.item_id,
                "category": item.category,
                "subcategory": item.subcategory,
                "name": item.name,
                "price": item.price,
                "promotion": item.promotion,
                "img_path": item.img_path,
                "amount_owned": owned,
                "available_now": available_now,
                "rental_price": (
                    item.price * settings.rental_fee_rate
                    if item.category in ("vehicules", "accessoires")
                    else None
                ),
            }
        )
    return result


def list_categories(db: Session) -> list[str]:
    rows = db.execute(
        select(Catalog.category).distinct().order_by(Catalog.category)
    ).scalars().all()
    return list(rows)


def get_catalog_item(db: Session, item_id: int) -> Catalog | None:
    return db.get(Catalog, item_id)


def buy_item(db: Session, item_id: int, quantity: int) -> tuple[bool, str, float]:
    item = get_catalog_item(db, item_id)
    if item is None:
        return False, "Article introuvable dans le catalogue.", wallet_service.get_balance(db)
    if quantity <= 0:
        return False, "La quantité doit être positive.", wallet_service.get_balance(db)

    if item.category == "packs" and quantity > storage_service.remaining_capacity(db):
        return (
            False,
            "Capacité de stockage insuffisante — vendez du stock ou achetez un entrepôt.",
            wallet_service.get_balance(db),
        )

    unit_price = item.price * (1 - item.promotion)
    total_price = unit_price * quantity
    # A tractor or other heavy equipment purchase is a real capital expense —
    # gets a proper invoice number and itemized facture, not just a ledger
    # line, once it crosses the threshold (vehicules/accessoires, matching
    # the "big machine" case the itemized view exists for).
    invoice_worthy = item.category in ("vehicules", "accessoires") and total_price >= settings.invoice_threshold_usd
    if not wallet_service.debit(
        db,
        total_price,
        "achat_materiel" if item.category in ("vehicules", "accessoires") else "achat_consommable",
        f"Achat — {item.name} ×{quantity}",
        item_name=item.name,
        quantity=quantity,
        unit_price=unit_price,
        invoice=invoice_worthy,
    ):
        return False, "Solde insuffisant.", wallet_service.get_balance(db)

    model = OWNERSHIP_MODELS.get(item.category)
    if model is None:
        return False, f"Catégorie « {item.category} » non prise en charge.", wallet_service.get_balance(db)

    row = db.execute(select(model).where(model.item_id == item_id)).scalar_one_or_none()
    if row:
        row.amount += quantity
    else:
        db.add(model(item_id=item_id, amount=quantity))

    db.commit()
    return True, "Achat effectué.", wallet_service.get_balance(db)


def get_available_vehicle_count(db: Session, item_id: int) -> int:
    vehicle = db.execute(
        select(Vehicule).where(Vehicule.item_id == item_id)
    ).scalar_one_or_none()
    if vehicle is None:
        return 0

    current_time = time.time()
    currently_used = db.execute(
        select(func.count())
        .select_from(UsedVehicle)
        .join(OngoingAction, UsedVehicle.ongoing_action_id == OngoingAction.ongoing_action_id)
        .where(UsedVehicle.item_id == item_id, OngoingAction.end_time > current_time)
    ).scalar_one()

    return max(0, vehicle.amount - currently_used)


def check_vehicle_availability(db: Session, item_id: int, quantity_needed: int = 1) -> bool:
    return get_available_vehicle_count(db, item_id) >= quantity_needed


def get_available_accessory_count(db: Session, item_id: int) -> int:
    # Mirrors get_available_vehicle_count: an accessoire in active use on an
    # ongoing action isn't free for a second one to pick up simultaneously,
    # same reservation model as vehicules (see UsedAccessory).
    accessory = db.execute(
        select(Accessory).where(Accessory.item_id == item_id)
    ).scalar_one_or_none()
    if accessory is None:
        return 0

    current_time = time.time()
    currently_used = db.execute(
        select(func.count())
        .select_from(UsedAccessory)
        .join(OngoingAction, UsedAccessory.ongoing_action_id == OngoingAction.ongoing_action_id)
        .where(UsedAccessory.item_id == item_id, OngoingAction.end_time > current_time)
    ).scalar_one()

    return max(0, accessory.amount - currently_used)


def check_accessory_availability(db: Session, item_id: int, quantity_needed: int = 1) -> bool:
    return get_available_accessory_count(db, item_id) >= quantity_needed
