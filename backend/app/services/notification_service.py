from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Notification, NotificationSettings
from app.services import calendar_service

SETTINGS_ID = 1

# Which settings toggle gates each notification category — "bank" covers loan
# events (borrow/repay/installment), "gel"/"canicule" are the two weather
# alert categories the player can mute independently.
CATEGORY_TO_SETTINGS_FIELD = {
    "gel": "gel_alerts",
    "canicule": "canicule_alerts",
    "bank": "bank_alerts",
}


def get_or_create_settings(db: Session) -> NotificationSettings:
    row = db.get(NotificationSettings, SETTINGS_ID)
    if row is None:
        row = NotificationSettings(notification_settings_id=SETTINGS_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_settings(db: Session) -> dict:
    row = get_or_create_settings(db)
    return {
        "gel_alerts": row.gel_alerts,
        "canicule_alerts": row.canicule_alerts,
        "bank_alerts": row.bank_alerts,
    }


def update_settings(db: Session, **fields: bool) -> dict:
    row = get_or_create_settings(db)
    for key, value in fields.items():
        if value is not None and hasattr(row, key):
            setattr(row, key, value)
    db.commit()
    return get_settings(db)


def _category_enabled(db: Session, category: str) -> bool:
    field = CATEGORY_TO_SETTINGS_FIELD.get(category)
    if field is None:
        return True
    return getattr(get_or_create_settings(db), field)


def create(db: Session, category: str, message: str, day: int) -> None:
    if not _category_enabled(db, category):
        return
    db.add(Notification(category=category, message=message, created_day=day, read=False))
    db.commit()


def _purge_old(db: Session, current_day: int) -> None:
    cutoff = current_day - settings.notification_retention_days
    db.execute(delete(Notification).where(Notification.created_day < cutoff))
    db.commit()


def list_recent(db: Session, current_day: int) -> list[dict]:
    _purge_old(db, current_day)
    rows = db.execute(
        select(Notification).order_by(Notification.created_day.desc(), Notification.notification_id.desc())
    ).scalars().all()
    result = []
    for n in rows:
        parts = calendar_service.calendar_parts(n.created_day)
        result.append(
            {
                "notification_id": n.notification_id,
                "category": n.category,
                "message": n.message,
                "created_day": n.created_day,
                "date_label": f"{parts['day_of_month']} {calendar_service.MONTH_NAMES_FR[parts['month'] - 1]}",
                "read": n.read,
            }
        )
    return result


def unread_count(db: Session, current_day: int) -> int:
    _purge_old(db, current_day)
    rows = db.execute(select(Notification).where(Notification.read.is_(False))).scalars().all()
    return len(rows)


def mark_all_read(db: Session) -> None:
    for n in db.execute(select(Notification).where(Notification.read.is_(False))).scalars().all():
        n.read = True
    db.commit()
