from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    BulkActionRequest,
    BulkActionResponse,
    BulkProtectResponse,
    BuyParcelResponse,
    ParcelDetailResponse,
    ParcelResponse,
    ProtectParcelResponse,
    StartActionRequest,
    StartActionResponse,
    UpgradeStorageResponse,
)
from app.services import action_service, parcel_service, wallet_service

router = APIRouter(prefix="/api/parcels", tags=["parcels"])


@router.get("", response_model=list[ParcelResponse])
def list_parcels(db: Session = Depends(get_db)) -> list[ParcelResponse]:
    return [ParcelResponse(**p) for p in parcel_service.list_parcels(db)]


# Registered before "/{parcel_id}" so "bulk" is never swallowed by the int path param.
@router.post("/bulk/protect", response_model=BulkProtectResponse)
def bulk_protect(db: Session = Depends(get_db)) -> BulkProtectResponse:
    return BulkProtectResponse(**parcel_service.protect_all_at_risk(db))


@router.post("/bulk/actions", response_model=BulkActionResponse)
def bulk_actions(request: BulkActionRequest, db: Session = Depends(get_db)) -> BulkActionResponse:
    resources = [res.model_dump() for res in request.resources]
    return BulkActionResponse(**parcel_service.bulk_start_action(db, request.action_type, resources))


@router.get("/{parcel_id}", response_model=ParcelDetailResponse)
def get_parcel(parcel_id: int, db: Session = Depends(get_db)) -> ParcelDetailResponse:
    parcel = parcel_service.get_parcel(db, parcel_id)
    if parcel is None:
        raise HTTPException(status_code=404, detail="Parcelle introuvable.")
    return ParcelDetailResponse(**parcel_service.get_parcel_detail(db, parcel))


@router.post("/{parcel_id}/buy", response_model=BuyParcelResponse)
def buy_parcel(parcel_id: int, db: Session = Depends(get_db)) -> BuyParcelResponse:
    parcel = parcel_service.get_parcel(db, parcel_id)
    if parcel is None:
        raise HTTPException(status_code=404, detail="Parcelle introuvable.")
    success, message, balance = parcel_service.buy_parcel(db, parcel)
    return BuyParcelResponse(success=success, message=message, balance_usd=balance)


@router.post("/{parcel_id}/upgrade-storage", response_model=UpgradeStorageResponse)
def upgrade_storage(parcel_id: int, db: Session = Depends(get_db)) -> UpgradeStorageResponse:
    parcel = parcel_service.get_parcel(db, parcel_id)
    if parcel is None:
        raise HTTPException(status_code=404, detail="Parcelle introuvable.")
    success, message, balance = parcel_service.upgrade_storage(db, parcel)
    return UpgradeStorageResponse(success=success, message=message, balance_usd=balance)


@router.post("/{parcel_id}/protect", response_model=ProtectParcelResponse)
def protect_parcel(parcel_id: int, db: Session = Depends(get_db)) -> ProtectParcelResponse:
    parcel = parcel_service.get_parcel(db, parcel_id)
    if parcel is None:
        raise HTTPException(status_code=404, detail="Parcelle introuvable.")
    success, message, balance = parcel_service.protect_parcel(db, parcel)
    return ProtectParcelResponse(success=success, message=message, balance_usd=balance)


@router.post("/{parcel_id}/actions", response_model=StartActionResponse)
def start_action(
    parcel_id: int, request: StartActionRequest, db: Session = Depends(get_db)
) -> StartActionResponse:
    parcel = parcel_service.get_parcel(db, parcel_id)
    if parcel is None:
        raise HTTPException(status_code=404, detail="Parcelle introuvable.")

    success, message, ongoing_action_id = action_service.start_action(
        db,
        parcel,
        request.action_type,
        [res.model_dump() for res in request.resources],
    )
    return StartActionResponse(
        success=success,
        message=message,
        ongoing_action_id=ongoing_action_id,
        balance_usd=wallet_service.get_balance(db),
    )
