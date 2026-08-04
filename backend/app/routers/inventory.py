from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import InventoryItemResponse, SellInventoryRequest, SellResponse
from app.services import catalog_service, inventory_service

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("", response_model=list[InventoryItemResponse])
def get_inventory(db: Session = Depends(get_db)) -> list[InventoryItemResponse]:
    return [InventoryItemResponse(**item) for item in inventory_service.get_inventory(db)]


@router.post("/{item_id}/sell", response_model=SellResponse)
def sell_item(
    item_id: int, request: SellInventoryRequest, db: Session = Depends(get_db)
) -> SellResponse:
    if catalog_service.get_catalog_item(db, item_id) is None:
        raise HTTPException(status_code=404, detail="Article introuvable dans le catalogue.")
    success, message, balance = inventory_service.sell_item(db, item_id, request.quantity)
    return SellResponse(success=success, message=message, balance_usd=balance)
