import random
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import GameState, Parcel
from app.seed_traits import get_traits

# A parcel is considered "growing" (crop in the ground, vulnerable to frost)
# from the moment it's sown/planted until it's harvested.
GROWING_NEXT_ACTIONS = {
    "mettre engrais céréales", "récolter céréales",
    "mettre engrais coton", "récolter coton",
    "mettre engrais patates", "récolter patates",
    "recolter raisins", "couper le bois",
}

GAME_STATE_ID = 1

SEASON_BY_MONTH = {
    12: "hiver", 1: "hiver", 2: "hiver",
    3: "printemps", 4: "printemps", 5: "printemps",
    6: "été", 7: "été", 8: "été",
    9: "automne", 10: "automne", 11: "automne",
}

# Rough climatology for mainland France (share of days with measurable rain
# per month) — higher in autumn/winter, lower in summer.
RAIN_PROBABILITY_BY_MONTH = {
    1: 0.32, 2: 0.30, 3: 0.30, 4: 0.32, 5: 0.30, 6: 0.26,
    7: 0.20, 8: 0.20, 9: 0.26, 10: 0.32, 11: 0.35, 12: 0.35,
}

# Frost is essentially a winter phenomenon (with light shoulder-season risk).
FROST_PROBABILITY_BY_MONTH = {
    1: 0.22, 2: 0.18, 3: 0.06, 4: 0.0, 5: 0.0, 6: 0.0,
    7: 0.0, 8: 0.0, 9: 0.0, 10: 0.0, 11: 0.05, 12: 0.16,
}

# Heatwaves cluster in summer, with a light shoulder in late spring/early autumn.
CANICULE_PROBABILITY_BY_MONTH = {
    1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.03, 6: 0.12,
    7: 0.22, 8: 0.22, 9: 0.08, 10: 0.0, 11: 0.0, 12: 0.0,
}

WEATHER_LABELS = {"normal": "Ensoleillé", "pluie": "Pluie", "gel": "Gel", "canicule": "Canicule"}

# Real (leap-year) calendar month lengths, Jan..Dec — the game shows an actual
# date ("23 mai") rather than an abstract "Jour X / Mois Y", but deliberately
# never a year: the calendar just repeats every DAYS_PER_YEAR days forever,
# there's no year counter to show. `settings.days_per_month`/`months_per_year`
# stay in config purely as the *pacing* knobs (how much real time one game
# year takes, and the loan billing cycle in loan_service.py) — they no longer
# define calendar month lengths.
DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
DAYS_PER_YEAR = sum(DAYS_IN_MONTH)

MONTH_NAMES_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]


def day_duration_seconds() -> float:
    year_duration = settings.month_duration_seconds * settings.months_per_year
    return year_duration / DAYS_PER_YEAR


def get_or_create_state(db: Session) -> GameState:
    state = db.get(GameState, GAME_STATE_ID)
    if state is None:
        state = GameState(game_state_id=GAME_STATE_ID, epoch_ts=time.time(), last_processed_day=-1)
        db.add(state)
        db.commit()
        db.refresh(state)
    return state


