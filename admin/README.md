# Intro Generator — Admin (standalone)

A single-file, dependency-free admin dashboard (`index.html`). It only **reads**
data from the API (`GET /api/admin/leads`) and renders a filterable table with
CSV/JSON export.

## Deploy anywhere

This folder is fully static — host it on Netlify, Vercel, GitHub Pages, S3, or
any web server. No build step.

Point it at your API with the `?api=` query parameter once (it is remembered in
localStorage):

```
https://your-admin-host.example.com/?api=https://your-api.example.com
```

Without `?api=`, it talks to the same origin it is served from — which is why
it also works out of the box at http://localhost:5000/admin (served by the API
server itself).

## Requirements on the API side

- CORS is enabled on the API (it is, by default, in `server/src/index.js`).
- No auth (by design, per project decision). Anyone with the admin URL and the
  API URL can read submissions — add auth before exposing publicly.
