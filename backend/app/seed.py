import time

from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Accessory,
    Action,
    ActionRequirement,
    Catalog,
    GameState,
    MarketPrice,
    NotificationSettings,
    Pack,
    Parcel,
    TypeSurface,
    Vehicule,
    Wallet,
    Worker,
)

TYPE_SURFACES = ["champ", "forêt", "vigne", "entrepôt"]

WORKERS = [
    ("Ouvrier 1", 50.0),
    ("Ouvrier 2", 50.0),
    ("Ouvrier 3", 50.0),
    ("Ouvrier 4", 50.0),
    ("Ouvrier 5", 50.0),
]

# (parcel_id, superficie, type_surface, prix, parcel_next_action, is_purchased)
# Parcel 7 starts owned so a new game begins with a first field ready to work,
# instead of forcing a purchase before anything else is possible.
STARTING_PARCEL_ID = 7

# Superficie per parcel, measured from map/map.png (pixel area of each plot's
# footprint, scaled so the median champ parcel lands on 10ha) — not a flat
# 10ha everywhere, the plots are visibly different sizes on the map.
CHAMP_HA = {
    7: 14.0, 8: 10.0, 9: 10.5, 10: 17.0, 11: 10.0, 13: 12.0, 14: 32.0, 15: 18.0,
    18: 10.5, 19: 19.5, 20: 6.5, 21: 16.5, 22: 11.0, 23: 14.5, 25: 7.5, 26: 22.0,
    28: 9.0, 29: 6.0, 30: 6.0, 31: 5.5, 32: 10.0, 33: 14.0, 34: 16.0, 35: 10.5,
    37: 5.5, 38: 4.0, 39: 7.0, 40: 3.5, 41: 4.0, 42: 6.0, 43: 7.0, 44: 7.0, 47: 9.0,
}
FORET_HA = {6: 41.5, 16: 45.5, 17: 24.5, 24: 13.5, 27: 5.0, 36: 5.5, 52: 28.5, 53: 6.0}
VIGNE_HA = {1: 3.5, 2: 13.5, 4: 8.0, 5: 15.5, 12: 2.0, 45: 9.5, 46: 8.0, 51: 13.5, 54: 11.5}
# entrepôt: superficie is cosmetic (storage capacity scales with storage_level,
# not surface) but kept proportional to the building footprint on the map.
ENTREPOT_HA = {3: 4.0, 48: 12.0, 49: 10.0, 50: 12.5}

PARCELS = [
    # champ: ~$1,200/ha
    *[(pid, ha, "champ", round(ha * 1_200.0), "labourer") for pid, ha in CHAMP_HA.items()],
    # forêt: ~$700/ha
    *[(pid, ha, "forêt", round(ha * 700.0), "planter des arbres") for pid, ha in FORET_HA.items()],
    # vigne: ~$4,200/ha — vineyards command a premium
    *[(pid, ha, "vigne", round(ha * 4_200.0), "planter des vignes") for pid, ha in VIGNE_HA.items()],
    # entrepôt: $18,000 flat (a building, not per-hectare), no crop cycle
    *[(pid, ha, "entrepôt", 18_000.0, None) for pid, ha in ENTREPOT_HA.items()],
]

