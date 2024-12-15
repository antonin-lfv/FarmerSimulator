import sqlite3
from sqlite3 import Error
from typing import List, Dict, Any, Optional
import json
import random


def connect_db(db_path: str) -> Optional[sqlite3.Connection]:
    """
    Établit une connexion à la base de données SQLite.

    Parameters:
        db_path (str): Le chemin vers le fichier de base de données SQLite.

    Returns:
        sqlite3.Connection: Objet de connexion SQLite ou None en cas d'échec.
    """
    try:
        conn = sqlite3.connect(db_path)
        return conn
    except Error as e:
        print(f"Erreur de connexion à la base de données: {e}")
        return None


def init_db(db_path: str):
    """
    Initialise la base de données SQLite en créant les tables nécessaires.

    Parameters:
        db_path (str): Le chemin vers le fichier de base de données SQLite.
    """
    try:
        conn = connect_db(db_path)
        if conn is None:
            print("Échec de la connexion à la base de données.")
            return
        cursor = conn.cursor()
        print("Connexion à la base de données réussie.")

        # 1. Table 'wallet'
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS wallet (
                wallet_id INTEGER PRIMARY KEY,
                balance_usd REAL NOT NULL DEFAULT 0
            );
        """
        )

        # 2. Table 'type_surface'
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS type_surface (
                type_surface_id INTEGER PRIMARY KEY,
                type_surface TEXT NOT NULL UNIQUE
            );
        """
        )

        # 3. Table 'parcels'
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS parcels (
                parcel_id INTEGER PRIMARY KEY,
                superficie REAL NOT NULL,
                type_surface_id INTEGER NOT NULL,
                prix REAL NOT NULL,
                is_purchased BOOLEAN NOT NULL DEFAULT 0,
                parcel_next_action TEXT,
                FOREIGN KEY (type_surface_id) REFERENCES type_surface(type_surface_id)
            );
        """
        )

        # 4. Table 'catalog'
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS catalog (
                item_id INTEGER PRIMARY KEY,
                category TEXT NOT NULL,
                subcategory TEXT NOT NULL,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                promotion REAL DEFAULT 0,
                img_path TEXT NOT NULL
            );
        """
        )

        # 5. Table 'vehicules'
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS vehicules (
                vehicle_id INTEGER PRIMARY KEY,
                item_id INTEGER NOT NULL,
                amount INTEGER NOT NULL DEFAULT 0,
                num_available INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (item_id) REFERENCES catalog(item_id)
            );
        """
        )

        # 6. Table 'accessories'
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS accessories (
                accessory_id INTEGER PRIMARY KEY,
                item_id INTEGER NOT NULL,
                amount INTEGER NOT NULL DEFAULT 0,
                num_available INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (item_id) REFERENCES catalog(item_id)
            );
        """
        )

        # 7. Table 'packs'
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS packs (
                pack_id INTEGER PRIMARY KEY,
                item_id INTEGER NOT NULL,
                amount INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (item_id) REFERENCES catalog(item_id)
            );
        """
        )

        # 8. Table 'actions'
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS actions (
                action_id INTEGER PRIMARY KEY,
                action_type TEXT NOT NULL,
                type_surface_id INTEGER NOT NULL,
                action_time REAL NOT NULL,
                next_action TEXT,
                FOREIGN KEY (type_surface_id) REFERENCES type_surface(type_surface_id)
            );
        """
        )

        # 9. Table 'action_requirements'
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS action_requirements (
                action_requirements_id INTEGER PRIMARY KEY,
                action_id INTEGER NOT NULL,
                subcategory TEXT,
                amount INTEGER NOT NULL,
                FOREIGN KEY (action_id) REFERENCES actions(action_id)
            );
        """
        )

        # 10. Table 'workers'
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS workers (
                worker_id INTEGER PRIMARY KEY,
                worker_name TEXT NOT NULL,
                worker_price REAL NOT NULL,
                available BOOLEAN NOT NULL DEFAULT 1
            );
        """
        )

        # 11. Table 'contracts' (ajouté pour suivre les contrats mentionnés précédemment)
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS contracts (
                contract_id INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                reward REAL NOT NULL,
                requirements TEXT -- Stocké en JSON
            );
        """
        )

        # Initialisation des tables avec des données par défaut si nécessaire

        # Initialisation du wallet si vide
        cursor.execute("SELECT COUNT(*) FROM wallet;")
        wallet_count = cursor.fetchone()[0]
        if wallet_count == 0:
            cursor.execute(
                "INSERT INTO wallet (balance_usd) VALUES (1000);"
            )  # Solde initial de 1000 USD
            print("Wallet initial ajouté avec un solde de 1000 USD.")

        # Initialisation des types de surface si vide
        cursor.execute("SELECT COUNT(*) FROM type_surface;")
        type_surface_count = cursor.fetchone()[0]
        if type_surface_count == 0:
            type_surfaces = [("champ",), ("forêt",), ("vigne",), ("entrepôt",)]
            cursor.executemany(
                "INSERT INTO type_surface (type_surface) VALUES (?);", type_surfaces
            )
            print("Types de surface ajoutés avec succès.")

        # Initialisation des workers si vide
        cursor.execute("SELECT COUNT(*) FROM workers;")
        workers_count = cursor.fetchone()[0]
        if workers_count == 0:
            workers = [
                ("Ouvrier 1", 50.0, 1),
                ("Ouvrier 2", 50.0, 1),
                ("Ouvrier 3", 50.0, 1),
                ("Ouvrier 4", 50.0, 1),
                ("Ouvrier 5", 50.0, 1),
            ]
            cursor.executemany(
                """
                INSERT INTO workers (worker_name, worker_price, available)
                VALUES (?, ?, ?);
            """,
                workers,
            )
            print("Ouvriers initiaux ajoutés avec succès.")

        # Commit des changements et fermeture de la connexion
        conn.commit()
        print("Tables créées et données initiales insérées avec succès.")
    except Error as e:
        print(f"Erreur lors de l'initialisation de la base de données: {e}")
    finally:
        if conn:
            conn.close()
            print("Connexion à la base de données fermée.")


def populate_db(db_path: str):
    """
    Peuplement initial de la base de données SQLite avec des données réalistes.

    Parameters:
        db_path (str): Le chemin vers le fichier de base de données SQLite.
    """
    try:
        conn = connect_db(db_path)
        if conn is None:
            print("Échec de la connexion à la base de données.")
            return
        cursor = conn.cursor()
        print("Connexion à la base de données réussie pour le peuplement initial.")

        # 1. Peupler la table 'parcels'
        # Récupérer les type_surface_id pour référence
        cursor.execute("SELECT type_surface_id, type_surface FROM type_surface;")
        type_surfaces = {row[1]: row[0] for row in cursor.fetchall()}

        parcels_data = [
            # Parcelles de type 'champ' (7, 8, 9, 10, 11, 13, 14, 15, 18, 19, 20, 21, 22, 23, 25, 26, 28, 29, 30, 31, 32, 33, 34, 35, 37, 38, 39, 40, 41, 42, 43, 44, 47)
            (7, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (8, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (9, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (10, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (11, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (13, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (14, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (15, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (18, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (19, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (20, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (21, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (22, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (23, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (25, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (26, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (28, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (29, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (30, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (31, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (32, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (33, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (34, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (35, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (37, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (38, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (39, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (40, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (41, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (42, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (43, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (44, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            (47, 10.0, type_surfaces["champ"], 1000.0, 0, "labourer"),
            # Parcelles de type 'forêt' (6, 16, 17, 24, 27, 36, 52, 53)
            (6, 10.0, type_surfaces["forêt"], 1500.0, 0, "planter des arbres"),
            (16, 10.0, type_surfaces["forêt"], 1500.0, 0, "planter des arbres"),
            (17, 10.0, type_surfaces["forêt"], 1500.0, 0, "planter des arbres"),
            (24, 10.0, type_surfaces["forêt"], 1500.0, 0, "planter des arbres"),
            (27, 10.0, type_surfaces["forêt"], 1500.0, 0, "planter des arbres"),
            (36, 10.0, type_surfaces["forêt"], 1500.0, 0, "planter des arbres"),
            (52, 10.0, type_surfaces["forêt"], 1500.0, 0, "planter des arbres"),
            (53, 10.0, type_surfaces["forêt"], 1500.0, 0, "planter des arbres"),
            # Parcelles de type 'vigne' (1, 2, 4, 5, 12, 45, 46, 51, 54)
            (1, 10.0, type_surfaces["vigne"], 1200.0, 0, "planter des vignes"),
            (2, 10.0, type_surfaces["vigne"], 1200.0, 0, "planter des vignes"),
            (4, 10.0, type_surfaces["vigne"], 1200.0, 0, "planter des vignes"),
            (5, 10.0, type_surfaces["vigne"], 1200.0, 0, "planter des vignes"),
            (12, 10.0, type_surfaces["vigne"], 1200.0, 0, "planter des vignes"),
            (45, 10.0, type_surfaces["vigne"], 1200.0, 0, "planter des vignes"),
            (46, 10.0, type_surfaces["vigne"], 1200.0, 0, "planter des vignes"),
            (51, 10.0, type_surfaces["vigne"], 1200.0, 0, "planter des vignes"),
            (54, 10.0, type_surfaces["vigne"], 1200.0, 0, "planter des vignes"),
            # Parcelles de type 'entrepôt' (3, 48, 49, 50)
            (3, 10.0, type_surfaces["entrepôt"], 2000.0, 0, None),
            (48, 10.0, type_surfaces["entrepôt"], 2000.0, 0, None),
            (49, 10.0, type_surfaces["entrepôt"], 2000.0, 0, None),
            (50, 10.0, type_surfaces["entrepôt"], 2000.0, 0, None),
        ]
        cursor.executemany(
            """
            INSERT INTO parcels (parcel_id, superficie, type_surface_id, prix, is_purchased, parcel_next_action)
            VALUES (?, ?, ?, ?, ?, ?);
        """,
            parcels_data,
        )
        print("Parcelles ajoutées avec succès.")

        # 2. Peupler la table 'catalog'
        catalog_data = [
            # Véhicules
            (
                1,
                "vehicules",
                "tracteur",
                "Petit tracteur",
                5000.0,
                0,
                "assets/images/small_tractor.png",
            ),
            (
                2,
                "vehicules",
                "tracteur",
                "Moyen tracteur",
                8000.0,
                0,
                "assets/images/medium_tractor.png",
            ),
            (
                3,
                "vehicules",
                "tracteur",
                "Grand tracteur",
                12000.0,
                0,
                "assets/images/large_tractor.png",
            ),
            (
                4,
                "vehicules",
                "moissonneuse",
                "Moissonneuse batteuse",
                15000.0,
                0,
                "assets/images/moissonneuse.png",
            ),
            (
                5,
                "vehicules",
                "ramasse patates",
                "Arracheuse de patates",
                7000.0,
                0,
                "assets/images/ramasse_patates.png",
            ),
            (
                6,
                "vehicules",
                "ramasse coton",
                "Récolteuse de coton",
                7500.0,
                0,
                "assets/images/ramasse_coton.png",
            ),
            (
                7,
                "vehicules",
                "véhicule vignes",
                "Enjambeur",
                9000.0,
                0,
                "assets/images/vehicule_vignes.png",
            ),
            (
                8,
                "vehicules",
                "véhicule bois",
                "Abatteuse/porteur forestier",
                8500.0,
                0,
                "assets/images/vehicule_bois.png",
            ),
            # Accessoires
            (
                10,
                "accessoires",
                "benne",
                "Benne standard",
                1500.0,
                0,
                "assets/images/benne_standard.png",
            ),
            (
                11,
                "accessoires",
                "benne",
                "Grande benne",
                2000.0,
                0,
                "assets/images/benne_large.png",
            ),
            (
                12,
                "accessoires",
                "coupe de moissonneuse",
                "Coupe 4 mètres",
                3000.0,
                0,
                "assets/images/coupe_moissonneuse_small.png",
            ),
            (
                13,
                "accessoires",
                "coupe de moissonneuse",
                "Coupe 8 mètres",
                4000.0,
                0,
                "assets/images/coupe_moissonneuse_medium.png",
            ),
            (
                14,
                "accessoires",
                "coupe de moissonneuse",
                "Coupe 12 mètres",
                5000.0,
                0,
                "assets/images/coupe_moissonneuse_large.png",
            ),
            (
                15,
                "accessoires",
                "accessoire pour labourer",
                "Déchaumeur à disques",
                1200.0,
                0,
                "assets/images/accessoire_labourer.png",
            ),
            (
                16,
                "accessoires",
                "accessoire pour semer",
                "Semoir",
                1300.0,
                0,
                "assets/images/accessoire_semer.png",
            ),
            (
                17,
                "accessoires",
                "accessoire pour engrais",
                "Épandeur d'engrais",
                1400.0,
                0,
                "assets/images/accessoire_engrais.png",
            ),
            # Packs
            (
                18,
                "packs",
                "graines céréales",
                "Graines de blés",
                100.0,
                0,
                "assets/images/pack.png",
            ),
            (
                19,
                "packs",
                "graines céréales",
                "Graines de maïs",
                100.0,
                0,
                "assets/images/pack.png",
            ),
            (
                20,
                "packs",
                "graines céréales",
                "Graines d'orge",
                100.0,
                0,
                "assets/images/pack.png",
            ),
            (
                21,
                "packs",
                "graines céréales",
                "Graines de colza",
                100.0,
                0,
                "assets/images/pack.png",
            ),
            (
                22,
                "packs",
                "graines raisins",
                "Graines de raisins",
                100.0,
                0,
                "assets/images/pack.png",
            ),
            (
                23,
                "packs",
                "graines coton",
                "Graines de coton",
                100.0,
                0,
                "assets/images/pack.png",
            ),
            (
                24,
                "packs",
                "pousses arbres",
                "Pousses d'arbres",
                100.0,
                0,
                "assets/images/pack.png",
            ),
            (
                25,
                "packs",
                "graines patates",
                "Graines de patates",
                100.0,
                0,
                "assets/images/pack.png",
            ),
            (26, "packs", "engrais", "Engrais", 100.0, 0, "assets/images/pack.png"),
        ]
        cursor.executemany(
            """
            INSERT INTO catalog (item_id, category, subcategory, name, price, promotion, img_path)
            VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
            catalog_data,
        )
        print("Catalogue ajouté avec succès.")

        # 3. Peupler la table 'actions'
        # Récupérer type_surface_id pour référence
        cursor.execute("SELECT type_surface_id, type_surface FROM type_surface;")
        type_surfaces = {row[1]: row[0] for row in cursor.fetchall()}

        actions_data = [
            # Actions pour 'champ'
            (1, "labourer", type_surfaces["champ"], 2.0, "semer céréales"),
            (
                2,
                "semer céréales",
                type_surfaces["champ"],
                1.5,
                "mettre engrais céréales",
            ),
            (
                3,
                "mettre engrais céréales",
                type_surfaces["champ"],
                1.0,
                "récolter céréales",
            ),
            (4, "récolter céréales", type_surfaces["champ"], 2.5, "labourer"),
            (5, "semer coton", type_surfaces["champ"], 1.5, "mettre engrais coton"),
            (6, "mettre engrais coton", type_surfaces["champ"], 1.0, "récolter coton"),
            (7, "récolter coton", type_surfaces["champ"], 2.5, "labourer"),
            (8, "semer patates", type_surfaces["champ"], 1.5, "mettre engrais patates"),
            (
                9,
                "mettre engrais patates",
                type_surfaces["champ"],
                1.0,
                "récolter patates",
            ),
            (10, "récolter patates", type_surfaces["champ"], 2.5, "labourer"),
            # Actions pour 'forêt'
            (11, "planter des arbres", type_surfaces["forêt"], 3.0, "couper le bois"),
            (12, "couper le bois", type_surfaces["forêt"], 4.0, "planter des arbres"),
            # Actions pour 'vigne'
            (
                13,
                "planter des vignes",
                type_surfaces["vigne"],
                2.0,
                "recolter raisins",
            ),
            (
                14,
                "recolter raisins",
                type_surfaces["vigne"],
                3.0,
                "planter des vignes",
            ),
            # Actions pour 'entrepôt'
            (15, "stockage", type_surfaces["entrepôt"], 1.0, None),
        ]
        cursor.executemany(
            """
            INSERT INTO actions (action_id, action_type, type_surface_id, action_time, next_action)
            VALUES (?, ?, ?, ?, ?);
        """,
            actions_data,
        )
        print("Actions ajoutées avec succès.")

        # 4. Peupler la table 'action_requirements'
        # Les graines seront calculées en fonction de la superficie de la parcelle
        # Le nombre d'ouvriers sera calculé en fonction du nombre de véhicules nécessaires
        # Chaque action nécessite certains items spécifiques
        action_requirements_data = [
            # Labourer nécessite tracteur, accessoire pour labourer
            (1, 1, "tracteur", 1),
            (2, 1, "accessoire pour labourer", 1),
            # Semer céréales nécessite graines blés, accessoire pour semer et tracteur
            (3, 2, "graines céréales", 1),
            (4, 2, "accessoire pour semer", 1),
            (5, 2, "tracteur", 1),
            # Mettre engrais céréales nécessite engrais, tracteur et accessoire pour engrais
            (6, 3, "engrais", 1),
            (7, 3, "tracteur", 1),
            (8, 3, "accessoire pour engrais", 1),
            # Récolter céréales nécessite moissonneuse, coupe, tracteur et benne
            (9, 4, "moissonneuse", 1),
            (10, 4, "coupe de moissonneuse", 1),
            (11, 4, "tracteur", 1),
            (12, 4, "benne", 1),
            # Semer coton
            (13, 5, "graines coton", 1),
            (14, 5, "accessoire pour semer", 1),
            (15, 5, "tracteur", 1),
            # Mettre engrais coton
            (16, 6, "engrais", 1),
            (17, 6, "tracteur", 1),
            (18, 6, "accessoire pour engrais", 1),
            # Récolter coton
            (19, 7, "ramasse coton", 1),
            # Semer patates
            (20, 8, "graines patates", 1),
            (21, 8, "accessoire pour semer", 1),
            (22, 8, "tracteur", 1),
            # Mettre engrais patates
            (23, 9, "engrais", 1),
            (24, 9, "tracteur", 1),
            (25, 9, "accessoire pour engrais", 1),
            # Récolter patates
            (26, 10, "ramasse patates", 1),
            # Planter des arbres
            (27, 11, "pousses arbres", 1),
            (28, 11, "tracteur", 1),
            (29, 11, "accessoire pour semer", 1),
            # Couper le bois
            (30, 12, "véhicule bois", 1),
            # Planter des vignes
            (31, 13, "graines raisins", 1),
            (32, 13, "tracteur", 1),
            (33, 13, "accessoire pour semer", 1),
            # Récolter raisins
            (34, 14, "ramasse raisins", 1),
        ]
        cursor.executemany(
            """
            INSERT INTO action_requirements (action_requirements_id, action_id, subcategory, amount)
            VALUES (?, ?, ?, ?);
        """,
            action_requirements_data,
        )
        print("Action requirements ajoutés avec succès.")

        # 5. Peupler la table 'contracts'
        contracts_data = [
            (
                1,
                "Récolte de maïs sur le champ 7",
                500.0,
                json.dumps({"action_type": "récolter céréales", "parcel_id": 7}),
            ),
            (
                2,
                "Couper le bois dans la forêt 6",
                750.0,
                json.dumps({"action_type": "couper le bois", "parcel_id": 6}),
            ),
            (
                3,
                "Récolte des raisins sur la vigne 1",
                600.0,
                json.dumps({"action_type": "tailler les vignes", "parcel_id": 1}),
            ),
            (
                4,
                "Stockage dans l'entrepôt 3",
                300.0,
                json.dumps({"action_type": "stockage", "parcel_id": 3}),
            ),
        ]
        cursor.executemany(
            """
            INSERT INTO contracts (contract_id, description, reward, requirements)
            VALUES (?, ?, ?, ?);
        """,
            contracts_data,
        )
        print("Contrats ajoutés avec succès.")

        # 6. Peupler la table 'workers'
        # Supposons que les ouvriers sont déjà initialisés dans init_db avec 5 ouvriers
        # Vous pouvez ajouter des ouvriers supplémentaires ici si nécessaire
        # Exemple d'ajout de 2 ouvriers supplémentaires
        workers_additional = [("Ouvrier 6", 50.0, 1), ("Ouvrier 7", 50.0, 1)]
        cursor.executemany(
            """
            INSERT INTO workers (worker_name, worker_price, available)
            VALUES (?, ?, ?);
        """,
            workers_additional,
        )
        print("Ouvriers supplémentaires ajoutés avec succès.")

        # Commit des changements et fermeture de la connexion
        conn.commit()
        print("Base de données peuplée avec succès.")
    except Error as e:
        print(f"Erreur lors du peuplement de la base de données: {e}")
    finally:
        if conn:
            conn.close()
            print("Connexion à la base de données fermée après le peuplement.")


