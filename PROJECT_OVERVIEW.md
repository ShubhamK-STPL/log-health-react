# Log Health — Project Documentation & Overview

## 1. Executive Summary

**Log Health** is an upload-first, privacy-focused web dashboard designed for fast, local investigation of application logs (primarily JSON / Serilog compact format).

### Key Highlights
- **Zero External Dependencies at Runtime**: Does not require any external database, SaaS monitoring platform (e.g., Datadog, Grafana, Sentry), or API keys.
- **100% In-Browser Execution**: All file parsing, log normalization, filtering, and aggregation happen strictly in the browser using Web Workers. No sensitive company logs or user data leave the local machine.
- **Deterministic Triage & Playbooks**: Errors are categorized and mapped to clear investigation checklists, probable causes, suggested owner roles, and QA verification steps.
- **Actionable Reporting**: Generates markdown-formatted action reports and issue briefs ready for export into issue trackers (Jira, GitHub Issues, etc.).

---

## 2. Architecture & Tech Stack

```mermaid
graph TD
    A[Log File (.log, .jsonl, .json)] -->|Input / Drag & Drop| B[React UI: App.jsx]
    B -->|Transfers file| C[Web Worker: log.worker.js]
    C -->|parseLog| D[analysis.mjs]
    D -->|Parsed & Normalized Entries| C
    C -->|postMessage| B
    B -->|State & Filters| E[Interactive Dashboard]
    E --> F[Priority Issue Queue]
    E --> G[UTC Timeline & Category Distribution]
    E --> H[Detailed Log Evidence Explorer]
    E --> I[Markdown Action Reports]
```