# (item_id, category, subcategory, name, price, promotion, img_path)
CATALOG = [
    (1, "vehicules", "tracteur", "Petit tracteur", 28_000.0, 0, "assets/images/small_tractor.png"),
    (2, "vehicules", "tracteur", "Moyen tracteur", 58_000.0, 0, "assets/images/medium_tractor.png"),
    (3, "vehicules", "tracteur", "Grand tracteur", 115_000.0, 0, "assets/images/large_tractor.png"),
    (4, "vehicules", "moissonneuse", "Moissonneuse batteuse", 290_000.0, 0, "assets/images/moissonneuse.png"),
    (5, "vehicules", "ramasse patates", "Arracheuse de patates", 75_000.0, 0, "assets/images/ramasse_patates.png"),
    (6, "vehicules", "ramasse coton", "Récolteuse de coton", 260_000.0, 0, "assets/images/ramasse_coton.png"),
    (7, "vehicules", "véhicule vignes", "Enjambeur", 150_000.0, 0, "assets/images/vehicule_vignes.png"),
    (8, "vehicules", "véhicule bois", "Abatteuse/porteur forestier", 230_000.0, 0, "assets/images/vehicule_bois.png"),
    (10, "accessoires", "benne", "Benne standard", 9_000.0, 0, "assets/images/benne_standard.png"),
    (11, "accessoires", "benne", "Grande benne", 14_000.0, 0, "assets/images/benne_large.png"),
    (12, "accessoires", "coupe de moissonneuse", "Coupe 4 mètres", 28_000.0, 0, "assets/images/coupe_moissonneuse_small.png"),
    (13, "accessoires", "coupe de moissonneuse", "Coupe 8 mètres", 48_000.0, 0, "assets/images/coupe_moissonneuse_medium.png"),
    (14, "accessoires", "coupe de moissonneuse", "Coupe 12 mètres", 68_000.0, 0, "assets/images/coupe_moissonneuse_large.png"),
    (15, "accessoires", "accessoire pour labourer", "Déchaumeur à disques", 6_000.0, 0, "assets/images/accessoire_labourer.png"),
    (16, "accessoires", "accessoire pour semer", "Semoir", 9_000.0, 0, "assets/images/accessoire_semer.png"),
    (17, "accessoires", "accessoire pour engrais", "Épandeur d'engrais", 7_000.0, 0, "assets/images/accessoire_engrais.png"),
    (18, "packs", "graines céréales", "Graines de blés", 90.0, 0, "assets/images/pack.png"),
    (19, "packs", "graines céréales", "Graines de maïs", 180.0, 0, "assets/images/pack.png"),
    (20, "packs", "graines céréales", "Graines d'orge", 85.0, 0, "assets/images/pack.png"),
    (21, "packs", "graines céréales", "Graines de colza", 110.0, 0, "assets/images/pack.png"),
    (22, "packs", "graines raisins", "Graines de raisins", 650.0, 0, "assets/images/pack.png"),
    (23, "packs", "graines coton", "Graines de coton", 160.0, 0, "assets/images/pack.png"),
    (24, "packs", "pousses arbres", "Pousses d'arbres", 220.0, 0, "assets/images/pack.png"),
    (25, "packs", "graines patates", "Graines de patates", 190.0, 0, "assets/images/pack.png"),
    (26, "packs", "engrais", "Engrais", 70.0, 0, "assets/images/pack.png"),
    # Harvested output goods — distinct from the planting-input packs above, so
    # what you get out of a vigne/forêt parcel doesn't read as "more seeds".
    (27, "packs", "bois", "Bois", 120.0, 0, "assets/images/pack.png"),
    (28, "packs", "raisins", "Raisins", 900.0, 0, "assets/images/pack.png"),
    # Extra seed/sapling varieties — same catalog image as the rest of the
    # "graines"/"pousses" family (no dedicated artwork), each with a real
    # growth-speed/resistance/yield trade-off, see app/seed_traits.py.
    (29, "packs", "graines céréales", "Graines d'avoine", 80.0, 0, "assets/images/pack.png"),
    (30, "packs", "graines céréales", "Graines de seigle", 75.0, 0, "assets/images/pack.png"),
    (31, "packs", "graines coton", "Graines de coton Pima", 220.0, 0, "assets/images/pack.png"),
    (32, "packs", "graines coton", "Graines de coton Bio", 240.0, 0, "assets/images/pack.png"),
    (33, "packs", "graines patates", "Graines de patates Charlotte", 150.0, 0, "assets/images/pack.png"),
    (34, "packs", "graines patates", "Graines de patates Vitelotte", 340.0, 0, "assets/images/pack.png"),
    (35, "packs", "graines raisins", "Graines de Cabernet Sauvignon", 900.0, 0, "assets/images/pack.png"),
    (36, "packs", "graines raisins", "Graines de Chardonnay", 850.0, 0, "assets/images/pack.png"),
    (37, "packs", "pousses arbres", "Pousses de chêne", 300.0, 0, "assets/images/pack.png"),
    (38, "packs", "pousses arbres", "Pousses de pin", 160.0, 0, "assets/images/pack.png"),
    # Extra tiers for the three accessory subcategories that only ever had one
    # option — real trade-offs (price vs. action speed), reusing the existing
    # image for their subcategory since no dedicated artwork for these yet.
    (39, "accessoires", "accessoire pour labourer", "Déchaumeur à dents", 4_200.0, 0, "assets/images/accessoire_labourer.png"),
    (40, "accessoires", "accessoire pour semer", "Semoir de précision", 15_000.0, 0, "assets/images/accessoire_semer.png"),
    (41, "accessoires", "accessoire pour engrais", "Épandeur d'engrais grande capacité", 13_000.0, 0, "assets/images/accessoire_engrais.png"),
    # Dedicated frost/heat protection equipment — owning one drops the cost of
    # protecting a parcel from the full contractor call-out fee down to just
    # the running cost.
    (42, "accessoires", "protection gel", "Brasero anti-gel", 900.0, 0, "assets/images/brasero.png"),
    (43, "accessoires", "protection canicule", "Système d'irrigation", 1_400.0, 0, "assets/images/irrigation.png"),
]

