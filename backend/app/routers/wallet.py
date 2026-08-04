from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import CheatResponse, WalletResponse
from app.services import wallet_service

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


@router.get("", response_model=WalletResponse)
def get_wallet(db: Session = Depends(get_db)) -> WalletResponse:
    return WalletResponse(balance_usd=wallet_service.get_balance(db))


@router.post("/cheat", response_model=CheatResponse)
def cheat(db: Session = Depends(get_db)) -> CheatResponse:
    return CheatResponse(balance_usd=wallet_service.cheat(db))
