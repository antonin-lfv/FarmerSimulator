import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import GameState
from app.services import calendar_service


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


if __name__ == "__main__":
    unittest.main()
