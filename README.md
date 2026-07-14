# Intro Generator (Monster)

A standalone tool that turns a person's details (or LinkedIn) into **4 polished founder
introductions** using AI, plus a **no-auth admin dashboard** listing every submission.

Rebuilt from the SVTouch intro-generator spec as an independent **MERN-style** app:
**React (Vite)** + **Express** + **MongoDB** (optional) + local **Ollama** AI.

---

## Features

- **AI generation** — one call returns 4 tones: Professional, Friendly, Pitch, Investor-ready.
- **Search-as-you-type** — Instagram-style live LinkedIn lookup (Firecrawl; optional).
- **Auto-fill** — reads a LinkedIn/website URL and pre-fills the form (AI extraction).
- **Editable results** — copy, share to WhatsApp, regenerate.
- **Email-me / lead capture** — saves the submission.
- **Admin table** (`/admin`) — every submission, expandable to view all 4 intros. No password (per request).
- **Always works** — if AI is offline, a deterministic template still produces drafts.

---

## Quick start

```bash
# 1. Install everything (root + server + client)
npm run install:all

# 2. Run both server and client together
npm run dev
```

- App:   http://localhost:5173
- Admin: http://localhost:5173/admin
- API:   http://localhost:5000/api/health

> Or run them separately: `npm run server` and `npm run client`.

---

## Configuration (`server/.env`)

| Var | Default | Notes |
|---|---|---|
| `PORT` | `5000` | API port |
| `DB_MODE` | `file` | `file` (JSON, zero-setup) or `mongo` |
| `DATA_FILE` | `./data/leads.json` | file store location |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/intro_generator` | used when `DB_MODE=mongo` |
| `AI_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible endpoint (Ollama default) |
| `AI_API_KEY` | *(empty)* | needed for hosted providers, not for Ollama |
| `AI_MODEL` | `gemma4:e4b` | any local Ollama model or provider model id |
| `FIRECRAWL_API_KEY` | *(empty)* | enables LinkedIn search; get one at firecrawl.dev |
| `SEARCH_SITE_FILTER` | `site:linkedin.com/in` | search scope |

### Use MongoDB (true MERN)
1. Start MongoDB (`mongod`).
2. Set `DB_MODE=mongo` in `server/.env`.
3. Restart the server. Submissions now persist to MongoDB; the admin reads from it.

### Swap the AI provider
The AI call is OpenAI-compatible. To use OpenAI/Gemini/Lovable instead of Ollama,
set `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`. No code change.

---

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | status (storage, AI, search) |
| POST | `/api/generate` | `{name,...}` → `{intros, fetched, source}` |
| POST | `/api/extract` | `{linkedin,website}` → auto-fill fields |
| POST | `/api/search` | `{query}` → LinkedIn results (Firecrawl) |
| POST | `/api/leads` | save a submission |
| GET | `/api/admin/leads` | list all submissions |

---

## Project layout

```
intro-generator/
├─ server/            Express API
│  └─ src/
│     ├─ index.js         app + routes wiring
│     ├─ config.js        env
│     ├─ db/leadStore.js  file OR mongo store (pluggable)
│     ├─ services/        ai.js (OpenAI-compat), fetchUrl.js
│     ├─ lib/             prompts, contactBlock, fallbackIntros
│     └─ routes/          generate.js, leads.js, search.js
└─ client/            React + Vite + Tailwind
   └─ src/
      ├─ pages/            IntroGenerator.jsx, Admin.jsx
      ├─ components/       SearchAutocomplete.jsx (reusable)
      └─ api.js
```
