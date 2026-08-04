import random
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import OngoingAction, Worker

FIRST_NAMES = [
    "Jean", "Pierre", "Michel", "André", "Philippe", "Alain", "Bernard",
    "Marie", "Monique", "Françoise", "Nicole", "Sylvie", "Catherine",
]
LAST_NAMES = [
    "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Petit", "Durand",
    "Leroy", "Moreau", "Simon", "Lefebvre", "Garcia", "Roux",
]


def get_all_workers_status(db: Session) -> list[dict]:
    current_time = time.time()
    workers = db.execute(select(Worker).order_by(Worker.worker_name)).scalars().all()

    results = []
    for worker in workers:
        ongoing = db.execute(
            select(OngoingAction).where(
                OngoingAction.worker_id == worker.worker_id,
                OngoingAction.end_time > current_time,
            )
        ).scalar_one_or_none()

        if ongoing is not None:
            status = f"En mission: {ongoing.action_type} (Parcelle {ongoing.parcel_id})"
            remaining_minutes = max(0.0, (ongoing.end_time - current_time) / 60)
        else:
            status = "Disponible"
            remaining_minutes = 0.0

        results.append(
            {
                "worker_id": worker.worker_id,
                "worker_name": worker.worker_name,
                "worker_price": worker.worker_price,
                "available": worker.available,
                "status": status,
                "remaining_minutes": remaining_minutes,
            }
        )
    return results


def hire_worker(db: Session) -> dict:
    worker_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    worker_price = round(random.uniform(30.0, 80.0), 2)

    worker = Worker(worker_name=worker_name, worker_price=worker_price, available=True)
    db.add(worker)
    db.commit()
    db.refresh(worker)

    return {
        "worker_id": worker.worker_id,
        "worker_name": worker.worker_name,
        "worker_price": worker.worker_price,
        "available": worker.available,
        "status": "Disponible",
        "remaining_minutes": 0.0,
    }


def fire_worker(db: Session, worker_id: int) -> tuple[bool, str]:
    worker = db.get(Worker, worker_id)
    if worker is None:
        return False, "Ouvrier introuvable."

    current_time = time.time()
    busy = db.execute(
        select(OngoingAction).where(
            OngoingAction.worker_id == worker_id, OngoingAction.end_time > current_time
        )
    ).first()
    if busy is not None:
        return False, "Cet ouvrier est actuellement en mission."

    db.delete(worker)
    db.commit()
    return True, "Ouvrier licencié."
