from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import MarketPriceResponse, PriceHistoryEntry, SellHarvestRequest, SellResponse
from app.services import market_service

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/prices", response_model=list[MarketPriceResponse])
def get_prices(db: Session = Depends(get_db)) -> list[MarketPriceResponse]:
    return [MarketPriceResponse(**p) for p in market_service.get_current_prices(db)]


@router.get("/history", response_model=list[PriceHistoryEntry])
def get_history(subcategory: str, db: Session = Depends(get_db)) -> list[PriceHistoryEntry]:
    return [PriceHistoryEntry(**h) for h in market_service.get_price_history(db, subcategory)]


@router.post("/sell-harvest", response_model=SellResponse)
def sell_harvest(request: SellHarvestRequest, db: Session = Depends(get_db)) -> SellResponse:
    success, message, balance = market_service.sell_harvest(db, request.item_id, request.quantity)
    return SellResponse(success=success, message=message, balance_usd=balance)
