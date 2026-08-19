from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Wallet(Base):
    __tablename__ = "wallet"

    wallet_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    balance_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0)


class TypeSurface(Base):
    __tablename__ = "type_surface"

    type_surface_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type_surface: Mapped[str] = mapped_column(String, nullable=False, unique=True)


class Parcel(Base):
    __tablename__ = "parcels"

    parcel_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    superficie: Mapped[float] = mapped_column(Float, nullable=False)
    type_surface_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("type_surface.type_surface_id"), nullable=False
    )
    prix: Mapped[float] = mapped_column(Float, nullable=False)
    is_purchased: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    parcel_next_action: Mapped[str | None] = mapped_column(String, nullable=True)

    # Crop health (100 -> 0), damaged by frost while a crop is growing; scales
    # the harvest reward. Reset to 100 whenever a fresh crop is planted.
    yield_health: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    # Set once fertilizer has been applied for the current crop cycle — grants
    # a permanent (for that cycle) yield multiplier at harvest.
    fertilized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Warehouse level (entrepôt parcels only) — each level adds storage capacity.
    storage_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Game-day index this parcel was last protected for (anti-frost fires /
    # irrigation) — cancels that single day's weather damage. None = unprotected.
    protected_until_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Catalog item_id of the seed/sapling variety currently growing on this parcel
    # (set when a "semer"/"planter" action starts, cleared at harvest) — drives
    # per-variety growth speed, frost/heat resistance and yield (see seed_traits.py).
    planted_seed_item_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("catalog.item_id"), nullable=True
    )
    # Accumulated growth — incremented once per game day, by that day's
    # growth_multiplier (a rainy day adds more than a plain day, a heatwave
    # adds less), while the crop is in the ground (see calendar_service
    # GROWING_NEXT_ACTIONS). Harvest is blocked until this reaches the
    # variety's required_growth_days. Reset to 0 on replant and at harvest.
    growth_progress: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Crop rotation (champ parcels only — vigne/forêt are single-family by
    # nature and never touch these two fields, so they stay at the default
    # forever). Sowing the same crop family as last time depletes the soil;
    # alternating families replenishes it. See action_service.start_action.
    soil_fertility: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    last_crop_subcategory: Mapped[str | None] = mapped_column(String, nullable=True)


class Catalog(Base):
    __tablename__ = "catalog"

    item_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[str] = mapped_column(String, nullable=False)
    subcategory: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    promotion: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    img_path: Mapped[str] = mapped_column(String, nullable=False)


class Vehicule(Base):
    __tablename__ = "vehicules"

    vehicle_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("catalog.item_id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Accessory(Base):
    __tablename__ = "accessories"

    accessory_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("catalog.item_id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Pack(Base):
    __tablename__ = "packs"

    pack_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("catalog.item_id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Action(Base):
    __tablename__ = "actions"

    action_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    action_type: Mapped[str] = mapped_column(String, nullable=False)
    type_surface_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("type_surface.type_surface_id"), nullable=False
    )
    action_time: Mapped[float] = mapped_column(Float, nullable=False)
    next_action: Mapped[str | None] = mapped_column(String, nullable=True)


class ActionRequirement(Base):
    __tablename__ = "action_requirements"

    action_requirements_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    action_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("actions.action_id"), nullable=False
    )
    subcategory: Mapped[str | None] = mapped_column(String, nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)


class OngoingAction(Base):
    __tablename__ = "ongoing_actions"

    ongoing_action_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parcel_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("parcels.parcel_id"), nullable=False
    )
    action_type: Mapped[str] = mapped_column(String, nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    resources_used: Mapped[str] = mapped_column(Text, nullable=False)
    cost: Mapped[float] = mapped_column(Float, nullable=False)


class MarketPrice(Base):
    __tablename__ = "market_prices"

    price_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_category: Mapped[str] = mapped_column(String, nullable=False)
    item_subcategory: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    timestamp: Mapped[float] = mapped_column(Float, nullable=False)


class UsedVehicle(Base):
    __tablename__ = "used_vehicles"

    used_vehicle_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("catalog.item_id"), nullable=False
    )
    ongoing_action_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ongoing_actions.ongoing_action_id"), nullable=False
    )


class UsedAccessory(Base):
    __tablename__ = "used_accessories"

    used_accessory_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("catalog.item_id"), nullable=False
    )
    ongoing_action_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ongoing_actions.ongoing_action_id"), nullable=False
    )


class Loan(Base):
    __tablename__ = "loans"

    loan_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    principal: Mapped[float] = mapped_column(Float, nullable=False)
    interest_rate_annual: Mapped[float] = mapped_column(Float, nullable=False)
    balance_owed: Mapped[float] = mapped_column(Float, nullable=False)
    monthly_payment: Mapped[float] = mapped_column(Float, nullable=False)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    taken_at: Mapped[float] = mapped_column(Float, nullable=False)
    next_payment_day: Mapped[int] = mapped_column(Integer, nullable=False)


class GameState(Base):
    __tablename__ = "game_state"

    game_state_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    epoch_ts: Mapped[float] = mapped_column(Float, nullable=False)
    last_processed_day: Mapped[int] = mapped_column(Integer, nullable=False, default=-1)


class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    # Game-day index this notification was created on — used both to sort and
    # to purge anything older than settings.notification_retention_days.
    created_day: Mapped[int] = mapped_column(Integer, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[float] = mapped_column(Float, nullable=False)
    game_day: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    # Signed: positive = money in (sale, loan, cheat), negative = money out
    # (purchase, action cost, rental, loan payment...).
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    balance_after: Mapped[float] = mapped_column(Float, nullable=False)
    # Itemized detail, only set for line-item purchases/sales (not e.g. loan
    # payments) — lets the "facture" view show a real breakdown.
    item_name: Mapped[str | None] = mapped_column(String, nullable=True)
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    # A big-ticket purchase (vehicules/accessoires) gets a proper invoice
    # number and renders as a real facture instead of a plain ledger line.
    is_invoice: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    invoice_number: Mapped[str | None] = mapped_column(String, nullable=True)


class ActionHistoryEntry(Base):
    __tablename__ = "action_history"

    action_history_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parcel_id: Mapped[int] = mapped_column(Integer, nullable=False)
    action_type: Mapped[str] = mapped_column(String, nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    superficie: Mapped[float] = mapped_column(Float, nullable=False)
    cost: Mapped[float] = mapped_column(Float, nullable=False)
    resources_used: Mapped[str] = mapped_column(Text, nullable=False)


class NotificationSettings(Base):
    __tablename__ = "notification_settings"

    # Single-player game, single settings row — same singleton pattern as GameState.
    notification_settings_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    gel_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    canicule_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    bank_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
