# Log Health — React application

A simple upload-first dashboard for JSON application logs, including Serilog compact JSON logs. No database, Grafana, API key or external service is required. Uploaded logs stay in browser memory.

## Fastest way to open the included build

1. Install Node.js 22.12 or newer (Node 24 recommended).
2. Extract the ZIP and open a terminal inside `log-health-react`.
3. Run `node serve.mjs`.
4. Open http://localhost:4173 and select your log file.

The production build is already included. This route does not need `npm install` or an internet connection. Do not double-click `dist/index.html`: ES modules and the parsing worker need the local server.

## Develop the React source

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. After editing:

```sh
npm test
npm run build
npm start
```

`npm start` serves `dist` on port 4173. Stop another instance before starting it. Node binds only to your own computer. Installation requires npm registry access. Exact dependencies are in package-lock.json. React + Vite setup follows https://react.dev/learn/build-a-react-app-from-scratch and https://vite.dev/guide/.

## Workflow

- Upload a JSON-lines `.log`, `.txt`, `.jsonl`, `.ndjson`, or a JSON array `.json` (including Serilog compact logs and client telemetry recordings), up to 50 MB. Parsing runs in a worker. Very large files still use browser memory after parsing.
- **Preset sample at the top**: Click `demo.jsonl` to load the included backend log dataset without manual file selection.
- **From / To date filters are at the top.** Boundaries are inclusive UTC dates and apply to every metric, chart, insight, issue and evidence view. Latest day / Last 7 log days are anchored to the latest timestamp in the uploaded file, not today. All dates clears only the date range. Reset all clears every filter.
- **Errors Only vs All Records toggle**: Easily switch between failure triage (404s, 500s, exceptions) and the complete event stream (UI interactions, clicks, route transitions, and API requests).
- Search, level and category filters also apply to the whole dashboard. An “Inspect related logs” action further narrows only the evidence list.
- Open an issue to see first/last occurrence, logged request/job IDs, affected areas, possible cause, suggested owner, investigation steps and QA checks.
- Download a single issue brief or the complete action report (Markdown), suitable for adapting into a defect ticket. These exports include sample raw log evidence; review before sharing.
- Workflow states are manual and in-memory. A new upload or page reload clears them. No persistence, automatic alerts or live API fetching is included.

## What makes the analysis actionable

Errors are grouped by a structured `Error` value, otherwise the first exception line, otherwise the message template. Wrapper messages and their identical underlying exception can therefore be grouped together. For telemetry errors (e.g. `ERR: 404 GET /path?params (45ms)`), latency and varying query parameters are normalized so identical endpoints group into one actionable issue. Literal differences remain separate; the app does not claim groups are unique incidents.

Suggested priority rules:
1. Explicit missing procedure / missing column errors / server 500s: Investigate first.
2. Other issue groups with 10 or more entries (including recurring 404s): Review next.
3. Remaining issues: Review.

These are editable triage heuristics, not confirmed incident severity. A rare error can still be business-critical. Possible causes, owner suggestions and checklists are defined in `src/analysis.mjs`. They are deterministic rules, not AI diagnoses. The app never applies fixes to your system.

Counts describe log entries. They do not represent failed-request percentages, unique affected users, lost bills, or current availability. An error log alone cannot establish resolution. No live health score is fabricated. Dates with no entries are not treated as uptime. “Verified by me” is a manual note, not a health check.

JSON values are rendered by React as text; there is no HTML evaluation. Invalid records are skipped and reported. Invalid timestamps are excluded from the timeline and from active date filters, but remain available with all dates selected. A file containing no recognizable valid records preserves the previously loaded snapshot.

## Files

- `src/App.jsx`: React UI, sample toggle, top date filters, view toggles, file input, manual workflow and exports.
- `src/analysis.mjs`: parsing, normalization, grouping, playbooks, report generation (supports Serilog and Telemetry).
- `src/log.worker.js`: browser-local file parsing worker.
- `src/style.css`: responsive styles and telemetry metadata styling.
- `tests/analysis.test.mjs`: meaningful parsing/grouping/boundary checks for both backend and telemetry logs.
- `examples/demo.jsonl`: synthetic backend log dataset demonstrating database deadlocks and schema issues.
- `dist/`: built app, ready for the included local server or static hosting.
- `serve.mjs`: dependency-free local static server with examples route support.

## Later API integration

Keep `normalize`, `filterEntries` and `analyze` as the shared data pipeline. A future source adapter can fetch an authorized API response and normalize each record before updating React state. File input and API input can then use the same analysis and components. No credentials, placeholder API calls or automatic polling are present in this phase.

## Validation

`npm test` exercises UTC boundaries, malformed records, underlying-exception grouping, duplicate request IDs, filters, priority rules and reports. `npm run build` verifies the production bundle. See VALIDATION.md for checks performed on this package.
