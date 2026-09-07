# Base44 development notes

## Architecture
- **Frontend**: Vite + React SPA on port 3000 (`src/`)
- **Backend**: Express API on port 8000 (`server/index.ts`) — generic JSONB CRUD over PostgreSQL
- **Database**: PostgreSQL 16 (`db` service) — stores all entities in a single `entities` table (type, id, data JSONB) plus `app_state` for session state

## How data flows
- On app mount, `db.initFromApi()` fetches all entities from the API in parallel and caches them in memory
- All reads are synchronous from the in-memory cache (no view changes needed)
- All writes update the cache synchronously and fire-and-forget a bulk upsert to the API
- The offline visit queue stays in `localStorage` (client-side PWA concern)
- The API auto-seeds the database from `src/services/seedData.ts` on first boot

## Start / verify
```bash
docker compose -f docker-compose.base44.yml up -d      # starts db, api, web
curl http://localhost:3000/api/health                   # → {"status":"ok"}
curl http://localhost:3000/api/entities/properties        # → array from PostgreSQL
docker compose -f docker-compose.base44.yml exec -T web npm run lint  # tsc --noEmit
```

## Key files
- `server/index.ts` — Express API (schema, seed, routes)
- `src/services/storage.ts` — in-memory cache + API sync layer (replaces localStorage)
- `src/services/seedData.ts` — initial seed data (shared by frontend fallback and backend seed)
- `vite.config.ts` — Vite proxy `/api` → `http://api:8000`
- `docker-compose.base44.yml` — db (PostgreSQL), api (Express), web (Vite)