def get_possible_actions(db_path: str, parcel_id: int) -> List[Dict[str, Any]]:
    """
    Récupère les actions possibles pour une parcelle donnée en fonction de son état actuel.

    Parameters:
        db_path (str): Chemin vers le fichier de base de données SQLite.
        parcel_id (int): ID de la parcelle.

    Returns:
        List[Dict[str, Any]]: Liste des actions possibles avec leurs détails.
    """
    conn = connect_db(db_path)
    if conn is None:
        return []

    try:
        cursor = conn.cursor()
        # Récupérer le type_surface_id et le parcel_next_action de la parcelle
        cursor.execute(
            """
            SELECT type_surface_id, parcel_next_action FROM parcels WHERE parcel_id = ?;
        """,
            (parcel_id,),
        )
        row = cursor.fetchone()
        if row is None:
            print(f"Parcelle avec parcel_id={parcel_id} non trouvée.")
            return []
        type_surface_id, parcel_next_action = row

        if not parcel_next_action:
            print(f"La parcelle {parcel_id} n'a pas d'action suivante définie.")
            return []

        # Récupérer l'action correspondante à parcel_next_action pour ce type_surface_id
        cursor.execute(
            """
            SELECT action_id, action_type, action_time, next_action
            FROM actions
            WHERE type_surface_id = ? AND action_type = ?;
        """,
            (type_surface_id, parcel_next_action),
        )
        action = cursor.fetchone()

        if action is None:
            print(f"Aucune action correspondante trouvée pour la parcelle {parcel_id}.")
            return []

        action_id, action_type, action_time, next_action = action

        # Récupérer les exigences pour cette action
        cursor.execute(
            """
            SELECT ar.subcategory, ar.amount
            FROM action_requirements ar
            WHERE ar.action_id = ?;
        """,
            (action_id,),
        )
        requirements = cursor.fetchall()

        requirements_list = []
        for req in requirements:
            requirements_list.append({"subcategory": req[0], "amount": req[1]})

        action_details = {
            "action_id": action_id,
            "action_type": action_type,
            "action_time": action_time,
            "next_action": next_action,
            "requirements": requirements_list,
        }

        return [action_details]

    except Error as e:
        print(f"Erreur lors de la récupération des actions possibles: {e}")
        return []
    finally:
        conn.close()


