import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.database import SessionLocal
from app.services import action_service, calendar_service

logger = logging.getLogger(__name__)


def _tick() -> None:
    db = SessionLocal()
    try:
        # Finalise finished work first. Calendar catch-up can be expensive after
        # a long pause and must never delay the next action in a parcel's cycle.
        action_service.complete_finished_actions(db)
        # Market prices update inside process_day_tick — once per elapsed
        # in-game day, not on their own real-time timer.
        calendar_service.process_day_tick(db)
    except Exception:
        db.rollback()
        logger.exception("Game engine tick failed")
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        _tick,
        "interval",
        seconds=settings.market_update_interval_seconds,
        id="game_tick",
        coalesce=True,
        max_instances=1,
    )
    scheduler.start()
    return scheduler
