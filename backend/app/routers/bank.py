from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import BorrowRequest, BorrowResponse, LoanResponse, RepayResponse
from app.services import calendar_service, loan_service, wallet_service

router = APIRouter(prefix="/api/bank", tags=["bank"])


@router.get("/loans", response_model=list[LoanResponse])
def list_loans(db: Session = Depends(get_db)) -> list[LoanResponse]:
    return [LoanResponse(**loan) for loan in loan_service.list_loans(db)]


@router.post("/loans", response_model=BorrowResponse)
def borrow(request: BorrowRequest, db: Session = Depends(get_db)) -> BorrowResponse:
    today = calendar_service.current_day_index(db)
    success, message, loan = loan_service.borrow(db, request.amount, today)
    return BorrowResponse(
        success=success,
        message=message,
        loan=LoanResponse(**loan) if loan else None,
        balance_usd=loan["balance_usd"] if loan else wallet_service.get_balance(db),
    )


@router.post("/loans/repay", response_model=RepayResponse)
def repay(db: Session = Depends(get_db)) -> RepayResponse:
    success, message, balance = loan_service.repay_full(db)
    return RepayResponse(success=success, message=message, balance_usd=balance)
