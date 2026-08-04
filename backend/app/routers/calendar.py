from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import CalendarResponse
from app.services import calendar_service

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("", response_model=CalendarResponse)
def get_today(db: Session = Depends(get_db)) -> CalendarResponse:
    return CalendarResponse(**calendar_service.get_today(db))


@router.get("/forecast", response_model=list[CalendarResponse])
def get_forecast(days: int = 7, db: Session = Depends(get_db)) -> list[CalendarResponse]:
    return [CalendarResponse(**day) for day in calendar_service.get_forecast(db, days)]
