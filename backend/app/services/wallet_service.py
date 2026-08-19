from sqlalchemy import update
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Wallet
from app.services import transaction_service

WALLET_ID = 1


def get_wallet(db: Session) -> Wallet:
    wallet = db.get(Wallet, WALLET_ID)
    if wallet is None:
        raise RuntimeError("Wallet not initialized")
    return wallet


def get_balance(db: Session) -> float:
    return get_wallet(db).balance_usd


def credit(
    db: Session,
    amount: float,
    category: str = "autre",
    label: str = "Crédit",
    *,
    item_name: str | None = None,
    quantity: int | None = None,
    unit_price: float | None = None,
    invoice: bool = False,
) -> float:
    new_balance = db.execute(
        update(Wallet)
        .where(Wallet.wallet_id == WALLET_ID)
        .values(balance_usd=Wallet.balance_usd + amount)
        .returning(Wallet.balance_usd)
    ).scalar_one()
    transaction_service.record(
        db,
        amount=amount,
        category=category,
        label=label,
        balance_after=new_balance,
        item_name=item_name,
        quantity=quantity,
        unit_price=unit_price,
        invoice=invoice,
    )
    db.commit()
    return new_balance


def debit(
    db: Session,
    amount: float,
    category: str = "autre",
    label: str = "Débit",
    *,
    item_name: str | None = None,
    quantity: int | None = None,
    unit_price: float | None = None,
    invoice: bool = False,
) -> bool:
    # A single conditional UPDATE (balance >= amount) instead of a
    # read-balance-then-write-balance round trip — atomic at the database
    # level, so two concurrent debits can no longer both pass the solvency
    # check and drive the balance negative.
    row = db.execute(
        update(Wallet)
        .where(Wallet.wallet_id == WALLET_ID, Wallet.balance_usd >= amount)
        .values(balance_usd=Wallet.balance_usd - amount)
        .returning(Wallet.balance_usd)
    ).first()
    if row is None:
        return False
    new_balance = row[0]
    transaction_service.record(
        db,
        amount=-amount,
        category=category,
        label=label,
        balance_after=new_balance,
        item_name=item_name,
        quantity=quantity,
        unit_price=unit_price,
        invoice=invoice,
    )
    db.commit()
    return True


def cheat(db: Session) -> float:
    return credit(db, settings.cheat_amount_usd, "triche", "Injection de trésorerie (debug)")
