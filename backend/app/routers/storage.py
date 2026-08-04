from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import StorageResponse
from app.services import storage_service

router = APIRouter(prefix="/api/storage", tags=["storage"])


@router.get("", response_model=StorageResponse)
def get_storage(db: Session = Depends(get_db)) -> StorageResponse:
    return StorageResponse(**storage_service.get_status(db))
