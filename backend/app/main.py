from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import (
    actions,
    bank,
    calendar,
    catalog,
    inventory,
    market,
    notifications,
    parcels,
    storage,
    transactions,
    wallet,
)
from app.scheduler import start_scheduler
from app.seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()

    scheduler = start_scheduler()
    try:
        yield
    finally:
        scheduler.shutdown()


app = FastAPI(title="Farmer Simulator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wallet.router)
app.include_router(parcels.router)
app.include_router(actions.router)
app.include_router(catalog.router)
app.include_router(inventory.router)
app.include_router(market.router)
app.include_router(bank.router)
app.include_router(storage.router)
app.include_router(calendar.router)
app.include_router(notifications.router)
app.include_router(transactions.router)
