import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Catalog, FireEvent, GameState, Parcel, TypeSurface, Wallet
from app.services import calendar_service
from app.services import parcel_service


class CalendarLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_accelerated_save_rebases_when_normal_clock_is_restored(self) -> None:
        self.db.add(
            GameState(
                game_state_id=calendar_service.GAME_STATE_ID,
                epoch_ts=1,
                last_processed_day=49_345,
            )
        )
        self.db.commit()

        with patch.object(calendar_service, "current_day_index", return_value=146):
            calendar_service.process_day_tick(self.db)

        state = self.db.get(GameState, calendar_service.GAME_STATE_ID)
        self.assertEqual(state.last_processed_day, 146)

    def test_weather_is_deterministic_and_storms_keep_rain_growth(self) -> None:
        days = [calendar_service.get_weather(day) for day in range(366 * 4)]
        self.assertEqual(days, [calendar_service.get_weather(day) for day in range(366 * 4)])
        self.assertEqual(set(days), {"normal", "pluie", "orage", "gel", "canicule"})
        for weather in ("pluie", "orage"):
            with patch.object(calendar_service, "get_weather", return_value=weather):
                self.assertEqual(calendar_service.growth_multiplier(0), calendar_service.settings.rain_growth_multiplier)

    def test_fire_is_localized_once_and_protection_extinguishes_it(self) -> None:
        self.db.add(TypeSurface(type_surface_id=2, type_surface="forêt"))
        self.db.add(Catalog(item_id=38, category="packs", subcategory="pousses", name="Pin", price=10, promotion=0, img_path=""))
        self.db.add(Wallet(wallet_id=1, balance_usd=5000))
        self.db.flush()
        parcel = Parcel(parcel_id=17, superficie=20, type_surface_id=2, prix=1000, is_purchased=True, parcel_next_action="couper le bois", planted_seed_item_id=38, yield_health=100)
        self.db.add(parcel)
        self.db.commit()
        with patch.object(calendar_service.random, "Random") as rng:
            rng.return_value.random.return_value = 0
            rng.return_value.choice.return_value = parcel
            calendar_service._process_fire(self.db, 150, "pluie")
            self.assertIsNone(self.db.get(FireEvent, 150))
            calendar_service._process_fire(self.db, 150, "canicule")
            self.db.commit()
            calendar_service._process_fire(self.db, 150, "canicule")
        self.assertEqual(parcel.yield_health, 80)
        with patch.object(calendar_service, "current_day_index", return_value=150), patch.object(calendar_service, "get_weather", return_value="canicule"):
            self.assertTrue(parcel_service._parcel_dict(self.db, parcel)["active_fire"])
            success, _, _ = parcel_service.protect_parcel(self.db, parcel)
            self.assertTrue(success)
            after = parcel_service._parcel_dict(self.db, parcel)
            self.assertFalse(after["active_fire"])
            self.assertTrue(after["fire_damage_today"])
        with patch.object(calendar_service, "current_day_index", return_value=151):
            self.assertFalse(parcel_service._parcel_dict(self.db, parcel)["active_fire"])


if __name__ == "__main__":
    unittest.main()