def check_user_resources(
    db_path: str,
    selected_requirements: Dict[str, Dict[str, Any]],
) -> bool:
    """
    Vérifie si l'utilisateur possède suffisamment de ressources pour effectuer l'action.

    Parameters:
        db_path (str): Chemin vers la base de données SQLite.
        selected_requirements (Dict[str, Dict[str, Any]]): Exigences sélectionnées par l'utilisateur avec les quantités ajustées.

    Returns:
        bool: True si l'utilisateur possède toutes les ressources nécessaires, False sinon.
    """
    inventory = get_user_inventory(db_path)
    inventory_dict = {item["item_id"]: item for item in inventory}

    for subcategory, selected_item in selected_requirements.items():
        amount_required = selected_item["amount"]
        item_id = selected_item["item_id"]
        if item_id not in inventory_dict:
            return False
        owned_amount = inventory_dict[item_id]["amount"]
        if owned_amount < amount_required:
            return False
    return True


def perform_action(
    db_path: str,
    parcel_id: int,
    action: Dict[str, Any],
    selected_requirements: Dict[str, Dict[str, Any]],
) -> bool:
    """
    Effectue l'action sur la parcelle donnée en consommant les ressources nécessaires et en mettant à jour l'état de la parcelle.

    Parameters:
        db_path (str): Chemin vers la base de données SQLite.
        parcel_id (int): ID de la parcelle.
        action (Dict[str, Any]): Détails de l'action à effectuer.
        selected_requirements (Dict[str, Dict[str, Any]]): Exigences sélectionnées par l'utilisateur.

    Returns:
        bool: True si l'action a été effectuée avec succès, False sinon.
    """
    conn = connect_db(db_path)
    if conn is None:
        return False

    try:
        cursor = conn.cursor()

        # 1. Consommer les ressources nécessaires
        for subcategory, selected_item in selected_requirements.items():
            item_id = selected_item["item_id"]
            amount_required = selected_item["amount"]
            category = selected_item["category"]

            # Décrémenter la quantité possédée dans la table appropriée
            cursor.execute(
                "SELECT category FROM catalog WHERE item_id = ?;", (item_id,)
            )
            category_row = cursor.fetchone()
            if category_row is None:
                print(f"Item avec item_id={item_id} non trouvé dans le catalogue.")
                return False
            category = category_row[0]

            if category == "packs":
                cursor.execute(
                    """
                    UPDATE packs
                    SET amount = amount - ?
                    WHERE item_id = ?;
                """,
                    (amount_required, item_id),
                )

        # 2. Ajouter des packs si l'action est une récolte
        if "récolter" in action["action_type"].lower():
            # Récupérer la superficie de la parcelle
            cursor.execute(
                """
                SELECT superficie FROM parcels WHERE parcel_id = ?;
            """,
                (parcel_id,),
            )
            row = cursor.fetchone()
            superficie = row[0]

            # Pour chaque pack à ajouter, déterminer le subcategory et ajouter des packs
            # Ici, nous supposons que les packs ajoutés sont liés aux subcategories des requirements
            for subcategory, selected_item in selected_requirements.items():
                category = selected_item["category"]
                if category.lower() == "packs":
                    # Générer un nombre aléatoire de packs par hectare
                    packs_per_hectare = random.randint(2, 5)
                    total_packs = packs_per_hectare * superficie

                    item_id = selected_item["item_id"]

                    # Ajouter les packs à l'inventaire de l'utilisateur
                    cursor.execute(
                        """
                        UPDATE packs
                        SET amount = amount + ?
                        WHERE item_id = ?;
                    """,
                        (total_packs, item_id),
                    )
                    print(
                        f"Ajout de {total_packs} packs de {subcategory} à l'inventaire."
                    )

        # Mettre à jour l'état de la parcelle (définir la prochaine action)
        cursor.execute(
            """
            UPDATE parcels
            SET parcel_next_action = ?
            WHERE parcel_id = ?;
        """,
            (action["next_action"], parcel_id),
        )

        conn.commit()
        print("Action effectuée avec succès.")
        return True
    except Error as e:
        print(f"Erreur lors de l'exécution de l'action: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


# ==== Map


def get_parcel_info(db_path: str, parcel_id: int) -> Dict[str, Any]:
    """
    Récupère les informations de la parcelle spécifiée.

    Parameters:
        db_path (str): Chemin vers le fichier de base de données SQLite.
        parcel_id (int): ID de la parcelle.

    Returns:
        Dict[str, Any]: Détails de la parcelle.
    """
    conn = connect_db(db_path)
    if conn is None:
        return {}

    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT p.superficie, ts.type_surface, p.prix, p.is_purchased
        FROM parcels p
        JOIN type_surface ts ON p.type_surface_id = ts.type_surface_id
        WHERE p.parcel_id = ?;
    """,
        (parcel_id,),
    )
    row = cursor.fetchone()
    conn.close()

    if row is None:
        print(f"Parcelle avec parcel_id={parcel_id} non trouvée.")
        return {}

    parcel_info = {
        "superficie": row[0],
        "type_surface": row[1],
        "prix": row[2],
        "is_purchased": row[3],
    }

    return parcel_info


def buy_parcel(db_path: str, parcel_id: int) -> bool:
    """
    Achète la parcelle spécifiée.

    Parameters:
        db_path (str): Chemin vers le fichier de base de données SQLite.
        parcel_id (int): ID de la parcelle à acheter.

    Returns:
        bool: True si l'achat a été effectué avec succès, False sinon.
    """
    conn = connect_db(db_path)
    if conn is None:
        return False

    try:
        cursor = conn.cursor()

        # test si l'utilisateur a assez d'argent
        cursor.execute(
            """
            SELECT prix FROM parcels WHERE parcel_id = ?;
        """,
            (parcel_id,),
        )
        prix = cursor.fetchone()[0]
        cursor.execute(
            """
            SELECT balance_usd FROM wallet;
        """
        )
        money = cursor.fetchone()[0]
        if money < prix:
            return {
                "success": False,
                "message": "Vous n'avez pas assez d'argent pour acheter cette parcelle.",
            }

        cursor.execute(
            """
            UPDATE parcels
            SET is_purchased = 1
            WHERE parcel_id = ?;
        """,
            (parcel_id,),
        )
        conn.commit()
        return {"success": True, "message": "Parcelle achetée avec succès."}
    except Error as e:
        print(f"Erreur lors de l'achat de la parcelle: {e}")
        conn.rollback()
        return {"success": False, "message": "Erreur lors de l'achat de la parcelle."}
    finally:
        conn.close()


# ==== Shop and inventory


def get_items_by_subcategory(db_path: str, subcategory: str) -> List[Dict[str, Any]]:
    """
    Récupère les items du catalogue pour une sous-catégorie spécifique, incluant la quantité disponible.

    Parameters:
        db_path (str): Chemin vers le fichier de base de données SQLite.
        subcategory (str): La sous-catégorie des items à récupérer.

    Returns:
        List[Dict[str, Any]]: Liste des items dans la sous-catégorie spécifiée avec la quantité disponible.
    """
    conn = connect_db(db_path)
    if conn is None:
        return []

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT 
                c.item_id, 
                c.name, 
                c.price, 
                c.promotion, 
                c.img_path, 
                c.category,
                v.amount AS vehicules_amount,
                a.amount AS accessories_amount,
                p.amount AS packs_amount
            FROM catalog c
            LEFT JOIN vehicules v ON c.item_id = v.item_id
            LEFT JOIN accessories a ON c.item_id = a.item_id
            LEFT JOIN packs p ON c.item_id = p.item_id
            WHERE c.subcategory = ?
            ORDER BY c.price ASC;
        """,
            (subcategory,),
        )
        rows = cursor.fetchall()

        items = []
        for row in rows:
            (
                item_id,
                name,
                price,
                promotion,
                img_path,
                category,
                vehicules_amount,
                accessories_amount,
                packs_amount,
            ) = row

            # Déterminer la quantité en fonction de la catégorie
            if category == "vehicules":
                amount = vehicules_amount if vehicules_amount else 0
            elif category == "accessoires":
                amount = accessories_amount if accessories_amount else 0
            elif category == "packs":
                amount = packs_amount if packs_amount else 0
            else:
                amount = 0  # Valeur par défaut si catégorie non reconnue

            items.append(
                {
                    "item_id": item_id,
                    "name": name,
                    "price": price,
                    "promotion": promotion,
                    "img_path": img_path,
                    "category": category,
                    "amount": amount,
                }
            )
        return items
    except Error as e:
        print(f"Erreur lors de la récupération des items par sous-catégorie: {e}")
        return []
    finally:
        conn.close()