# Free starting kit: a small tractor and the three basic field accessories,
# plus a little seed and fertilizer — enough to plow, sow and fertilize the
# starting parcel without spending a cent of the starting cash. Harvesting
# still requires a harvester (bought or rented from a contractor), by design.
STARTING_VEHICULES = [(1, 1)]  # (item_id, amount) — Petit tracteur
STARTING_ACCESSORIES = [(15, 1), (16, 1), (17, 1)]  # labourer, semer, engrais
STARTING_PACKS = [(18, 5), (26, 5)]  # Graines de blés, Engrais

# (action_id, action_type, type_surface, action_time_minutes, next_action)
ACTIONS = [
    (1, "labourer", "champ", 2.0, "semer céréales"),
    (2, "semer céréales", "champ", 1.5, "mettre engrais céréales"),
    (3, "mettre engrais céréales", "champ", 1.0, "récolter céréales"),
    (4, "récolter céréales", "champ", 2.5, "labourer"),
    (5, "semer coton", "champ", 1.5, "mettre engrais coton"),
    (6, "mettre engrais coton", "champ", 1.0, "récolter coton"),
    (7, "récolter coton", "champ", 2.5, "labourer"),
    (8, "semer patates", "champ", 1.5, "mettre engrais patates"),
    (9, "mettre engrais patates", "champ", 1.0, "récolter patates"),
    (10, "récolter patates", "champ", 2.5, "labourer"),
    (11, "planter des arbres", "forêt", 3.0, "couper le bois"),
    (12, "couper le bois", "forêt", 4.0, "planter des arbres"),
    (13, "planter des vignes", "vigne", 2.0, "recolter raisins"),
    (14, "recolter raisins", "vigne", 3.0, "planter des vignes"),
    (15, "stockage", "entrepôt", 1.0, None),
]

# (action_requirements_id, action_id, subcategory, amount)
ACTION_REQUIREMENTS = [
    (1, 1, "tracteur", 1),
    (2, 1, "accessoire pour labourer", 1),
    (3, 2, "graines céréales", 1),
    (4, 2, "accessoire pour semer", 1),
    (5, 2, "tracteur", 1),
    (6, 3, "engrais", 1),
    (7, 3, "tracteur", 1),
    (8, 3, "accessoire pour engrais", 1),
    (9, 4, "moissonneuse", 1),
    (10, 4, "coupe de moissonneuse", 1),
    (11, 4, "tracteur", 1),
    (12, 4, "benne", 1),
    (13, 5, "graines coton", 1),
    (14, 5, "accessoire pour semer", 1),
    (15, 5, "tracteur", 1),
    (16, 6, "engrais", 1),
    (17, 6, "tracteur", 1),
    (18, 6, "accessoire pour engrais", 1),
    (19, 7, "ramasse coton", 1),
    (20, 8, "graines patates", 1),
    (21, 8, "accessoire pour semer", 1),
    (22, 8, "tracteur", 1),
    (23, 9, "engrais", 1),
    (24, 9, "tracteur", 1),
    (25, 9, "accessoire pour engrais", 1),
    (26, 10, "ramasse patates", 1),
    (27, 11, "pousses arbres", 1),
    (28, 11, "tracteur", 1),
    (29, 11, "accessoire pour semer", 1),
    (30, 12, "véhicule bois", 1),
    (31, 13, "graines raisins", 1),
    (32, 13, "tracteur", 1),
    (33, 13, "accessoire pour semer", 1),
    (34, 14, "véhicule vignes", 1),
]

