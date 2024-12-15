En local :

```bash
poetry run streamlit run Dashboard.py
```

# Database

wallet : balance_usd 
-> argent de l'utilisateur

type_surface : type_surface_id, type_surface
-> type_surface : champ, foret, vigne, entrepôt

parcels : parcel_id, superficie, type_surface_id, prix, is_purchased, parcel_next_action
-> parcel_next_action : action_type (labourer, mettre engrais, semer, récolter)

catalog : item_id, category, subcategory, price, promotion, img_path
-> categories : vehicules, accessoires, packs, 
-> subcategories : vehicules(tracteur, moissonneuse, ramasse patate, ramasse coton, vignes, bois, vehicules pour traiter les champs), accessoires(bennes, coupe de moissonneuse, accessoires pour labourer, accessoires pour semer), packs(graines blés, graines maïs, graines orge, graines colza, graines raisins, graines coton, pousses arbres, graines patates, engrais)
-> price : prix du produit unique, et prix du pack (1 pack pour 1 hectare)
-> promotion : en pourcentage, par exemple 0.1 pour 10%
-> img_path : chemin de l'image du produit, dans le dossier assets/images

vehicules : vehicle_id, item_id, amount, num_available
-> Les vehicules achetés par l'utilisateur
-> amount : quantité de véhicules de cette subcategory
-> num_available : nombre de véhicules disponibles de cette subcategory

accessories : accessory_id, item_id, amount, num_available 
-> Les accessoires achetés par l'utilisateur
-> amount : quantité d'accessoires de cette subcategory
-> num_available : nombre d'accessoires disponibles de cette subcategory

packs : pack_id, item_id, amount
-> Les packs achetés par l'utilisateur, une fois consommé, ils disparaissent du stock
-> amount : quantité de packs de cette subcategory (1 pack pour 1 hectare)

actions : action_id, action_type, type_surface_id, action_time
-> action_type : labourer, mettre engrais, semer, récolter
-> action_time : temps nécessaire pour réaliser l'action sur 1 hectare

action_requirements : action_requirements_id, action_id, item_id, amount
-> Fais le lien entre les actions et les items nécessaires pour les réaliser (mais aussi le nombre de workers)
-> amount : quantité nécessaire pour réaliser l'action

workers : worker_id, worker_name, worker_price, available
-> Les ouvriers achetés par l'utilisateur
-> worker_price : prix de l'ouvrier pour une action
-> available : booléen pour savoir si l'ouvrier est disponible


# Notes

Il y a des champs, qui ont un numéro de parcelle, une superficie, un type de surface, un prix, un booléen qui dit si l'utilisateur l'a acheté
L'utilisateur va avoir un solde en USD, 
L'utilisateur va pouvoir acheter des véhicules: tracteurs (petit, moyen, grand), des moissonneuses, ramasse patate, ramasse coton, véhicules pour les vignes, pour couper et ramasser le bois, des véhicules pour traiter les champs, des accessoires : bennes, coupe de moissonneuse (petite, moyenne grande), des accessoires pour labourer, semer. 
Il va aussi pouvoir acheter les graines pour semer, l'engrais, etc etc
Pour les machines on va pouvoir customiser pour augmenter les rendements etc. 

Et pour chaque parcelle, en fonction du type de surface : champ, foret, vigne, entrepôts, on va avoir des actions possibles. Par exemple pour un champ vierge on va devoir commencer par labourer, puis semer, puis attendre, puis récolter et vendre au meilleur prix suivant les cours. 
Pour chacune des étapes il faut la quantité de produit nécessaire (engrais, graines, etc), le matériel nécessaire (un tracteur avec l'accessoire adéquat, un ouvrier, etc) et il y a un temps qui est proportionnel à la superficie.

On peut assigner au début 5 ouvriers, et on peut en acheter au fur et à mesure. 

On aura aussi des contrats qui permettrons de gagner de l'argent en réalisant des taches spécifiques. 

On aura une page dédiée pour avoir le catalogue des choses à acheter. 
