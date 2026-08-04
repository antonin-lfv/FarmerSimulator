from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.database import SessionLocal
from app.services import action_service, calendar_service


def _tick() -> None:
    db = SessionLocal()
    try:
        # Market prices update inside process_day_tick — once per elapsed
        # in-game day, not on their own real-time timer.
        calendar_service.process_day_tick(db)
        action_service.complete_finished_actions(db)
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        _tick,
        "interval",
        seconds=settings.market_update_interval_seconds,
        id="game_tick",
    )
    scheduler.start()
    return scheduler
