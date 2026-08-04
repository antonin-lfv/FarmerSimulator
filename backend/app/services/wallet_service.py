from sqlalchemy.orm import Session

from app.config import settings
from app.models import Wallet

WALLET_ID = 1


def get_wallet(db: Session) -> Wallet:
    wallet = db.get(Wallet, WALLET_ID)
    if wallet is None:
        raise RuntimeError("Wallet not initialized")
    return wallet


def get_balance(db: Session) -> float:
    return get_wallet(db).balance_usd


def credit(db: Session, amount: float) -> float:
    wallet = get_wallet(db)
    wallet.balance_usd += amount
    db.commit()
    return wallet.balance_usd


def debit(db: Session, amount: float) -> bool:
    wallet = get_wallet(db)
    if wallet.balance_usd < amount:
        return False
    wallet.balance_usd -= amount
    db.commit()
    return True


def cheat(db: Session) -> float:
    return credit(db, settings.cheat_amount_usd)
