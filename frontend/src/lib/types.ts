export type SurfaceType = "champ" | "forêt" | "vigne" | "entrepôt";
export type ItemCategory = "vehicules" | "accessoires" | "packs";

export interface Wallet {
  balance_usd: number;
}

export interface Parcel {
  parcel_id: number;
  superficie: number;
  type_surface: SurfaceType;
  prix: number;
  is_purchased: boolean;
  parcel_next_action: string | null;
  previous_action: string | null;
  yield_health: number;
  fertilized: boolean;
  storage_level: number;
  protected_today: boolean;
  planted_seed_name: string | null;
  growth_progress_percent: number | null;
  soil_fertility: number;
}

export interface ActionRequirement {
  subcategory: string;
  amount: number;
}

export interface PossibleAction {
  action_id: number;
  action_type: string;
  action_time_minutes: number;
  next_action: string | null;
  requirements: ActionRequirement[];
}

export interface ParcelDetail extends Parcel {
  possible_actions: PossibleAction[];
}

export interface OutcomeResponse {
  success: boolean;
  message: string;
  balance_usd: number;
}

export interface StartActionResponse extends OutcomeResponse {
  ongoing_action_id: number | null;
}

export interface OngoingAction {
  ongoing_action_id: number;
  parcel_id: number;
  action_type: string;
  progress_percent: number;
  remaining_minutes: number;
  cost: number;
  superficie: number;
}

export interface CatalogItem {
  item_id: number;
  category: ItemCategory;
  subcategory: string;
  name: string;
  price: number;
  promotion: number;
  img_path: string;
  amount_owned: number;
  available_now: number;
  rental_price: number | null;
}

export interface CatalogSpec {
  label: string;
  value: string;
}

export interface CatalogDetail {
  item_id: number;
  category: ItemCategory;
  subcategory: string;
  name: string;
  price: number;
  promotion: number;
  img_path: string;
  amount_owned: number;
  rental_price: number | null;
  description: string;
  usage: string[];
  best_period: string | null;
  specs: CatalogSpec[];
}

export interface InventoryItem {
  item_id: number;
  category: ItemCategory;
  subcategory: string;
  name: string;
  amount: number;
  price: number;
  promotion: number;
  img_path: string;
}

export interface MarketPrice {
  category: string;
  subcategory: string;
  price: number;
  timestamp: number;
}

export interface MarketPricePoint {
  price: number;
  timestamp: number;
}

export interface Storage {
  used: number;
  capacity: number;
  available: number;
}

export interface Loan {
  loan_id: number;
  principal: number;
  interest_rate_annual: number;
  balance_owed: number;
  monthly_payment: number;
  term_months: number;
  taken_at: number;
}

export interface BorrowResponse {
  success: boolean;
  message: string;
  loan: Loan | null;
  balance_usd: number;
}

export type ResourceMode = "own" | "rent";

export interface ResourceSelection {
  subcategory: string;
  item_id: number;
  mode: ResourceMode;
}

export interface BulkProtectResponse {
  protected: number;
  skipped: number;
  total_cost: number;
  weather: Weather;
  message: string;
  balance_usd: number;
}

export interface BulkActionFailure {
  parcel_id: number;
  message: string;
}

export interface BulkActionResponse {
  started: number;
  total_eligible: number;
  failures: BulkActionFailure[];
  balance_usd: number;
}

export type Weather = "normal" | "pluie" | "gel" | "canicule";

export interface CalendarDay {
  day_index: number;
  month: number;
  month_name: string;
  day_of_month: number;
  season: string;
  weather: Weather;
  weather_label: string;
  growth_multiplier: number;
  seconds_until_next_day: number;
  day_duration_seconds: number;
}

export interface Notification {
  notification_id: number;
  category: string;
  message: string;
  created_day: number;
  date_label: string;
  read: boolean;
}

export interface NotificationList {
  notifications: Notification[];
  unread_count: number;
}

export interface NotificationSettings {
  gel_alerts: boolean;
  canicule_alerts: boolean;
  bank_alerts: boolean;
}

export interface Transaction {
  transaction_id: number;
  created_at: number;
  game_day: number;
  date_label: string;
  category: string;
  label: string;
  amount: number;
  balance_after: number;
  item_name: string | null;
  quantity: number | null;
  unit_price: number | null;
  is_invoice: boolean;
  invoice_number: string | null;
}

export interface ActionHistoryEntry {
  action_history_id: number;
  parcel_id: number;
  action_type: string;
  start_time: number;
  end_time: number;
  duration_minutes: number;
  superficie: number;
  cost: number;
}
