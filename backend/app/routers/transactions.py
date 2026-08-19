from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import TransactionResponse
from app.services import transaction_service

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    limit: int = 100, category: str | None = None, db: Session = Depends(get_db)
) -> list[TransactionResponse]:
    return [TransactionResponse(**t) for t in transaction_service.list_transactions(db, limit, category)]


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)) -> TransactionResponse:
    transaction = transaction_service.get_transaction(db, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction introuvable.")
    return TransactionResponse(**transaction)
