from typing import Literal

from pydantic import BaseModel, ConfigDict


class WalletResponse(BaseModel):
    balance_usd: float


class ActionRequirementResponse(BaseModel):
    subcategory: str
    amount: int


class PossibleActionResponse(BaseModel):
    action_id: int
    action_type: str
    action_time_minutes: float
    next_action: str | None
    requirements: list[ActionRequirementResponse]


class ParcelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    parcel_id: int
    superficie: float
    type_surface: str
    prix: float
    is_purchased: bool
    parcel_next_action: str | None
    previous_action: str | None
    yield_health: float
    fertilized: bool
    storage_level: int
    protected_today: bool
    planted_seed_name: str | None
    growth_progress_percent: float | None
    soil_fertility: float


class ParcelDetailResponse(ParcelResponse):
    possible_actions: list[PossibleActionResponse]


class BuyParcelResponse(BaseModel):
    success: bool
    message: str
    balance_usd: float


class UpgradeStorageResponse(BaseModel):
    success: bool
    message: str
    balance_usd: float


class ProtectParcelResponse(BaseModel):
    success: bool
    message: str
    balance_usd: float


class ResourceSelection(BaseModel):
    subcategory: str
    item_id: int
    mode: Literal["own", "rent"] = "own"


class StartActionRequest(BaseModel):
    action_type: str
    resources: list[ResourceSelection]


class StartActionResponse(BaseModel):
    success: bool
    message: str
    ongoing_action_id: int | None = None
    balance_usd: float


class BulkProtectResponse(BaseModel):
    protected: int
    skipped: int
    total_cost: float
    weather: str
    message: str
    balance_usd: float


class BulkActionRequest(BaseModel):
    action_type: str
    resources: list[ResourceSelection]


class BulkActionFailure(BaseModel):
    parcel_id: int
    message: str


class BulkActionResponse(BaseModel):
    started: int
    total_eligible: int
    failures: list[BulkActionFailure]
    balance_usd: float


class OngoingActionResponse(BaseModel):
    ongoing_action_id: int
    parcel_id: int
    action_type: str
    progress_percent: float
    remaining_minutes: float
    cost: float
    superficie: float


class CatalogItemResponse(BaseModel):
    item_id: int
    category: str
    subcategory: str
    name: str
    price: float
    promotion: float
    img_path: str
    amount_owned: int
    available_now: int
    rental_price: float | None = None


class BuyCatalogItemRequest(BaseModel):
    quantity: int = 1


class BuyCatalogItemResponse(BaseModel):
    success: bool
    message: str
    balance_usd: float


class InventoryItemResponse(BaseModel):
    item_id: int
    category: str
    subcategory: str
    name: str
    amount: int
    price: float
    promotion: float
    img_path: str


class SellInventoryRequest(BaseModel):
    quantity: int = 1


class SellResponse(BaseModel):
    success: bool
    message: str
    balance_usd: float


class MarketPriceResponse(BaseModel):
    category: str
    subcategory: str
    price: float
    timestamp: float


class PriceHistoryEntry(BaseModel):
    price: float
    timestamp: float


class SellHarvestRequest(BaseModel):
    item_id: int
    quantity: int


class CheatResponse(BaseModel):
    balance_usd: float


class StorageResponse(BaseModel):
    used: float
    capacity: float
    available: float


class LoanResponse(BaseModel):
    loan_id: int
    principal: float
    interest_rate_annual: float
    balance_owed: float
    monthly_payment: float
    term_months: int
    taken_at: float


class BorrowRequest(BaseModel):
    amount: float


class BorrowResponse(BaseModel):
    success: bool
    message: str
    loan: LoanResponse | None = None
    balance_usd: float


class RepayResponse(BaseModel):
    success: bool
    message: str
    balance_usd: float


class CalendarResponse(BaseModel):
    day_index: int
    month: int
    month_name: str
    day_of_month: int
    season: str
    weather: str
    weather_label: str
    growth_multiplier: float
    seconds_until_next_day: float = 0.0
    day_duration_seconds: float = 0.0


class TransactionResponse(BaseModel):
    transaction_id: int
    created_at: float
    game_day: int
    date_label: str
    category: str
    label: str
    amount: float
    balance_after: float
    item_name: str | None = None
    quantity: int | None = None
    unit_price: float | None = None
    is_invoice: bool
    invoice_number: str | None = None


class ActionHistoryResponse(BaseModel):
    action_history_id: int
    parcel_id: int
    action_type: str
    start_time: float
    end_time: float
    duration_minutes: float
    superficie: float
    cost: float


class NotificationResponse(BaseModel):
    notification_id: int
    category: str
    message: str
    created_day: int
    date_label: str
    read: bool


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int


class NotificationSettingsResponse(BaseModel):
    gel_alerts: bool
    canicule_alerts: bool
    bank_alerts: bool


class UpdateNotificationSettingsRequest(BaseModel):
    gel_alerts: bool | None = None
    canicule_alerts: bool | None = None
    bank_alerts: bool | None = None


class CatalogSpec(BaseModel):
    label: str
    value: str


class CatalogDetailResponse(BaseModel):
    item_id: int
    category: str
    subcategory: str
    name: str
    price: float
    promotion: float
    img_path: str
    amount_owned: int
    rental_price: float | None = None
    description: str
    usage: list[str] = []
    best_period: str | None = None
    specs: list[CatalogSpec]
