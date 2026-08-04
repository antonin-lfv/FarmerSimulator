from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import FireWorkerResponse, HireWorkerResponse, WorkerResponse
from app.services import worker_service

router = APIRouter(prefix="/api/workers", tags=["workers"])


@router.get("", response_model=list[WorkerResponse])
def list_workers(db: Session = Depends(get_db)) -> list[WorkerResponse]:
    return [WorkerResponse(**w) for w in worker_service.get_all_workers_status(db)]


@router.post("/hire", response_model=HireWorkerResponse)
def hire_worker(db: Session = Depends(get_db)) -> HireWorkerResponse:
    worker = worker_service.hire_worker(db)
    return HireWorkerResponse(success=True, message="Worker hired.", worker=WorkerResponse(**worker))


@router.post("/{worker_id}/fire", response_model=FireWorkerResponse)
def fire_worker(worker_id: int, db: Session = Depends(get_db)) -> FireWorkerResponse:
    success, message = worker_service.fire_worker(db, worker_id)
    return FireWorkerResponse(success=success, message=message)
