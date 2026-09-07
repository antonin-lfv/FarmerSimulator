import time
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Action, OngoingAction, Parcel, TypeSurface
from app.services import action_service


class ActionLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add(TypeSurface(type_surface_id=1, type_surface="champ"))
        self.db.add(
            Parcel(
                parcel_id=7,
                superficie=14,
                type_surface_id=1,
                prix=42_000,
                is_purchased=True,
                parcel_next_action="labourer",
            )
        )
        self.db.add(
            Action(
                action_id=1,
                action_type="labourer",
                type_surface_id=1,
                action_time=2,
                next_action="semer",
            )
        )
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def add_expired_action(self) -> None:
        now = time.time()
        self.db.add(
            OngoingAction(
                parcel_id=7,
                action_type="labourer",
                start_time=now - 10,
                end_time=now - 5,
                resources_used="[]",
                cost=100,
            )
        )
        self.db.commit()

    def test_expired_action_remains_visible_and_blocks_restart_until_committed(self) -> None:
        self.add_expired_action()

        self.assertTrue(action_service._parcel_has_ongoing_action(self.db, 7))
        ongoing = action_service.get_ongoing_actions(self.db)
        self.assertEqual(len(ongoing), 1)
        self.assertEqual(ongoing[0]["progress_percent"], 100)
        self.assertEqual(ongoing[0]["remaining_minutes"], 0)

    def test_completion_advances_parcel_before_action_disappears(self) -> None:
        self.add_expired_action()

        action_service.complete_finished_actions(self.db)

        parcel = self.db.get(Parcel, 7)
        self.assertEqual(parcel.parcel_next_action, "semer")
        self.assertFalse(action_service._parcel_has_ongoing_action(self.db, 7))
        self.assertEqual(action_service.get_ongoing_actions(self.db), [])


if __name__ == "__main__":
    unittest.main()
