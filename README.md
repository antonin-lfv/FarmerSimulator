# Verdance — Simulateur de ferme

Simulateur de gestion agricole : parcelles, actions temporisées, boutique, inventaire et marché
dynamique, avec une carte interactive.

## Stack

- **Frontend** : Next.js (App Router) + TypeScript + Tailwind CSS — `frontend/`
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

Accès directs (debug/API brute uniquement — le frontend seul sur le port 3000 ne fonctionne plus
tel quel, ses appels API sont relatifs et passent par Caddy) :
- API backend : http://localhost:8000
- PostgreSQL : `localhost:5432` (accessible en direct, ex. `psql`)

```bash
docker compose logs -f backend   # suivre les logs d'un service
docker compose down              # arrêter (garde les données Postgres)
docker compose down -v           # arrêter et effacer les données Postgres (nécessaire après tout
                                  # changement de modèle SQLAlchemy — pas de migrations Alembic)
```

Les identifiants Postgres par défaut sont dans `.env.example` — copier en `.env` à la racine pour
les personnaliser.

## Développement local (hors Docker)

```bash
# Backend (nécessite un Postgres accessible, ou DATABASE_URL pointant ailleurs)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install
npm run dev
```

## Structure

```
backend/    # API FastAPI (modèles, services, routers, scheduler)
frontend/   # App Next.js (landing, dashboard, carte, boutique, inventaire, marché)
map/        # Assets de la carte (svg + png)
assets/     # Images produits
docs/       # Documentation, dont l'historique de l'ancienne version Streamlit/SQLite
```

Voir `docs/legacy-streamlit-app.md` pour l'historique de la première version du projet
(Streamlit + SQLite), remplacée par cette stack.

## Logos

https://farmingsimulator.fandom.com/wiki/Tractors/Farming_Simulator_22