### Technology Breakdown
- **Frontend Framework**: [React 19.2.0](file:///d:/UBUNTU%20DATA/01_Experiments/log-health-react/package.json)
- **Build Tool / Bundler**: [Vite 7.2.2](file:///d:/UBUNTU%20DATA/01_Experiments/log-health-react/vite.config.js)
- **Styling**: Modern Vanilla CSS ([src/style.css](file:///d:/UBUNTU%20DATA/01_Experiments/log-health-react/src/style.css)) with responsive layout, custom themes, and CSS bar charts.
- **Multithreading**: HTML5 Web Worker ([src/log.worker.js](file:///d:/UBUNTU%20DATA/01_Experiments/log-health-react/src/log.worker.js)) for non-blocking log parsing.
- **Production Server**: Zero-dependency local Node.js HTTP server ([serve.mjs](file:///d:/UBUNTU%20DATA/01_Experiments/log-health-react/serve.mjs)).
- **Testing**: Built-in Node.js test runner (`node --test`).

---

## 3. Directory Structure

```
log-health-react/
├── dist/                      # Pre-built static bundle (HTML, JS, CSS)
│   ├── assets/                # Minified bundles and web worker assets
│   └── index.html             # Production entry point
├── examples/                  # Sample datasets for testing
│   ├── demo.jsonl             # Synthetic log dataset demonstrating database/backend issues
│   └── telemetry-2026-10-16.json # Synthetic client session recording with user journeys & 404s
├── src/                       # Source code
│   ├── analysis.mjs           # Data pipeline: normalization, heuristics, playbooks, telemetry analytics
│   ├── App.jsx                # Main React UI component, hash router, and server triage view
│   ├── TelemetryView.jsx      # Dedicated Client Telemetry Studio: session replay & API diagnosis
│   ├── telemetry-main.jsx     # Standalone mount entry for telemetry.html
│   ├── log.worker.js          # Web worker wrapper for parsing
│   ├── main.jsx               # React DOM bootstrap
│   └── style.css              # Dashboard stylesheet & telemetry flow designs
├── tests/                     # Unit & integration tests
│   └── analysis.test.mjs      # Test suite for parsing, boundaries, grouping, telemetry
├── index.html                 # Primary HTML entry point
├── telemetry.html             # Dedicated standalone HTML page for Client Telemetry Studio
├── package.json               # Scripts and dependency specifications
├── serve.mjs                  # Native Node.js web server for dist/
├── README.md                  # Quickstart guide
├── VALIDATION.md              # Acceptance criteria & validation checklist
└── PROJECT_OVERVIEW.md        # Comprehensive project documentation
```

---

## 4. How It Works: The Data Pipeline

The log processing pipeline is encapsulated inside [`src/analysis.mjs`](file:///d:/UBUNTU%20DATA/01_Experiments/log-health-react/src/analysis.mjs):

1. **Input Ingestion (`parseLog`)**:
   - Accepts JSON-lines (`.log`, `.txt`, `.jsonl`, `.ndjson`) or JSON arrays (`.json`) up to 50 MB.
   - Strips UTF-8 BOM headers and skips corrupt or malformed rows while collecting their line numbers for reporting.
   - Seamlessly ingests client telemetry format (`ACTION` and `LOG` records).
2. **Normalization (`normalize`)**:
   - Accommodates standard Serilog compact keys (`@t`, `@mt`, `@m`, `@l`, `@x`, `@tr`) and standard JSON log fields (`timestamp`, `message`, `level`, `path`, etc.).
   - Normalizes client telemetry actions (`r.event.action`, `r.event.timestamp`, `r.event.category`) and HTTP error statuses (`r.event.data.status`, `r.extra.status`).
   - Extracts underlying exceptions from stack traces, and removes trailing latencies (e.g. `(45ms)`) and query strings so recurring 404 endpoints group together.
3. **Categorization & Playbooks (`categoryOf`, `PLAYBOOKS`)**:
   - Categorizes logs into deterministic issue categories:
     - **Endpoint not found (404)**: Client requested route missing or unmapped on API backend (Urgency 1).
     - **Server error (500)**: Backend unhandled exception (Urgency 0).
     - **Auth / Permission (401/403)**: Session expiration or missing permissions (Urgency 1).
     - **Missing procedure**: Database migration or schema mismatch (Urgency 0 — highest).
     - **Missing database column**: Schema out-of-sync with application SQL (Urgency 0).
     - **Database deadlock**: Concurrent locking issues (Urgency 1).
     - **Timeout**: SQL, HTTP, or gateway latency issues (Urgency 1).
     - **Null reference**: Missing object handling (Urgency 1).
     - **Data parsing**: Type conversion failure between DB and model (Urgency 1).
     - **Index out of range**: Collection boundary assumptions (Urgency 1).
     - **UI Interaction / Navigation / API Call**: Telemetry event classifications.
     - **Other**: Catch-all for uncategorized errors (Urgency 2).
4. **Aggregation & Prioritization (`analyze`)**:
   - Groups error events by `[category, rootPattern]`.
   - Assigns priority ranks:
     - `Investigate first` (Rank 0): Database schema or dependency breakages, server 500 errors.
     - `Review next` (Rank 1): High-volume recurring issues ($\ge 10$ occurrences, recurring 404s).
     - `Review` (Rank 2): Lower frequency or isolated incidents.
   - Computes UTC timestamp extent, daily counts, affected request paths, source modules, and trace coverage.

---

## 5. UI Features & Capabilities

- **Dual-Page / Dedicated Workspaces**:
  - **📱 Client Telemetry Studio** (`#/telemetry` or `telemetry.html`):
    - **Step-by-Step User Journey Session Replay**: Chronological step chain connecting button clicks, route navigations, and API calls.
    - **Deep 404/500 Failure Diagnosis**: Automatically surfaces the exact server response messages (e.g. *"No active subscriptions found for this party."*, *"No delivery areas found."*) to diagnose root causes without guesswork.
    - **API Endpoint Health & Latency Table**: Detailed tracking of total requests, error rates, average and peak latency (with slow call warnings), and status breakdowns.
    - **User Directory & Device Demographics**: Profiles for authenticated and guest users (Party ID, Mobile, Unit ID, Device model, screen size).
    - **Interaction Heatbars**: Visual breakdown of top clicked UI elements and most visited routes.
    - **Forensic Inspector**: Deep drawer on each event node with raw payloads, query parameters, and breadcrumbs.
  - **🩺 Server Log Health** (`#/server-logs` or `index.html`):
    - Backend database deadlock triage, missing column playbooks, schema verification, and exception traces.
- **Preset Dataset Toggles**: Instant 1-click loading for `telemetry-2026-10-16.json` and `demo.jsonl`.
- **Global UTC / IST Date Filter**: Filter by `From` and `To` dates, or one-click presets (`Latest day`, `Last 7 log days`, `All dates`). All metrics, charts, and issue lists synchronize instantly.
- **Search & Filter Controls**: Filter by free text across all JSON properties, error category, or log level.
- **Key Metric Indicators**:
  - Selected entries
  - Total error/fatal entries
  - Issue groups
  - Distinct affected endpoints

- **Insights Bar**:
  - *Biggest repeated issue* (percentage of total errors)
  - *Busiest error day* (peak UTC error volume)
  - *Investigation coverage* (% of errors with Request/Trace IDs)
- **Prioritized Investigation Queue**:
  - Expandable issue cards displaying first/last seen UTC timestamps, involved paths/modules, investigation steps, and QA checklists.
  - Manual in-memory workflow state dropdown (`New`, `Investigating`, `Ready for QA`, `Verified by me`).
  - Single-issue Markdown export (`Download issue brief ↓`).
  - Full-scope snapshot export (`Export action report ↓`).
  - One-click `Inspect related logs` to instantly drill down into relevant log records.
- **Visual Charts**:
  - Error volume timeline across UTC dates (clickable bars to isolate a day).
  - Categorical distribution rank bars.
  - Top 5 affected endpoints and top 5 source modules.
- **Log Evidence Explorer**:
  - Paginated log viewer (20 per page) sorted newest first.
  - Expandable entries with formatted exception stack traces and raw JSON inspector.

---

## 6. How to Run the Application

### Method A: Fastest Option (Using Included Pre-built Bundle)
*Requires Node.js 22.12 or newer. No `npm install` needed.*

```powershell
node serve.mjs
```
- Open browser at: **http://localhost:4173**
- Test with the included sample file: [`examples/demo.jsonl`](file:///d:/UBUNTU%20DATA/01_Experiments/log-health-react/examples/demo.jsonl)

### Method B: Development Mode (Vite Dev Server)
*For modifying source code with Hot Module Replacement (HMR).*

```powershell
npm ci
npm run dev
```
- Open the Vite local dev URL printed in terminal (default: **http://127.0.0.1:5173**).

### Method C: Run Automated Tests
*Uses Node's native test runner (zero external test runner dependencies).*

```powershell
node --test tests/analysis.test.mjs
# or
npm test
```

### Method D: Build for Production
```powershell
npm run build
```
Builds the output into the [`dist/`](file:///d:/UBUNTU%20DATA/01_Experiments/log-health-react/dist) directory.

---

## 7. Current Server Status

The local production server is running in the background:
- **URL**: [http://localhost:4173](http://localhost:4173)
- **Process**: `node serve.mjs` (Serving `dist/`)
- **Ready for uploads**: Drag and drop any `.log`, `.jsonl`, or `.json` file or use `examples/demo.jsonl`.
