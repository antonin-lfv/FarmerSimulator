<h1 align="center">
  <br>
  🚜 Verdance - Simulateur d'exploitation agricole
  <br>
</h1>

<h4 align="center">Simulateur de gestion agricole : parcelles, actions temporisées, boutique, inventaire et marché dynamique, avec une carte 3D interactive.</h4>


[Découvrir la carte 3D et ses commandes](docs/carte-3d.md)

## Stack

- **Frontend** : Next.js (App Router) + TypeScript + Tailwind CSS + Three.js — `frontend/`
- **Backend** : FastAPI + SQLAlchemy — `backend/app/`
- **Base de données** : PostgreSQL
- Tout tourne via **Docker Compose**

## Démarrer

```bash
docker compose up --build -d
```

L'app tourne derrière **Caddy** (reverse proxy), qui route un nom d'hôte local vers le frontend et
`/api/*` vers le backend — un seul point d'entrée, pas de CORS à gérer manuellement.

1. Ajoute une fois `127.0.0.1 verdance.test` à `/etc/hosts` (nécessite `sudo`) :
   ```bash
   sudo sh -c 'echo "127.0.0.1 verdance.test" >> /etc/hosts'
   ```
2. Ouvre **http://verdance.test**

Le conteneur **frontend** sert l'interface Next.js compilée. **Caddy** transmet
`/api` au backend. Les quatre services sont conservés ; `docker compose ps`
permet de vérifier leur état. Le port `localhost:3000` expose aussi le frontend,
mais `verdance.test` est recommandé pour disposer du routage de l'API.

Après une modification du code :

```bash
docker compose up -d --build backend frontend caddy
```

## Carte, relief et météo

- Carte exclusivement 3D : rotation, déplacement, zoom, sélection des parcelles,
  vue du dessus et plein écran. La landing page utilise le même relief.
- Collines douces et berges basses : terrains, cultures, contours et numéros
  partagent la même altitude. Les entrepôts reposent sur des fondations planes.
- Les machines suivent un passage intérieur à leur parcelle et s'inclinent avec
  la pente. Elles effectuent des allers-retours continus à vitesse lisible pendant
  toute l'action, même lorsque le travail dure plusieurs dizaines de minutes.
- Toutes les forêts sont initialement matures et prêtes à être coupées : elles
  donnent du relief dès le départ et permettent de récolter puis vendre du bois
  immédiatement après l'achat d'une parcelle forestière. Après la première
  coupe, le cycle normal de plantation et de croissance reprend.
- Pluie avec traînées et impacts au sol ; orage avec pluie, brouillard et éclairs ;
  gel avec givre et braseros sur les cultures protégées ; canicule avec teintes
  chaudes et particules de poussière. Les effets ne capturent pas les clics.
- Incendies localisés : lors d'une journée de canicule, une probabilité de 8 %
  peut déclencher au plus un foyer sur une forêt possédée, plantée et non protégée.
  Il enlève une fois 20 points de santé à la récolte, en plus des dégâts de chaleur.
  « Éteindre et protéger » utilise le coût habituel de protection (600 $, ou
  150 $ avec l'équipement adapté). Les flammes cessent après protection ou au jour
  suivant ; la perte de santé persiste pour la récolte. Il n'y a pas de propagation.

L'orage remplace une petite part des journées pluvieuses, surtout en été. Il garde
le même bonus de croissance (×1,1), sans déplacer les autres journées météo déjà
calculées. La table `fire_events` est créée automatiquement au démarrage, sans
réinitialiser la sauvegarde.

Le mode de réduction des animations coupe les éclairs, les déplacements des
particules et les oscillations des flammes. Aucun sélecteur de météo de test
n'est exposé dans l'interface.

## Rythme de production

Docker Compose utilise les durées normales : une minute d'action correspond à
une minute réelle. La durée totale est calculée à partir du temps de base de
l'action, de la superficie et du matériel choisi. Dans chaque gamme comparable,
l'équipement le moins performant applique jusqu'à 15 % de temps supplémentaire
et le meilleur réduit sa part jusqu'à 20 %. Quand plusieurs machines ou outils
sont requis, leurs effets se combinent. Le temps de main-d'œuvre facturé suit la
même réduction.

Le calendrier conserve également son rythme normal : un mois de jeu dure une
semaine réelle. Les variables `DEBUG_ACTION_SECONDS` et `GAME_MONTH_SECONDS`
restent disponibles pour des essais ponctuels du backend, mais ne sont pas
activées par la configuration Docker Compose de production. L'interface et
l'API d'ajout de fonds de test sont retirées.

## Développement

Pour travailler avec le rechargement automatique : arrêter le frontend Docker
pour libérer le port 3000, conserver la base et le backend, puis démarrer Next.js :

```bash
docker compose stop frontend caddy
docker compose up -d db backend
npm --prefix frontend ci
npm --prefix frontend run dev
```

## Vérifications

```bash
npm --prefix frontend run test:map
npm --prefix frontend run build
docker compose run --rm --no-deps -v "$PWD/backend:/app" backend python -m unittest discover -s tests -v
```

Les tests couvrent les 54 parcelles, les collisions des numéros, les pentes,
l'altitude du sol sélectionnable, le maintien des roues dans les parcelles,
la progression des actions, la météo et l'extinction d'un incendie.
