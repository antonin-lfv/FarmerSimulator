# 🚜 Simulateur de Ferme - Version Simplifiée

Un simulateur de ferme interactif développé avec Streamlit, avec système de marché automatique.

## 🌟 Fonctionnalités

### 🎮 **Gameplay Principal**
- **🗺️ Gestion des parcelles** : Achetez et gérez différents types de terrains (champs, forêts, vignes, entrepôts)
- **🌾 Actions agricoles** : Labourez, semez, fertilisez, récoltez selon le cycle des cultures
- **🛒 Système de boutique** : Achetez véhicules, accessoires et matériaux
- **📦 Gestion d'inventaire** : Suivez vos possessions et vendez vos récoltes

### 📈 **Marché Automatique**
- **Prix dynamiques** : Les cours fluctuent automatiquement selon l'offre et la demande
- **Historique complet** : 10 jours d'historique des prix pour optimiser vos ventes
- **Événements spéciaux** : Sécheresse, bonnes récoltes, variations de demande
- **Mise à jour quotidienne** : 1 jour de jeu = 24 minutes réelles

### ⚡ **Système Temps Réel**
- **Actions temporisées** : Chaque action prend du temps selon la superficie
- **Progression automatique** : Les actions se terminent automatiquement
- **États des champs** : L'état change après chaque action (semé → fertiliser → récolter)

## 🚀 Démarrage Rapide

### Installation
```bash
# Installer les dépendances
pip install -r requirements.txt
```

### Lancement Automatique
```bash
# Démarrer le simulateur complet (Web + Service de marché)
./start_farm_simulator.sh
```

### Lancement Manuel
```bash
# Application web seulement
streamlit run Dashboard.py --server.port 8001

# Service de marché en arrière-plan
python3 market_updater.py &
```

### Arrêt
```bash
# Arrêter tous les services
./stop_farm_simulator.sh
```

## 📋 Pages Disponibles

1. **🏠 Dashboard** - Vue d'ensemble et métriques
2. **🗺️ Plan** - Gestion des parcelles et actions agricoles  
3. **🛒 Shop** - Achat de véhicules, accessoires et matériaux
4. **📦 Inventaire** - Gestion des possessions
5. **📈 Marché** - Prix actuels, historique et vente de récoltes

## 🎯 Guide de Jeu

### Démarrage
1. Achetez votre première parcelle sur la page **Plan**
2. Allez à la **Boutique** pour acheter des véhicules et matériaux
3. Retournez au **Plan** pour effectuer votre première action (ex: labourer)

### Cycle Agricole Standard
```
Acheter parcelle → Labourer → Semer → Fertiliser → Récolter → Vendre
```

### Optimisation
- Consultez le **Marché** pour vendre au meilleur prix
- Utilisez l'historique des prix pour prévoir les tendances
- Gérez plusieurs parcelles en parallèle pour maximiser les profits

## 📁 Structure du Projet

```
/app/
├── Dashboard.py              # Page principale
├── pages/                    # Pages Streamlit
│   ├── 01_Plan.py           # Gestion des parcelles
│   ├── 02_Shop.py           # Boutique
│   ├── 03_Inventaire.py     # Inventaire
│   └── 05_Marche.py         # Marché
├── database_manager.py       # Gestion base de données
├── config.py                # Configuration
├── market_updater.py        # Service de marché automatique
├── start_farm_simulator.sh  # Script de démarrage
├── stop_farm_simulator.sh   # Script d'arrêt
└── logs/                    # Fichiers de logs
```

## 🔧 Configuration

### Base de Données
- **Type** : SQLite
- **Fichier** : `farming_simulator.db`
- **Initialisation** : Automatique au premier démarrage

### Services
- **Application web** : Port 8001
- **Mise à jour marché** : Toutes les 24 minutes (1 jour de jeu)
- **Logs** : Dossier `logs/`

## 📊 Système de Marché

### Fréquence de Mise à Jour
- **1 jour de jeu = 24 minutes réelles**
- Vérification automatique toutes les minutes
- Mise à jour effective seulement si délai écoulé

### Facteurs de Prix
- **Saisonniers** : Variations selon les cycles
- **Météorologiques** : Événements climatiques
- **Offre/demande** : Fluctuations du marché
- **Mean reversion** : Retour progressif vers les prix moyens

### Événements Spéciaux (10% de chance par jour)
- 🌵 **Sécheresse** : +30% prix récoltes, +10% matériaux
- 🌾 **Récolte exceptionnelle** : -30% prix récoltes, -10% matériaux  
- 🚢 **Forte demande export** : +40% prix récoltes
- ⛽ **Hausse carburant** : +10% récoltes, +20% matériaux
- 🏛️ **Subventions** : -10% récoltes, -20% matériaux

## 🛠️ Administration

### Commandes Utiles
```bash
# Voir les logs en temps réel
tail -f logs/streamlit.log
tail -f logs/market_updater.log

# Status des processus
ps aux | grep streamlit
ps aux | grep market_updater

# Forcer l'arrêt
pkill -f streamlit
pkill -f market_updater
```

### Debug
- Logs détaillés dans `/app/logs/`
- Base de données accessible via SQLite
- Fonctions admin disponibles dans le Dashboard

## 🎮 Conseils de Jeu

### Économie
- Commencez par acheter quelques parcelles
- Investissez dans des véhicules polyvalents
- Surveillez les prix du marché avant de vendre
- Diversifiez vos cultures pour réduire les risques

### Stratégie
- Les vignes sont plus rentables mais prennent plus de temps
- Les céréales offrent un retour rapide sur investissement  
- Stockez vos récoltes si les prix sont bas
- Planifiez vos actions pour optimiser le temps

---

**Bon jeu ! 🌾🚜**

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
