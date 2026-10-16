# BrightSteps API

PostgreSQL-compatible API for child profiles and learning adventures.

## Run

```powershell
cd server
npm install
npm run dev
```

API base: `http://localhost:4000/api`

## Endpoints

- `GET /api/healthz`
- `GET /api/children`
- `POST /api/children` `{ "name": "Mina", "age": 5 }`
- `POST /api/sessions`
- `GET /api/children/:childId/progress`

## Database + Auth

Hosted **PostgreSQL + Auth on Supabase**.

1. Edit `server/.env`:
   - `DATABASE_URL` — Session pooler URI with your DB password
   - `SUPABASE_URL` — Project URL
   - `SUPABASE_ANON_KEY` — Project Settings → API → anon public key
2. In Supabase Auth settings: enable Email, disable email confirmation for now.
3. Run `npm run start`.

Tables and `parent_id` columns are created/updated automatically on startup.
Family APIs require a Bearer access token from Supabase Auth.

