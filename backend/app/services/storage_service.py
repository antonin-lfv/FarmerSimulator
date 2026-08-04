from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Pack, Parcel, TypeSurface


def get_capacity(db: Session) -> float:
    total_levels = db.execute(
        select(func.coalesce(func.sum(Parcel.storage_level), 0))
        .select_from(Parcel)
        .join(TypeSurface, Parcel.type_surface_id == TypeSurface.type_surface_id)
        .where(TypeSurface.type_surface == "entrepôt", Parcel.is_purchased.is_(True))
    ).scalar_one()
    return settings.storage_base_capacity + total_levels * settings.storage_capacity_per_level


def get_used(db: Session) -> float:
    total = db.execute(select(func.coalesce(func.sum(Pack.amount), 0))).scalar_one()
    return float(total)


def get_status(db: Session) -> dict:
    capacity = get_capacity(db)
    used = get_used(db)
    return {"used": used, "capacity": capacity, "available": max(0.0, capacity - used)}


def remaining_capacity(db: Session) -> float:
    return max(0.0, get_capacity(db) - get_used(db))
