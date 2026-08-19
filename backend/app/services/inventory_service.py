from sqlalchemy import select
from sqlalchemy.orm import Session

from app.services import wallet_service
from app.services.catalog_service import OWNERSHIP_MODELS, get_catalog_item


def get_inventory(db: Session) -> list[dict]:
    inventory: list[dict] = []
    for model in OWNERSHIP_MODELS.values():
        rows = db.execute(select(model).where(model.amount > 0)).scalars().all()
        for row in rows:
            item = get_catalog_item(db, row.item_id)
            if item is None:
                continue
            inventory.append(
                {
                    "item_id": item.item_id,
                    "category": item.category,
                    "subcategory": item.subcategory,
                    "name": item.name,
                    "amount": row.amount,
                    "price": item.price,
                    "promotion": item.promotion,
                    "img_path": item.img_path,
                }
            )
    return inventory


def sell_item(db: Session, item_id: int, quantity: int) -> tuple[bool, str, float]:
    item = get_catalog_item(db, item_id)
    if item is None:
        return False, "Article introuvable dans le catalogue.", wallet_service.get_balance(db)
    if quantity <= 0:
        return False, "La quantité doit être positive.", wallet_service.get_balance(db)

    model = OWNERSHIP_MODELS.get(item.category)
    if model is None:
        return False, f"Catégorie « {item.category} » non prise en charge.", wallet_service.get_balance(db)

    row = db.execute(select(model).where(model.item_id == item_id)).scalar_one_or_none()
    if row is None or row.amount < quantity:
        return False, "Quantité possédée insuffisante pour cette vente.", wallet_service.get_balance(db)

    row.amount -= quantity
    balance = wallet_service.credit(
        db,
        item.price * quantity,
        "vente_materiel",
        f"Vente — {item.name} ×{quantity}",
        item_name=item.name,
        quantity=quantity,
        unit_price=item.price,
    )
    db.commit()
    return True, "Vente effectuée.", balance
