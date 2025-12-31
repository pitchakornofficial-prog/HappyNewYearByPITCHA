# Happy New Year 2026 — Wishes Board

Minimal Node + Express app to collect New Year wishes. Data is stored in a local JSON file under `data/wishes.json`.

Quick start

1. Install dependencies:

```powershell
npm install
```

2. Run:

```powershell
npm start
# open http://localhost:3000
```

Notes
- The API endpoints are:
  - `GET /api/wishes` — list wishes
  - `POST /api/wishes` — add a wish (JSON: `{ "name": "...", "message": "..." }`)
- All files are under the project folder. The data file is `data/wishes.json`.