def current_day_index(db: Session) -> int:
    state = get_or_create_state(db)
    elapsed = max(0.0, time.time() - state.epoch_ts)
    return int(elapsed // day_duration_seconds())


def calendar_parts(day_index: int) -> dict:
    remainder = day_index % DAYS_PER_YEAR
    month_idx = 0
    while remainder >= DAYS_IN_MONTH[month_idx]:
        remainder -= DAYS_IN_MONTH[month_idx]
        month_idx += 1
    return {"month": month_idx + 1, "day_of_month": remainder + 1}


def get_weather(day_index: int) -> str:
    parts = calendar_parts(day_index)
    month = parts["month"]
    rng = random.Random(day_index * 7919 + 17)
    if rng.random() < FROST_PROBABILITY_BY_MONTH[month]:
        return "gel"
    if rng.random() < CANICULE_PROBABILITY_BY_MONTH[month]:
        return "canicule"
    if rng.random() < RAIN_PROBABILITY_BY_MONTH[month]:
        return "pluie"
    return "normal"


def growth_multiplier(day_index: int) -> float:
    weather = get_weather(day_index)
    if weather == "pluie":
        return settings.rain_growth_multiplier
    if weather == "canicule":
        return settings.heat_growth_multiplier
    return 1.0


# Which "semer"/"planter" action started the crop currently occupying a given
# growing step — lets required_growth_days() work from `parcel_next_action`
# alone, whether the parcel is mid-fertilizing or already ready to harvest.
GROWING_FAMILY = {
    "mettre engrais céréales": "semer céréales", "récolter céréales": "semer céréales",
    "mettre engrais coton": "semer coton", "récolter coton": "semer coton",
    "mettre engrais patates": "semer patates", "récolter patates": "semer patates",
    "recolter raisins": "planter des vignes",
    "couper le bois": "planter des arbres",
}

# Game days of *accumulated growth* (see growth_multiplier: a rainy day adds
# more than one, a heatwave adds less) needed before harvest unlocks, per crop
# family — scaled per-variety by seed_traits.growth_multiplier.
BASE_GROWTH_DAYS = {
    "semer céréales": 6.0,
    "semer coton": 7.0,
    "semer patates": 6.0,
    "planter des vignes": 10.0,
    "planter des arbres": 14.0,
}


def required_growth_days(next_action: str | None, planted_seed_item_id: int | None) -> float | None:
    family = GROWING_FAMILY.get(next_action) if next_action else None
    if family is None:
        return None
    return BASE_GROWTH_DAYS[family] * get_traits(planted_seed_item_id).growth_multiplier


def describe_day(day_index: int) -> dict:
    parts = calendar_parts(day_index)
    weather = get_weather(day_index)
    return {
        "day_index": day_index,
        "month": parts["month"],
        "month_name": MONTH_NAMES_FR[parts["month"] - 1],
        "day_of_month": parts["day_of_month"],
        "season": SEASON_BY_MONTH[parts["month"]],
        "weather": weather,
        "weather_label": WEATHER_LABELS[weather],
        "growth_multiplier": growth_multiplier(day_index),
    }


def get_today(db: Session) -> dict:
    state = get_or_create_state(db)
    day_index = current_day_index(db)
    result = describe_day(day_index)
    elapsed = max(0.0, time.time() - state.epoch_ts)
    day_length = day_duration_seconds()
    seconds_into_day = elapsed % day_length
    result["seconds_until_next_day"] = day_length - seconds_into_day
    result["day_duration_seconds"] = day_length
    return result


def get_forecast(db: Session, days: int = 7) -> list[dict]:
    today = current_day_index(db)
    return [describe_day(today + offset) for offset in range(days)]


def _apply_weather_damage(db: Session, day: int, weather: str) -> None:
    is_frost = weather == "gel"
    base_damage = settings.frost_damage_per_day if is_frost else settings.heat_damage_per_day
    parcels = db.execute(
        select(Parcel).where(
            Parcel.is_purchased.is_(True), Parcel.parcel_next_action.in_(GROWING_NEXT_ACTIONS)
        )
    ).scalars().all()
    for parcel in parcels:
        # A protected parcel (anti-frost fires / irrigation, paid for that day) shrugs off
        # the damage entirely for this single day.
        if parcel.protected_until_day == day:
            continue
        # The planted variety's frost/heat resistance trait shaves off a fraction
        # of the day's damage on top of that (see app/seed_traits.py).
        traits = get_traits(parcel.planted_seed_item_id)
        resistance = traits.frost_resistance if is_frost else traits.heat_resistance
        parcel.yield_health = max(0.0, parcel.yield_health - base_damage * (1 - resistance))


def _accumulate_growth(db: Session, day: int) -> None:
    increment = growth_multiplier(day)
    parcels = db.execute(
        select(Parcel).where(
            Parcel.is_purchased.is_(True), Parcel.parcel_next_action.in_(GROWING_NEXT_ACTIONS)
        )
    ).scalars().all()
    for parcel in parcels:
        parcel.growth_progress += increment


def process_day_tick(db: Session) -> None:
    from app.services import loan_service, market_service, notification_service

    state = get_or_create_state(db)
    target_day = current_day_index(db)
    day = state.last_processed_day
    while day < target_day:
        day += 1
        weather = get_weather(day)
        if weather in ("gel", "canicule"):
            _apply_weather_damage(db, day, weather)
            notification_service.create(
                db, weather, f"Alerte {WEATHER_LABELS[weather].lower()} — cultures exposées à risque.", day
            )
        _accumulate_growth(db, day)
        market_service.process_day(db, day)
        loan_service.process_day(db, day)
    state.last_processed_day = day
    db.commit()
