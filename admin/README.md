# SVTouch Intro Generator — Admin (React)

A standalone React (Vite) dashboard that fetches submissions as JSON from the
API (`GET /api/admin/leads`) and renders a filterable table — category chips
with live counts, text search, expandable intros per row, CSV/JSON export.

## Develop

```sh
npm install
npm run dev        # http://localhost:5174 (proxies /api to localhost:5000)
```

## Build & deploy

```sh
npm run build      # outputs dist/
```

- The API server serves `dist/` at **/admin** automatically (local + Render).
- Or deploy `dist/` alone to Netlify/Vercel/S3 — asset paths are relative.
  Point it at your API once with the query param (remembered in localStorage):

  ```
  https://your-admin-host.example.com/?api=https://your-api.example.com
  ```

## Auth

If the server has `ADMIN_PASSWORD` set, /admin and /api/admin require HTTP
Basic auth (any username + that password). Unset = open, for local dev.
