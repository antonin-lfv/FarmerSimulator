from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    NotificationListResponse,
    NotificationSettingsResponse,
    UpdateNotificationSettingsRequest,
)
from app.services import calendar_service, notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
def list_notifications(db: Session = Depends(get_db)) -> NotificationListResponse:
    today = calendar_service.current_day_index(db)
    return NotificationListResponse(
        notifications=notification_service.list_recent(db, today),
        unread_count=notification_service.unread_count(db, today),
    )


@router.post("/read-all")
def read_all(db: Session = Depends(get_db)) -> dict:
    notification_service.mark_all_read(db)
    return {"success": True}


# Registered before "/{notification_id}"-style routes would be if any existed —
# kept here since "settings" can never collide with an int path param anyway.
@router.get("/settings", response_model=NotificationSettingsResponse)
def get_settings(db: Session = Depends(get_db)) -> NotificationSettingsResponse:
    return NotificationSettingsResponse(**notification_service.get_settings(db))


@router.put("/settings", response_model=NotificationSettingsResponse)
def update_settings(
    request: UpdateNotificationSettingsRequest, db: Session = Depends(get_db)
) -> NotificationSettingsResponse:
    return NotificationSettingsResponse(
        **notification_service.update_settings(db, **request.model_dump())
    )