# (category, subcategory, base_price)
MARKET_BASE_PRICES = [
    ("packs", "graines céréales", 110.0),
    ("packs", "graines coton", 160.0),
    ("packs", "graines patates", 190.0),
    ("packs", "graines raisins", 650.0),
    ("packs", "pousses arbres", 220.0),
    ("packs", "engrais", 70.0),
    ("harvest", "céréales", 220.0),
    ("harvest", "coton", 500.0),
    ("harvest", "patates", 180.0),
    ("harvest", "raisins", 900.0),
    ("harvest", "bois", 120.0),
]


def seed_if_empty(db: Session) -> None:
    if db.query(Wallet).count() == 0:
        db.add(Wallet(wallet_id=1, balance_usd=settings.starting_balance_usd))

    if db.query(TypeSurface).count() == 0:
        db.add_all(TypeSurface(type_surface=name) for name in TYPE_SURFACES)
        db.flush()

    if db.query(Worker).count() == 0:
        db.add_all(
            Worker(worker_name=name, worker_price=price, available=True)
            for name, price in WORKERS
        )

    if db.query(Parcel).count() == 0:
        surface_ids = {
            ts.type_surface: ts.type_surface_id
            for ts in db.query(TypeSurface).all()
        }
        db.add_all(
            Parcel(
                parcel_id=pid,
                superficie=superficie,
                type_surface_id=surface_ids[surface_name],
                prix=prix,
                is_purchased=(pid == STARTING_PARCEL_ID),
                parcel_next_action=next_action,
            )
            for pid, superficie, surface_name, prix, next_action in PARCELS
        )

    if db.query(Catalog).count() == 0:
        db.add_all(
            Catalog(
                item_id=item_id,
                category=category,
                subcategory=subcategory,
                name=name,
                price=price,
                promotion=promotion,
                img_path=img_path,
            )
            for item_id, category, subcategory, name, price, promotion, img_path in CATALOG
        )
        db.flush()

    if db.query(Action).count() == 0:
        surface_ids = {
            ts.type_surface: ts.type_surface_id
            for ts in db.query(TypeSurface).all()
        }
        db.add_all(
            Action(
                action_id=action_id,
                action_type=action_type,
                type_surface_id=surface_ids[surface_name],
                action_time=action_time,
                next_action=next_action,
            )
            for action_id, action_type, surface_name, action_time, next_action in ACTIONS
        )
        db.flush()

    if db.query(ActionRequirement).count() == 0:
        db.add_all(
            ActionRequirement(
                action_requirements_id=req_id,
                action_id=action_id,
                subcategory=subcategory,
                amount=amount,
            )
            for req_id, action_id, subcategory, amount in ACTION_REQUIREMENTS
        )

    if db.query(MarketPrice).count() == 0:
        _seed_market_history(db)

    if db.query(Vehicule).count() == 0:
        db.add_all(Vehicule(item_id=item_id, amount=amount, num_available=amount) for item_id, amount in STARTING_VEHICULES)

    if db.query(Accessory).count() == 0:
        db.add_all(Accessory(item_id=item_id, amount=amount, num_available=amount) for item_id, amount in STARTING_ACCESSORIES)

    if db.query(Pack).count() == 0:
        db.add_all(Pack(item_id=item_id, amount=amount) for item_id, amount in STARTING_PACKS)

    if db.query(GameState).count() == 0:
        db.add(GameState(game_state_id=1, epoch_ts=time.time(), last_processed_day=-1))

    if db.query(NotificationSettings).count() == 0:
        db.add(NotificationSettings(notification_settings_id=1))

    db.commit()


def _seed_market_history(db: Session) -> None:
    import random

    from app.services import calendar_service

    current_time = time.time()
    day_in_seconds = calendar_service.day_duration_seconds()

    for day in range(10, 0, -1):
        day_timestamp = current_time - (day * day_in_seconds)
        for category, subcategory, base_price in MARKET_BASE_PRICES:
            if day == 10:
                price = base_price
            else:
                variation = random.uniform(-0.2, 0.2)
                price = base_price * (1 + variation)
                price = max(base_price * 0.6, min(price, base_price * 1.4))
            db.add(
                MarketPrice(
                    item_category=category,
                    item_subcategory=subcategory,
                    price=round(price, 2),
                    timestamp=day_timestamp,
                )
            )