def get_catalog(db_path: str) -> List[Dict[str, Any]]:
    """
    Récupère tous les éléments du catalogue.

    Parameters:
        db_path (str): Le chemin vers le fichier de base de données SQLite.

    Returns:
        List[Dict[str, Any]]: Liste des éléments du catalogue sous forme de dictionnaires.
    """
    conn = connect_db(db_path)
    if conn is None:
        return []

    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT item_id, category, subcategory, price, promotion, img_path 
        FROM catalog 
        ORDER BY category, subcategory;
    """
    )
    rows = cursor.fetchall()
    conn.close()

    catalog = []
    for row in rows:
        catalog.append(
            {
                "item_id": row[0],
                "category": row[1],
                "subcategory": row[2],
                "price": row[3],
                "promotion": row[4],
                "img_path": row[5],
            }
        )

    return catalog


def get_categories(db_path: str) -> List[str]:
    """
    Récupère la liste unique des catégories dans le catalogue.

    Parameters:
        db_path (str): Le chemin vers le fichier de base de données SQLite.

    Returns:
        List[str]: Liste des catégories uniques.
    """
    conn = connect_db(db_path)
    if conn is None:
        return []

    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT category FROM catalog ORDER BY item_id;")
    rows = cursor.fetchall()
    conn.close()

    categories = [row[0] for row in rows]
    return categories


def get_subcategories(db_path: str, category: str) -> List[str]:
    """
    Récupère la liste unique des sous-catégories dans une catégorie spécifique du catalogue.

    Parameters:
        db_path (str): Le chemin vers le fichier de base de données SQLite.
        category (str): La catégorie dont on veut les sous-catégories.

    Returns:
        List[str]: Liste des sous-catégories uniques dans la catégorie spécifiée.
    """
    conn = connect_db(db_path)
    if conn is None:
        return []

    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT DISTINCT subcategory FROM catalog 
        WHERE category = ? 
        ORDER BY subcategory;
    """,
        (category,),
    )
    rows = cursor.fetchall()
    conn.close()

    subcategories = [row[0] for row in rows]
    return subcategories


