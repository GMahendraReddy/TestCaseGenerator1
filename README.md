# Test Cases Agent

Full-stack TypeScript app: a React UI sends a user story to an Express API, which calls **[OpenRouter](https://openrouter.ai/)** (OpenAI-compatible API) to generate manual test cases and returns them as an **Excel** (`.xlsx`) file via **ExcelJS**.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (LTS recommended)
- An [OpenRouter API key](https://openrouter.ai/keys)

## Project layout

```
TestCasesAgent/
├── .env.example          # Copy to `.env` and set OPENROUTER_API_KEY
├── backend/              # Express + TypeScript
│   ├── src/
│   │   ├── index.ts      # POST /generate, health check
│   │   └── services/     # OpenRouter (OpenAI SDK) + Excel
│   ├── package.json
│   └── tsconfig.json
├── frontend/             # React + Vite + TypeScript
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── package.json          # Workspaces + `npm run dev` for both apps
└── README.md
```

## Setup

1. **Install dependencies** (from the repo root):

   ```bash
   npm install
   ```

2. **Configure environment** — copy the example env file and add your key:

   ```bash
   copy .env.example .env
   ```

   On macOS/Linux use `cp .env.example .env`.

   Edit `.env` in the **project root**:

   - `OPENROUTER_API_KEY` — required for generation ([keys](https://openrouter.ai/keys))
   - `PORT` — API port (default `3001`)
   - `OPENROUTER_MODEL` — OpenRouter model id (default `openai/gpt-4o-mini`; see [models](https://openrouter.ai/models))

   The backend loads `.env` from the project root automatically.

## Run (development)

**Option A — one command (API + UI):**

```bash
npm run dev
```

- API: [http://localhost:3001](http://localhost:3001) (`GET /health`, `POST /generate`)
- UI: [http://localhost:5173](http://localhost:5173)

**Option B — two terminals:**

```bash
cd backend && npm run dev
```

```bash
cd frontend && npm run dev
```

The Vite dev server proxies `/api/*` to the backend, so the UI calls `/api/generate` without CORS issues.

### Troubleshooting: “connection failed” / can’t open the UI

1. **Start the dev server** — the site only works while a terminal is running `npm run dev` (or `cd frontend` + `npm run dev`). If nothing is listening on port 5173, the browser shows connection failed.

2. **Port already in use** — another app (or an old Vite window) may be using `5173`. Close other dev servers, or find the process: in PowerShell, `Get-NetTCPConnection -LocalPort 5173` then stop that process. The frontend is configured with `strictPort: true` so Vite will error clearly instead of moving to another port without you noticing.

3. **Try `127.0.0.1`** — open [http://127.0.0.1:5173](http://127.0.0.1:5173) if `localhost` fails (some DNS/IPv6 setups on Windows).

4. **VPN / firewall** — temporarily allow Node.js through the firewall or disable VPN to test.

### Pointing the UI at a different API URL

Create `frontend/.env` (or `.env.local`):

```env
VITE_API_URL=http://localhost:3001
```

If unset, the app uses the proxy and calls `/api/generate`.

## Build (production)

```bash
npm run build
```

- Backend output: `backend/dist/`
- Frontend output: `frontend/dist/`

Run the API after build:

```bash
npm run start
```

Serve `frontend/dist` with any static host (nginx, S3, etc.) and set `VITE_API_URL` at build time to your public API URL, or configure the same origin reverse proxy.

## API

### `POST /generate`

**Request** (`application/json`):

```json
{ "userStory": "As a user, I want to reset my password via email." }
```

**Response:** Excel file (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) with columns: ID, Title, Priority, Preconditions, Steps, Expected Result.

**Errors:** JSON `{ "error": "..." }` with appropriate HTTP status.

## License

MIT (adjust as needed for your organization).
