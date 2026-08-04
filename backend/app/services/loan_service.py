import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Loan
from app.services import calendar_service, notification_service, wallet_service


def _monthly_payment(principal: float, monthly_rate: float, term_months: int) -> float:
    if monthly_rate == 0:
        return principal / term_months
    factor = (1 + monthly_rate) ** term_months
    return principal * monthly_rate * factor / (factor - 1)


def _to_dict(loan: Loan) -> dict:
    return {
        "loan_id": loan.loan_id,
        "principal": loan.principal,
        "interest_rate_annual": loan.interest_rate_annual,
        "balance_owed": loan.balance_owed,
        "monthly_payment": loan.monthly_payment,
        "term_months": loan.term_months,
        "taken_at": loan.taken_at,
    }


def get_active_loan(db: Session) -> Loan | None:
    return db.execute(select(Loan)).scalars().first()


def list_loans(db: Session) -> list[dict]:
    loan = get_active_loan(db)
    return [_to_dict(loan)] if loan else []


def borrow(db: Session, amount: float, current_day: int) -> tuple[bool, str, dict | None]:
    if amount <= 0:
        return False, "Le montant emprunté doit être positif.", None
    if amount > settings.loan_max_amount_usd:
        return (
            False,
            f"Montant trop élevé (plafond {settings.loan_max_amount_usd:,.0f} USD).",
            None,
        )
    if get_active_loan(db) is not None:
        return False, "Un seul prêt actif à la fois — remboursez le prêt en cours d'abord.", None

    monthly_rate = settings.loan_interest_rate_annual / 12
    payment = _monthly_payment(amount, monthly_rate, settings.loan_term_months)

    loan = Loan(
        principal=amount,
        interest_rate_annual=settings.loan_interest_rate_annual,
        balance_owed=amount,
        monthly_payment=round(payment, 2),
        term_months=settings.loan_term_months,
        taken_at=time.time(),
        taken_at_day=current_day,
        next_payment_day=current_day + settings.days_per_month,
    )
    db.add(loan)
    balance = wallet_service.credit(db, amount)
    db.commit()
    db.refresh(loan)
    notification_service.create(
        db, "bank", f"Prêt de {amount:,.0f}$ accordé — mensualité {loan.monthly_payment:,.0f}$/mois.", current_day
    )
    return True, "Prêt accordé.", {**_to_dict(loan), "balance_usd": balance}


def repay_full(db: Session) -> tuple[bool, str, float]:
    loan = get_active_loan(db)
    if loan is None:
        return False, "Aucun prêt actif.", wallet_service.get_balance(db)

    if not wallet_service.debit(db, loan.balance_owed):
        return False, "Solde insuffisant.", wallet_service.get_balance(db)

    db.delete(loan)
    balance = wallet_service.get_balance(db)
    db.commit()
    notification_service.create(db, "bank", "Prêt remboursé intégralement.", calendar_service.current_day_index(db))
    return True, "Prêt remboursé intégralement.", balance


def process_day(db: Session, day: int) -> None:
    """Charge the monthly installment once `day` reaches the loan's due day.

    If the wallet can't cover it, the payment is simply skipped for this
    cycle and retried next month — no penalty mechanic, keeps this simple.
    """
    loan = get_active_loan(db)
    if loan is None or day < loan.next_payment_day:
        return

    monthly_rate = loan.interest_rate_annual / 12
    interest_portion = loan.balance_owed * monthly_rate
    principal_portion = loan.monthly_payment - interest_portion
    payment = min(loan.monthly_payment, loan.balance_owed + interest_portion)

    if wallet_service.debit(db, payment):
        loan.balance_owed = max(0.0, loan.balance_owed - principal_portion)
        notification_service.create(db, "bank", f"Mensualité de {payment:,.0f}$ prélevée.", day)
    else:
        notification_service.create(
            db, "bank", f"Mensualité de {payment:,.0f}$ impayée — solde insuffisant, reportée au mois prochain.", day
        )

    if loan.balance_owed < 0.01:
        db.delete(loan)
        notification_service.create(db, "bank", "Prêt intégralement remboursé via les mensualités.", day)
    else:
        # Advance regardless of whether the payment went through — a missed
        # payment is simply retried next month, not every day.
        loan.next_payment_day += settings.days_per_month