def get_catalog_by_category(db_path: str, category: str) -> List[Dict[str, Any]]:
    """
    Récupère les éléments du catalogue pour une catégorie spécifique.

    Parameters:
        db_path (str): Le chemin vers le fichier de base de données SQLite.
        category (str): La catégorie des éléments à récupérer.

    Returns:
        List[Dict[str, Any]]: Liste des éléments du catalogue dans la catégorie spécifiée.
    """
    conn = connect_db(db_path)
    if conn is None:
        return []

    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT item_id, category, subcategory, price, promotion, img_path , name
        FROM catalog 
        WHERE category = ? 
        ORDER BY price ASC;
    """,
        (category,),
    )
    rows = cursor.fetchall()
    conn.close()

    catalog = []
    for row in rows:
        catalog.append(
            {
                "item_id": row[0],
                "category": row[1],
                "subcategory": row[2],
                "price": row[3],
                "promotion": row[4],
                "img_path": row[5],
                "name": row[6],
            }
        )

    return catalog


def get_wallet_balance(db_path: str) -> Optional[float]:
    """
    Récupère le solde actuel du wallet de l'utilisateur.

    Parameters:
        db_path (str): Le chemin vers le fichier de base de données SQLite.

    Returns:
        Optional[float]: Solde en USD ou None en cas d'échec.
    """
    conn = connect_db(db_path)
    if conn is None:
        return None

    cursor = conn.cursor()
    cursor.execute("SELECT balance_usd FROM wallet WHERE wallet_id = 1;")
    row = cursor.fetchone()
    conn.close()

    if row:
        return row[0]
    return None


def add_transaction(
    db_path: str, wallet_id: int, item_id: int, quantity: int = 1
) -> bool:
    """
    Ajoute une transaction d'achat à la base de données en mettant à jour directement les tables de catégories.

    Parameters:
        db_path (str): Le chemin vers le fichier de base de données SQLite.
        wallet_id (int): ID du wallet de l'utilisateur.
        item_id (int): ID de l'article acheté.
        quantity (int, optional): Quantité achetée. Defaults to 1.

    Returns:
        bool: True si la transaction a réussi, False sinon.
    """
    conn = connect_db(db_path)
    if conn is None:
        return False

    try:
        cursor = conn.cursor()
        # Récupérer le prix, la promotion et la catégorie de l'article
        cursor.execute(
            "SELECT price, promotion, category FROM catalog WHERE item_id = ?;",
            (item_id,),
        )
        row = cursor.fetchone()
        if row is None:
            print("Article non trouvé dans le catalogue.")
            return False
        price, promotion, category = row
        final_price = price * (1 - promotion) * quantity

        # Vérifier le solde
        cursor.execute(
            "SELECT balance_usd FROM wallet WHERE wallet_id = ?;", (wallet_id,)
        )
        wallet = cursor.fetchone()
        if wallet is None:
            print("Wallet non trouvé.")
            return False
        balance = wallet[0]
        if balance < final_price:
            print("Solde insuffisant.")
            return False

        # Mettre à jour le solde
        cursor.execute(
            """
            UPDATE wallet 
            SET balance_usd = balance_usd - ? 
            WHERE wallet_id = ?;
        """,
            (final_price, wallet_id),
        )

        # Mettre à jour la disponibilité et l'ownership dans les tables correspondantes
        if category == "vehicules":
            # Vérifier si l'utilisateur possède déjà ce véhicule
            cursor.execute(
                "SELECT amount FROM vehicules WHERE item_id = ?;", (item_id,)
            )
            vehicle = cursor.fetchone()
            if vehicle:
                current_amount = vehicle[0]
                cursor.execute(
                    """
                    UPDATE vehicules
                    SET amount = amount + ?
                    WHERE item_id = ?;
                """,
                    (quantity, item_id),
                )
            else:
                # Ajouter une nouvelle entrée dans vehicules
                cursor.execute(
                    """
                    INSERT INTO vehicules (item_id, amount, num_available)
                    VALUES (?, ?, 0);
                """,
                    (item_id, quantity),
                )

        elif category == "accessoires":
            # Vérifier si l'utilisateur possède déjà cet accessoire
            cursor.execute(
                "SELECT amount FROM accessories WHERE item_id = ?;", (item_id,)
            )
            accessory = cursor.fetchone()
            if accessory:
                current_amount = accessory[0]
                cursor.execute(
                    """
                    UPDATE accessories
                    SET amount = amount + ?
                    WHERE item_id = ?;
                """,
                    (quantity, item_id),
                )
            else:
                # Ajouter une nouvelle entrée dans accessories
                cursor.execute(
                    """
                    INSERT INTO accessories (item_id, amount, num_available)
                    VALUES (?, ?, 0);
                """,
                    (item_id, quantity),
                )

        elif category == "packs":
            # Vérifier si l'utilisateur possède déjà ce pack
            cursor.execute("SELECT amount FROM packs WHERE item_id = ?;", (item_id,))
            pack = cursor.fetchone()
            if pack:
                current_amount = pack[0]
                cursor.execute(
                    """
                    UPDATE packs
                    SET amount = amount + ?
                    WHERE item_id = ?;
                """,
                    (quantity, item_id),
                )
            else:
                # Ajouter une nouvelle entrée dans packs
                cursor.execute(
                    """
                    INSERT INTO packs (item_id, amount)
                    VALUES (?, ?);
                """,
                    (item_id, quantity),
                )

        else:
            # Pour d'autres catégories, ajouter une logique spécifique si nécessaire
            pass

        conn.commit()
        print("Transaction réussie.")
        return True
    except Error as e:
        print(f"Erreur lors de l'ajout de la transaction: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def get_user_inventory(db_path: str) -> List[Dict[str, Any]]:
    conn = connect_db(db_path)
    if conn is None:
        return []

    try:
        cursor = conn.cursor()

        # Récupérer les véhicules possédés
        cursor.execute(
            """
            SELECT v.item_id, c.category, c.subcategory, v.amount, c.price, c.promotion, c.img_path, c.name
            FROM vehicules v
            JOIN catalog c ON v.item_id = c.item_id
            WHERE v.amount > 0;
        """
        )
        vehicles = cursor.fetchall()

        # Récupérer les accessoires possédés
        cursor.execute(
            """
            SELECT a.item_id, c.category, c.subcategory, a.amount, c.price, c.promotion, c.img_path, c.name
            FROM accessories a
            JOIN catalog c ON a.item_id = c.item_id
            WHERE a.amount > 0;
        """
        )
        accessories = cursor.fetchall()

        # Récupérer les packs possédés
        cursor.execute(
            """
            SELECT p.item_id, c.category, c.subcategory, p.amount, c.price, c.promotion, c.img_path, c.name
            FROM packs p
            JOIN catalog c ON p.item_id = c.item_id
            WHERE p.amount > 0;
        """
        )
        packs = cursor.fetchall()

        # Combiner tous les articles
        inventory = []
        for item in vehicles + accessories + packs:
            inventory.append(
                {
                    "item_id": item[0],
                    "category": item[1],
                    "subcategory": item[2],
                    "amount": item[3],
                    "price": item[4],
                    "promotion": item[5],
                    "img_path": item[6],
                    "name": item[7],
                }
            )

        return inventory
    except Error as e:
        print(f"Erreur lors de la récupération de l'inventaire: {e}")
        return []
    finally:
        conn.close()


def sell_item(db_path: str, wallet_id: int, item_id: int, quantity: int) -> bool:
    """
    Vend une quantité d'un article de l'inventaire de l'utilisateur.

    Parameters:
        db_path (str): Chemin vers le fichier de base de données SQLite.
        wallet_id (int): ID du wallet de l'utilisateur.
        item_id (int): ID de l'article à vendre.
        quantity (int): Quantité à vendre.

    Returns:
        bool: True si la vente a réussi, False sinon.
    """
    conn = connect_db(db_path)
    if conn is None:
        return False

    try:
        cursor = conn.cursor()
        # Récupérer la catégorie de l'article
        cursor.execute(
            "SELECT category, price, promotion FROM catalog WHERE item_id = ?;",
            (item_id,),
        )
        row = cursor.fetchone()
        if row is None:
            print("Article non trouvé dans le catalogue.")
            return False
        category, price, promotion = row

        # Calculer le prix de vente (par exemple, 80% du prix d'achat)
        selling_price_per_unit = price
        total_selling_price = selling_price_per_unit * quantity

        # Vérifier si l'utilisateur possède suffisamment d'articles
        if category == "vehicules":
            cursor.execute(
                "SELECT amount FROM vehicules WHERE item_id = ?;", (item_id,)
            )
            owned = cursor.fetchone()
            if owned is None or owned[0] < quantity:
                print("Quantité insuffisante pour vendre.")
                return False
            # Mettre à jour la quantité possédée
            cursor.execute(
                """
                UPDATE vehicules
                SET amount = amount - ?
                WHERE item_id = ?;
            """,
                (quantity, item_id),
            )
        elif category == "accessoires":
            cursor.execute(
                "SELECT amount FROM accessories WHERE item_id = ?;", (item_id,)
            )
            owned = cursor.fetchone()
            if owned is None or owned[0] < quantity:
                print("Quantité insuffisante pour vendre.")
                return False
            cursor.execute(
                """
                UPDATE accessories
                SET amount = amount - ?
                WHERE item_id = ?;
            """,
                (quantity, item_id),
            )
        elif category == "packs":
            cursor.execute("SELECT amount FROM packs WHERE item_id = ?;", (item_id,))
            owned = cursor.fetchone()
            if owned is None or owned[0] < quantity:
                print("Quantité insuffisante pour vendre.")
                return False
            cursor.execute(
                """
                UPDATE packs
                SET amount = amount - ?
                WHERE item_id = ?;
            """,
                (quantity, item_id),
            )
        else:
            print("Catégorie non gérée.")
            return False

        # Mettre à jour le solde du wallet
        cursor.execute(
            """
            UPDATE wallet
            SET balance_usd = balance_usd + ?
            WHERE wallet_id = ?;
        """,
            (total_selling_price, wallet_id),
        )

        conn.commit()
        print("Vente réussie.")
        return True
    except Error as e:
        print(f"Erreur lors de la vente de l'article: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


# ==== ADMIN


def add_10k_usd(db_path: str):
    conn = connect_db(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE wallet
        SET balance_usd = balance_usd + 10000;
    """
    )
    conn.commit()
    conn.close()
