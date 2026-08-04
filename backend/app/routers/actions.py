from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import OngoingActionResponse
from app.services import action_service

router = APIRouter(prefix="/api/actions", tags=["actions"])


@router.get("/ongoing", response_model=list[OngoingActionResponse])
def get_ongoing_actions(db: Session = Depends(get_db)) -> list[OngoingActionResponse]:
    return [OngoingActionResponse(**a) for a in action_service.get_ongoing_actions(db)]
