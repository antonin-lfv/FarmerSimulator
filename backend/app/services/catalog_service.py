import math
import time

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Accessory, Catalog, OngoingAction, Pack, UsedVehicle, Vehicule
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
    return [
        {
            "item_id": item.item_id,
            "category": item.category,
            "subcategory": item.subcategory,
            "name": item.name,
            "price": item.price,
            "promotion": item.promotion,
            "img_path": item.img_path,
            "amount_owned": owned_amount(db, item.item_id, item.category),
            "available_now": (
                get_available_vehicle_count(db, item.item_id)
                if item.category == "vehicules"
                else owned_amount(db, item.item_id, item.category)
            ),
            "rental_price": (
                item.price * settings.rental_fee_rate
                if item.category in ("vehicules", "accessoires")
                else None
            ),
        }
        for item in items
    ]


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

    total_price = item.price * (1 - item.promotion) * quantity
    if not wallet_service.debit(db, total_price):
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
