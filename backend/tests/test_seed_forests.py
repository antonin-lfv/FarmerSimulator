import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Parcel, SeedMigration, TypeSurface
from app.seed import (
    MATURE_FORESTS_MIGRATION,
    STARTING_FOREST_GROWTH,
    STARTING_FOREST_SEED_ITEM_ID,
    seed_if_empty,
)
from app.services import parcel_service


class MatureForestSeedTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def forest_parcels(self) -> list[Parcel]:
        forest_id = (
            self.db.query(TypeSurface)
            .filter(TypeSurface.type_surface == "forêt")
            .one()
            .type_surface_id
        )
        return (
            self.db.query(Parcel)
            .filter(Parcel.type_surface_id == forest_id)
            .order_by(Parcel.parcel_id)
            .all()
        )

    def test_new_game_starts_with_all_forests_mature(self) -> None:
        seed_if_empty(self.db)

        forests = self.forest_parcels()
        self.assertEqual(len(forests), 8)
        self.assertTrue(
            all(parcel.parcel_next_action == "couper le bois" for parcel in forests)
        )
        self.assertTrue(
            all(
                parcel.planted_seed_item_id == STARTING_FOREST_SEED_ITEM_ID
                for parcel in forests
            )
        )
        self.assertTrue(
            all(parcel.growth_progress == STARTING_FOREST_GROWTH for parcel in forests)
        )
        self.assertIsNotNone(self.db.get(SeedMigration, MATURE_FORESTS_MIGRATION))

    def test_upgrade_does_not_regrow_a_harvested_forest(self) -> None:
        seed_if_empty(self.db)
        forest = self.forest_parcels()[0]
        forest.parcel_next_action = "planter des arbres"
        forest.planted_seed_item_id = None
        forest.growth_progress = 0.0
        self.db.commit()

        seed_if_empty(self.db)
        self.db.refresh(forest)

        self.assertEqual(forest.parcel_next_action, "planter des arbres")
        self.assertIsNone(forest.planted_seed_item_id)
        self.assertEqual(forest.growth_progress, 0.0)

    def test_owned_warehouse_exposes_the_next_upgrade_cost(self) -> None:
        seed_if_empty(self.db)
        warehouse_id = (
            self.db.query(TypeSurface)
            .filter(TypeSurface.type_surface == "entrepôt")
            .one()
            .type_surface_id
        )
        warehouse = (
            self.db.query(Parcel)
            .filter(Parcel.type_surface_id == warehouse_id)
            .first()
        )
        assert warehouse is not None
        warehouse.is_purchased = True
        warehouse.storage_level = 3
        self.db.commit()

        response = parcel_service._parcel_dict(self.db, warehouse)

        self.assertEqual(response["storage_upgrade_cost"], 12_000.0)


if __name__ == "__main__":
    unittest.main()
