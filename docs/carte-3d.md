# La ferme en 3D

Le tableau de bord `/dashboard` est un espace de gestion centré sur un paysage 3D. Les 54 terrains conservent les contours et identifiants de la carte d'origine. Les champs, forêts, vignes et entrepôts sont construits en volume. Les cultures changent d'aspect avec le labour et la croissance, et l'éclairage reflète la météo réelle du jeu.

## Explorer

- Glisser avec le bouton gauche : tourner autour du domaine.
- Glisser avec le bouton droit : déplacer la caméra sur le sol.
- Molette ou boutons + / − : zoomer.
- Sur écran tactile : un doigt pour tourner, deux pour déplacer et pincer pour zoomer.
- Après avoir donné le focus à la carte : flèches, ZQSD ou WASD pour déplacer ; + / − pour zoomer ; R pour recentrer.
- La barre d'outils propose aussi la vue du dessus, le centrage sur la sélection, les numéros et l'agrandissement. Échap quitte la carte agrandie.

Cliquer sur le sol, un numéro, ou choisir un terrain dans « Accès rapide à une parcelle » ouvre le panneau de gestion : achat, équipements, travail agricole, protection et stockage. En vue agrandie, sélectionner une parcelle ramène au panneau de gestion. Sur mobile, la page rejoint ce panneau après son chargement.

Les filtres mettent en évidence les terres possédées, à vendre ou en activité. Les badges indiquent propriété, sélection, activité et risque météo. Les numéros trop rapprochés sont espacés ou masqués ; zoomer permet de rejoindre tous les terrains.

Chaque étape agricole transforme réellement le terrain. Les champs passent de la jachère aux sillons labourés, puis aux jeunes pousses, à la culture fertilisée et enfin aux rangées dorées prêtes à récolter. Les forêts montrent d'abord les souches, puis des arbres qui grandissent ; les vignes passent des piquets nus aux rangs feuillus et aux grappes mûres. Pendant une action, une petite machine traverse progressivement la parcelle en suivant l'avancement réel du travail.

La carte est exclusivement en 3D. Si l'accélération graphique n'est pas disponible, l'interface affiche une explication et permet de relancer la scène. La page d'accueil contient elle aussi une preview Three.js manipulable : glisser pour tourner, utiliser la molette ou le pincement pour zoomer, puis cliquer sur une parcelle pour entrer dans l'exploitation.

## Lancement local

Depuis la racine du projet, avec Docker démarré :

```sh
docker compose up -d db backend
npm --prefix frontend ci
npm --prefix frontend run dev
```

Ouvrir <http://localhost:3000/dashboard>. L'API par défaut est <http://localhost:8000/api>. Pour le lancement complet derrière Caddy, suivre le README et reconstruire le frontend avec `docker compose up --build -d`.

## Vérification

```sh
npm --prefix frontend run test:map
npm --prefix frontend run build
```

Les tests de carte nécessitent Node.js 22.18 ou ultérieur. Ils couvrent les 54 géométries, leur orientation et leur sélection par rayon, les contours concaves, la croissance des champs, le placement reproductible et les collisions entre numéros.

La scène Three.js est chargée à la demande côté navigateur. Les arbres et les rangées utilisent des instances partagées. Le rendu est limité à 45 images/s et à une densité de pixels de 1,75, suspendu lorsque l'onglet est caché ou la carte hors écran. Les ressources graphiques et les écouteurs sont libérés lors du changement de vue ou de page. La préférence de réduction des animations est respectée.

Validation manuelle : rotation sans sélection accidentelle, sélection d'un champ et d'un entrepôt, centrage sur la sélection, filtres, carte agrandie, preview de la page d'accueil et affichage à 390 px.

Le lint global signale encore des problèmes React préexistants dans `BulkActionModal`, `BuyItemModal`, `SellItemModal`, `AnimatedNumber`, `calendar-context` et `wallet-context`. Les fichiers de cette refonte sont vérifiés séparément.
