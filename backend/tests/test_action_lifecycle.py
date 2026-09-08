import time
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Action, Catalog, OngoingAction, Parcel, TypeSurface
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

    def test_fast_clock_caps_an_action_started_with_normal_duration(self) -> None:
        now = time.time()
        self.db.add(
            OngoingAction(
                parcel_id=7,
                action_type="labourer",
                start_time=now - 1,
                end_time=now + 3_600,
                resources_used="[]",
                cost=100,
            )
        )
        self.db.commit()

        with patch.object(action_service.settings, "debug_action_seconds", 10):
            action_service.complete_finished_actions(self.db)

        ongoing = self.db.query(OngoingAction).one()
        self.assertEqual(ongoing.end_time, ongoing.start_time + 10)

    def test_better_equipment_shortens_production_duration(self) -> None:
        catalog_items = [
            (1, "vehicules", "tracteur", "Petit", 28_000),
            (2, "vehicules", "tracteur", "Moyen", 58_000),
            (3, "vehicules", "tracteur", "Grand", 115_000),
            (39, "accessoires", "labour", "Entrée", 4_200),
            (15, "accessoires", "labour", "Premium", 6_000),
        ]
        self.db.add_all(
            Catalog(
                item_id=item_id,
                category=category,
                subcategory=subcategory,
                name=name,
                price=price,
                promotion=0,
                img_path="",
            )
            for item_id, category, subcategory, name, price in catalog_items
        )
        self.db.commit()

        slow_tractor = action_service.equipment_duration_multiplier(
            self.db, "vehicules", "tracteur", 28_000
        )
        fast_tractor = action_service.equipment_duration_multiplier(
            self.db, "vehicules", "tracteur", 115_000
        )
        fast_tool = action_service.equipment_duration_multiplier(
            self.db, "accessoires", "labour", 6_000
        )

        self.assertAlmostEqual(slow_tractor, 1.15)
        self.assertAlmostEqual(fast_tractor, 0.80)
        self.assertAlmostEqual(fast_tool, 0.80)
        self.assertAlmostEqual(2 * 14 * fast_tractor * fast_tool, 17.92)


if __name__ == "__main__":
    unittest.main()
