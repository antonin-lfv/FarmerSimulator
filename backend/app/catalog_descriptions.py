# Hand-written flavor/role text for every catalog item — the numeric facts
# (growth speed, resistances, yield, rental price, action usage...) are all
# derived live from the actual game data in catalog_detail_service.py, this
# file only holds the part that can't be computed: what the thing IS.
DESCRIPTIONS: dict[int, str] = {
    # Véhicules
    1: "Tracteur compact et polyvalent, parfait pour débuter : labourer, semer ou épandre l'engrais sur une petite exploitation sans investissement lourd.",
    2: "Tracteur de puissance intermédiaire — un bon compromis pour une exploitation qui grandit, sans viser tout de suite le plus gros modèle.",
    3: "Le plus gros tracteur du catalogue. Même rôle que les autres (labourer/semer/épandre), mais pour ne jamais manquer de puissance disponible sur une exploitation qui tourne sur beaucoup de parcelles.",
    4: "Moissonneuse-batteuse automotrice, indispensable pour récolter les céréales. Fonctionne toujours avec une coupe adaptée à la largeur du champ et une benne pour stocker le grain.",
    5: "Véhicule spécialisé dans la récolte des patates — remplace à lui seul tracteur, coupe et benne pour cette action précise.",
    6: "Cueilleuse de coton automotrice, seule requise pour récolter le coton : pas besoin de coupe ni de benne séparée.",
    7: "Tracteur enjambeur de vigne, conçu pour circuler au-dessus des rangs sans les abîmer. L'engin de référence pour récolter le raisin.",
    8: "Engin forestier tout-en-un pour couper le bois — remplace à lui seul le tracteur et ses accessoires sur une parcelle de forêt.",
    # Accessoires
    10: "Remorque de collecte pour stocker le grain pendant la récolte des céréales. Capacité standard, le strict nécessaire.",
    11: "Version grande capacité de la benne standard — moins d'allers-retours pour vider la moissonneuse sur les grandes parcelles.",
    12: "Barre de coupe frontale de la moissonneuse, 4 mètres de large — l'entrée de gamme, suffisante sur les petites surfaces.",
    13: "Barre de coupe frontale de la moissonneuse, 8 mètres de large — un bon compromis vitesse/prix.",
    14: "Barre de coupe frontale de la moissonneuse, 12 mètres de large — la plus rapide à l'hectare, pour les grandes parcelles.",
    15: "Outil de labour à disques, l'accessoire de base pour préparer la terre avant de semer.",
    39: "Alternative économique au déchaumeur à disques — travaille le sol un peu plus lentement, pour un investissement de départ nettement réduit.",
    16: "Semoir de base pour mettre les graines en terre, quelle que soit la céréale, le coton ou la patate choisis.",
    40: "Semoir haut de gamme — dépose les graines nettement plus vite qu'un modèle standard, contre un investissement plus élevé.",
    17: "Épandeur standard pour appliquer l'engrais, qui donne un bonus de rendement permanent pour tout le cycle de culture en cours.",
    41: "Version grande capacité de l'épandeur d'engrais — traite la parcelle plus vite que le modèle standard.",
    42: "Foyer mobile utilisé pour réchauffer l'air ambiant lors des nuits de gel et protéger les cultures en place.",
    43: "Système d'arrosage mobilisable en urgence lors des épisodes de canicule pour protéger les cultures en place.",
    # Graines céréales
    18: "Variété de référence, ni particulièrement rapide ni particulièrement résistante — le blé neutre auquel comparer toutes les autres céréales.",
    19: "Céréale d'été, tolère mieux la canicule que le blé et offre un meilleur rendement, au prix d'une pousse un peu plus longue.",
    20: "Céréale rustique et rapide, bonne résistance au gel — idéale pour les semis en fin d'année, pour un rendement légèrement inférieur au blé.",
    21: "Résiste un peu au gel comme à la canicule et offre un léger bonus de rendement — une valeur sûre toute l'année.",
    29: "Céréale rustique à pousse rapide, bonne résistance au gel — un bon choix en hiver, pour un rendement modeste.",
    30: "La céréale la plus résistante au gel du catalogue — pousse vite et survit aux hivers rigoureux, au prix d'un rendement en retrait.",
    # Graines coton
    23: "Variété de coton de référence, sans trait particulier.",
    31: "Coton longue fibre haut de gamme — meilleur rendement et un peu de résistance à la canicule, pousse plus lentement.",
    32: "Coton cultivé sans traitement particulier — un peu plus long à pousser, mais plus rentable à la récolte.",
    # Graines patates
    25: "Variété de référence, ni précoce ni tardive.",
    33: "Variété précoce — prête à récolter plus vite que la variété standard, pour un rendement légèrement inférieur.",
    34: "Patate à chair violette, variété premium à pousse longue mais au rendement nettement supérieur.",
    # Graines raisins
    22: "Raisin de table générique, sans trait particulier.",
    35: "Cépage rouge réputé, tolère bien la canicule et offre un excellent rendement — pousse plus lentement que le raisin de table.",
    36: "Cépage blanc réputé, débourrement tardif donc bonne résistance au gel, et bon rendement.",
    # Pousses arbres
    24: "Essence générique à croissance standard.",
    37: "Bois noble à très forte valeur mais à pousse longue — le meilleur rendement du catalogue, en échange de patience.",
    38: "Conifère à croissance rapide et rustique (bonne résistance au gel) — récolte vite, pour un bois moins valorisé.",
    # Autres packs
    26: "Appliqué lors de l'étape « mettre engrais », donne un bonus de rendement permanent pour tout le cycle de culture en cours.",
    27: "Récolte de la forêt, à vendre sur le marché ou à garder en stock.",
    28: "Récolte de la vigne, à vendre sur le marché ou à garder en stock.",
}
