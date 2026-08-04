import random
import time

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Catalog, MarketPrice, Pack
from app.services import wallet_service

# The `packs` table doubles as both purchasable consumables and harvested crop
# stock (see seed.py). Selling a harvested pack values it at the market price
# of the matching "harvest" subcategory, e.g. "graines céréales" -> "céréales".
PACK_SUBCATEGORY_TO_HARVEST = {
    "graines céréales": "céréales",
    "graines coton": "coton",
    "graines patates": "patates",
    "graines raisins": "raisins",
    "pousses arbres": "bois",
}

PACK_PRICE_BOUNDS = (40.0, 800.0)
HARVEST_PRICE_BOUNDS = {
    "céréales": (100.0, 400.0),
    "patates": (80.0, 350.0),
    "coton": (200.0, 700.0),
    "bois": (60.0, 250.0),
    "raisins": (400.0, 1500.0),
}

MARKET_EVENTS = [
    ("drought", "sécheresse", {"harvest": 1.3, "packs": 1.1}),
    ("bumper_crop", "récolte exceptionnelle", {"harvest": 0.7, "packs": 0.9}),
    ("export_demand", "forte demande export", {"harvest": 1.4, "packs": 1.0}),
    ("fuel_increase", "hausse carburant", {"harvest": 1.1, "packs": 1.2}),
    ("government_subsidy", "subventions", {"harvest": 0.9, "packs": 0.8}),
]


def _latest_prices(db: Session) -> list[MarketPrice]:
    latest_timestamp = (
        select(
            MarketPrice.item_category,
            MarketPrice.item_subcategory,
            func.max(MarketPrice.timestamp).label("timestamp"),
        )
        .group_by(MarketPrice.item_category, MarketPrice.item_subcategory)
        .subquery()
    )
    rows = db.execute(
        select(MarketPrice).join(
            latest_timestamp,
            (MarketPrice.item_category == latest_timestamp.c.item_category)
            & (MarketPrice.item_subcategory == latest_timestamp.c.item_subcategory)
            & (MarketPrice.timestamp == latest_timestamp.c.timestamp),
        )
    ).scalars().all()
    return list(rows)


def get_price(db: Session, category: str, subcategory: str) -> float | None:
    row = db.execute(
        select(MarketPrice)
        .where(MarketPrice.item_category == category, MarketPrice.item_subcategory == subcategory)
        .order_by(MarketPrice.timestamp.desc())
        .limit(1)
    ).scalar_one_or_none()
    return row.price if row else None


def get_current_prices(db: Session) -> list[dict]:
    rows = sorted(_latest_prices(db), key=lambda r: (r.item_category, r.item_subcategory))
    return [
        {
            "category": row.item_category,
            "subcategory": row.item_subcategory,
            "price": row.price,
            "timestamp": row.timestamp,
        }
        for row in rows
    ]


def get_price_history(db: Session, subcategory: str, limit: int = 100) -> list[dict]:
    rows = db.execute(
        select(MarketPrice)
        .where(MarketPrice.item_subcategory == subcategory)
        .order_by(MarketPrice.timestamp.desc())
        .limit(limit)
    ).scalars().all()
    return [{"price": row.price, "timestamp": row.timestamp} for row in rows]


def _price_bounds(category: str, subcategory: str) -> tuple[float, float]:
    if category == "packs":
        return PACK_PRICE_BOUNDS
    return HARVEST_PRICE_BOUNDS.get(subcategory, (30.0, 200.0))


def _target_price(category: str, subcategory: str) -> float:
    # The mean each price drifts back toward — the midpoint of *that*
    # subcategory's own bounds, not a single value shared by every good
    # (graines céréales at ~110 and graines raisins at ~650 can't sensibly
    # both revert toward the same target).
    low, high = _price_bounds(category, subcategory)
    return (low + high) / 2


def update_prices_for_day(db: Session) -> None:
    """One price update per in-game day (called from calendar_service's day-tick
    loop, never on a real-time timer) — a random walk around each subcategory's
    own mean, with a small chance of a sharper spike or drop that day."""
    current_time = time.time()

    for row in _latest_prices(db):
        min_price, max_price = _price_bounds(row.item_category, row.item_subcategory)
        target = _target_price(row.item_category, row.item_subcategory)

        daily_noise = random.uniform(-0.06, 0.06)
        reversion = (target - row.price) / target * 0.15
        spike = 0.0
        if random.random() < 0.12:
            spike = random.uniform(0.15, 0.35) * random.choice((-1, 1))

        new_price = row.price * (1 + daily_noise + reversion + spike)
        new_price = max(min_price, min(new_price, max_price))

        db.add(
            MarketPrice(
                item_category=row.item_category,
                item_subcategory=row.item_subcategory,
                price=round(new_price, 2),
                timestamp=current_time,
            )
        )
    db.commit()


def create_market_event(db: Session) -> str:
    current_time = time.time()
    event_type, event_name, multipliers = random.choice(MARKET_EVENTS)

    for row in _latest_prices(db):
        multiplier = multipliers.get(row.item_category)
        if multiplier is None:
            continue
        multiplier *= random.uniform(0.8, 1.2)
        new_price = row.price * multiplier
        min_price, max_price = _price_bounds(row.item_category, row.item_subcategory)
        new_price = max(min_price, min(new_price, max_price))

        db.add(
            MarketPrice(
                item_category=row.item_category,
                item_subcategory=row.item_subcategory,
                price=round(new_price, 2),
                timestamp=current_time,
            )
        )
    db.commit()
    return event_type


def process_day(db: Session, day: int) -> None:
    """Called once per elapsed in-game day from calendar_service.process_day_tick
    — the market's "day" is the same day as the calendar's, not an independent
    real-time timer."""
    update_prices_for_day(db)
    if random.random() < settings.market_event_daily_chance:
        create_market_event(db)


def sell_harvest(db: Session, item_id: int, quantity: int) -> tuple[bool, str, float]:
    if quantity <= 0:
        return False, "La quantité doit être positive.", wallet_service.get_balance(db)

    catalog_item = db.get(Catalog, item_id)
    if catalog_item is None or catalog_item.category != "packs":
        return False, "Cet article n'est pas une récolte vendable.", wallet_service.get_balance(db)

    harvest_subcategory = PACK_SUBCATEGORY_TO_HARVEST.get(catalog_item.subcategory, catalog_item.subcategory)

    pack = db.execute(select(Pack).where(Pack.item_id == item_id)).scalar_one_or_none()
    if pack is None or pack.amount < quantity:
        return False, "Quantité possédée insuffisante pour cette vente.", wallet_service.get_balance(db)

    price_row = db.execute(
        select(MarketPrice)
        .where(
            MarketPrice.item_category == "harvest",
            MarketPrice.item_subcategory == harvest_subcategory,
        )
        .order_by(MarketPrice.timestamp.desc())
        .limit(1)
    ).scalar_one_or_none()
    if price_row is None:
        return False, "Aucun prix de marché disponible.", wallet_service.get_balance(db)

    pack.amount -= quantity
    balance = wallet_service.credit(db, price_row.price * quantity)
    db.commit()
    return True, "Récolte vendue.", balance
