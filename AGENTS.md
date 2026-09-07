# Base44 development notes

- The app is a Vite/React single-page frontend; its data layer is seeded into browser `localStorage` by `src/services/storage.ts`.
- `.env.example` documents `GEMINI_API_KEY` and `APP_URL`, but the current source does not read either variable and does not make external API calls.
- Start the editable development environment with `docker compose -f docker-compose.base44.yml up -d`; it serves Vite directly from the bind-mounted repository on port 3000.
- Verify with `curl http://localhost:3000/` and `docker compose -f docker-compose.base44.yml exec -T web npm run lint`.
