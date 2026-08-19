import time

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Transaction
from app.services import calendar_service

# Sequential, human-facing invoice numbers for big-ticket purchases — separate
# counter from transaction_id so it reads like a real facture ("FA-000042")
# instead of exposing the raw row id.
_INVOICE_PREFIX = "FA-"


def _next_invoice_number(db: Session) -> str:
    count = db.execute(
        select(func.count()).select_from(Transaction).where(Transaction.is_invoice.is_(True))
    ).scalar_one()
    return f"{_INVOICE_PREFIX}{count + 1:06d}"


def record(
    db: Session,
    *,
    amount: float,
    category: str,
    label: str,
    balance_after: float,
    item_name: str | None = None,
    quantity: int | None = None,
    unit_price: float | None = None,
    invoice: bool = False,
) -> Transaction:
    """Appends one ledger line. Caller is responsible for the db.commit()
    (kept out of here so wallet_service can write the balance change and the
    ledger row in a single transaction)."""
    transaction = Transaction(
        created_at=time.time(),
        game_day=calendar_service.current_day_index(db),
        category=category,
        label=label,
        amount=amount,
        balance_after=balance_after,
        item_name=item_name,
        quantity=quantity,
        unit_price=unit_price,
        is_invoice=invoice,
        invoice_number=_next_invoice_number(db) if invoice else None,
    )
    db.add(transaction)
    db.flush()
    return transaction


def _to_dict(t: Transaction) -> dict:
    parts = calendar_service.calendar_parts(t.game_day)
    return {
        "transaction_id": t.transaction_id,
        "created_at": t.created_at,
        "game_day": t.game_day,
        "date_label": f"{parts['day_of_month']} {calendar_service.MONTH_NAMES_FR[parts['month'] - 1]}",
        "category": t.category,
        "label": t.label,
        "amount": t.amount,
        "balance_after": t.balance_after,
        "item_name": t.item_name,
        "quantity": t.quantity,
        "unit_price": t.unit_price,
        "is_invoice": t.is_invoice,
        "invoice_number": t.invoice_number,
    }


def list_transactions(db: Session, limit: int = 100, category: str | None = None) -> list[dict]:
    query = select(Transaction).order_by(
        Transaction.created_at.desc(), Transaction.transaction_id.desc()
    )
    if category:
        query = query.where(Transaction.category == category)
    rows = db.execute(query.limit(limit)).scalars().all()
    return [_to_dict(t) for t in rows]


def get_transaction(db: Session, transaction_id: int) -> dict | None:
    t = db.get(Transaction, transaction_id)
    return _to_dict(t) if t is not None else None
