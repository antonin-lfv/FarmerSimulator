from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import BuyCatalogItemRequest, BuyCatalogItemResponse, CatalogDetailResponse, CatalogItemResponse
from app.services import catalog_detail_service, catalog_service

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("", response_model=list[CatalogItemResponse])
def list_catalog(
    category: str | None = None,
    subcategory: str | None = None,
    db: Session = Depends(get_db),
) -> list[CatalogItemResponse]:
    items = catalog_service.list_catalog(db, category=category, subcategory=subcategory)
    return [CatalogItemResponse(**item) for item in items]


@router.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)) -> list[str]:
    return catalog_service.list_categories(db)


@router.get("/{item_id}/detail", response_model=CatalogDetailResponse)
def get_detail(item_id: int, db: Session = Depends(get_db)) -> CatalogDetailResponse:
    detail = catalog_detail_service.get_detail(db, item_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Article introuvable dans le catalogue.")
    return CatalogDetailResponse(**detail)


@router.post("/{item_id}/buy", response_model=BuyCatalogItemResponse)
def buy_item(
    item_id: int, request: BuyCatalogItemRequest, db: Session = Depends(get_db)
) -> BuyCatalogItemResponse:
    if catalog_service.get_catalog_item(db, item_id) is None:
        raise HTTPException(status_code=404, detail="Article introuvable dans le catalogue.")
    success, message, balance = catalog_service.buy_item(db, item_id, request.quantity)
    return BuyCatalogItemResponse(success=success, message=message, balance_usd=balance)
