import os


class Settings:
    database_url: str = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://verdance:verdance@localhost:5432/verdance",
    )

    cors_origins: list[str] = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")

    starting_balance_usd: float = 75_000.0
    cheat_amount_usd: float = 10_000.0

    # Legacy `action_time` was misleadingly documented as "hours" but every call
    # site actually treated it as minutes (action_time * 60 == seconds). We keep
    # the exact real-world duration players experienced, just with honest naming:
    # each unit stored in `action_time` is one "game minute" worth 60 real seconds.
    game_minute_in_seconds: int = 60

    # Debug-only: when set, every action takes this many real seconds regardless
    # of action_time/superficie, so the full action pipeline (progress bars,
    # vehicle locking, resource consumption, action chaining) can be exercised
    # quickly. Costs are untouched — only the real-world wait time is overridden.
    debug_action_seconds: float | None = (
        float(os.environ["DEBUG_ACTION_SECONDS"])
        if os.environ.get("DEBUG_ACTION_SECONDS")
        else None
    )

    # Engine heartbeat — how often the scheduler tick runs, not a market-specific
    # timer. Prices themselves update once per elapsed in-game day (see
    # calendar_service.process_day_tick -> market_service.process_day).
    market_update_interval_seconds: int = 2
    market_event_daily_chance: float = 0.10

    # Hiring a contractor's own equipment for one action instead of owning it —
    # no purchase, no availability lock, just a flat percentage of the item's
    # catalog price charged per use. Mirrors real custom-hire farming practice.
    rental_fee_rate: float = 0.15

    # Storage: total owned `packs` (seeds, fertilizer, harvested goods) cannot
    # exceed capacity. Each purchased entrepôt parcel extends it, and each one
    # can be leveled up independently — capacity scales with both parcel count
    # AND level, so it keeps up even if every field on the map is in use.
    storage_base_capacity: float = 500.0
    storage_capacity_per_level: float = 1500.0
    storage_upgrade_base_cost: float = 4_000.0

    # Bank: a single amortizing loan at a time, fixed monthly payment over a
    # fixed term (like real equipment financing) — no continuous compounding.
    loan_interest_rate_annual: float = 0.08
    loan_term_months: int = 12
    # Roughly the price of the most expensive machine (moissonneuse) — a loan
    # is meant to help finance equipment, not print money.
    loan_max_amount_usd: float = 300_000.0

    # Calendar: 1 game month = this many real seconds. Real-world default is
    # "1 month = 1 week" (604800s); GAME_MONTH_SECONDS overrides it for
    # debugging (e.g. 300s so 1 month = 5 minutes).
    month_duration_seconds: float = float(os.environ.get("GAME_MONTH_SECONDS", 7 * 24 * 3600))
    months_per_year: int = 12
    # Loan billing cycle only (see loan_service.py) — the calendar shown to the
    # player uses real (leap-year) month lengths instead (calendar_service.py),
    # this is just "30 days" as a round, predictable installment period.
    days_per_month: int = 30

    # Weather effects
    rain_growth_multiplier: float = 1.1
    heat_growth_multiplier: float = 0.85
    frost_damage_per_day: float = 15.0
    heat_damage_per_day: float = 10.0
    fertilizer_yield_multiplier: float = 1.25

    # Protecting a parcel for the current day (anti-frost fires in a vineyard,
    # irrigation during a heatwave) fully cancels that day's weather damage.
    # Calling in a contractor with no equipment of your own costs full price;
    # owning the matching gear (see catalog "protection gel"/"protection canicule"
    # subcategories) drops it to just the running cost (fuel/water).
    protection_cost_usd: float = 600.0
    protection_cost_with_equipment_usd: float = 150.0

    # Notifications (bank events, weather alerts...) are purged once older
    # than this many game days — "keep about a month" per the player's ask.
    notification_retention_days: int = 30

    # Consumable packs (seeds, fertilizer) scale with parcel size instead of a
    # flat 1-per-action: this many hectares per pack, always rounded up (never
    # sell/require half a pack).
    pack_hectares_per_unit: float = 5.0


settings = Settings()
