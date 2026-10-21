import React, { useEffect, useMemo, useRef, useState } from 'react';
import { analyze, filterEntries, group, isError, issueReport, day, analyzeTelemetry } from './analysis.mjs';
import TelemetryView from './TelemetryView.jsx';

const number = n => n.toLocaleString('en-IN');

const toIST = t => {
  if (t === null) return 'Not recorded';
  const d = new Date(t);
  if (isNaN(d.getTime())) return 'Invalid timestamp';
  const ist = new Date(d.getTime() + 5.5 * 3600000);
  const pad = n => String(n).padStart(2, '0');
  const y = ist.getUTCFullYear(), m = pad(ist.getUTCMonth() + 1), day = pad(ist.getUTCDate());
  let hours = ist.getUTCHours();
  const mins = pad(ist.getUTCMinutes()), secs = pad(ist.getUTCSeconds()), ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${y}-${m}-${day} ${pad(hours)}:${mins}:${secs} ${ampm} IST`;
};

const toISTDate = t => {
  if (t === null) return 'Unknown';
  const d = new Date(t);
  if (isNaN(d.getTime())) return 'Unknown';
  const ist = new Date(d.getTime() + 5.5 * 3600000);
  const pad = n => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`;
};

const time = toIST;
const initialFilters = { from: '', to: '', query: '', category: '', level: '' };

function download(name, text, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Bars({ items, empty = 'No entries in this selection.' }) {
  return items.length ? (
    <div className="ranks">
      {items.map(([label, n], idx) => (
        <div key={label} className="rank">
          <div>
            <span className="rank-label">{label}</span>
            <strong>{number(n)}</strong>
          </div>
          <div className="track">
            <div className={`bar-track-fill bar-fill-${idx % 5}`} style={{ width: `${Math.max(3, (100 * n) / items[0][1])}%` }} />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <p className="empty">{empty}</p>
  );
}

function Issue({ issue, status, onStatus, onInspect }) {
  const p = issue.playbook;
  return (
    <details className="issue">
      <summary>
        <span className={`priority p${issue.rank}`}>
          <span className="priority-dot" />
          {issue.priority}
        </span>
        <div className="issue-title">
          <strong>{issue.title}</strong>
          <span>
            <span className="issue-cat-tag">{issue.category}</span> · {p.owner}
          </span>
        </div>
        <span className="issue-total">
          <strong>{number(issue.count)}</strong>
          <small>{issue.share.toFixed(1)}% of errors</small>
        </span>
        <span className="chevron">⌄</span>
      </summary>
      <div className="issue-body">
        <div className="evidence">
          <span>
            <b>First seen (IST)</b>{time(issue.first)}
          </span>
          <span>
            <b>Last seen (IST)</b>{time(issue.last)}
          </span>
          <span>
            <b>Logged identifiers</b>{issue.requestIds} request/event IDs · {issue.jobIds} job IDs
          </span>
        </div>
        <p className="note">
          <b>Why this priority:</b> {issue.reason}. Confirm user impact before assigning incident severity.
        </p>
        <div className="two-col">
          <div>
            <div className="callout callout-cause">
              <h3>Possible cause · needs confirmation</h3>
              <p>{p.cause}</p>
            </div>
            <div className="callout callout-impact">
              <h3>Potential impact</h3>
              <p>{p.impact}</p>
            </div>
            <h3>Affected areas</h3>
            <ul className="affected-list">
              {(issue.paths.length ? issue.paths : issue.modules).slice(0, 5).map(([path, n]) => (
                <li key={path}>
                  <code>{path}</code> <span className="muted count-badge">({n} entries)</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Investigation steps</h3>
            <ol className="steps-list">
              {p.steps.map(s => <li key={s}>{s}</li>)}
            </ol>
            <h3>QA verification</h3>
            <ul className="qa-list">
              {p.qa.map(s => <li key={s}><span className="check-box">✓</span> {s}</li>)}
            </ul>
          </div>
        </div>
        <div className="issue-actions">
          <label>
            Manual workflow
            <select value={status} onChange={e => onStatus(e.target.value)}>
              {['New', 'Investigating', 'Ready for QA', 'Verified by me'].map(x => <option key={x}>{x}</option>)}
            </select>
          </label>
          <button className="secondary" onClick={onInspect}>Inspect related logs</button>
          <button className="secondary download-btn" onClick={() => download('log-issue.md', issueReport(issue, status))}>
            Download issue brief ↓
          </button>
        </div>
        <p className="muted small">Workflow choices last for this upload only. “Verified by me” records your assessment; it does not measure current app health.</p>
      </div>
    </details>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [drag, setDrag] = useState(false);
  const [statuses, setStatuses] = useState({});
  const [selected, setSelected] = useState('');
  const [page, setPage] = useState(0);

  // Separate page routing: 'telemetry' or 'server_logs'
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#/server-logs') return 'server_logs';
    return 'telemetry';
  });

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash;
      if (h === '#/server-logs') setActiveTab('server_logs');
      else if (h === '#/telemetry') setActiveTab('telemetry');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const switchPage = tab => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab === 'telemetry' ? '#/telemetry' : '#/server-logs';
    }
  };

  const input = useRef(null);
  const worker = useRef(null);
  const logs = useRef(null);
  const loading = useRef(false);

  const all = data?.entries || [];
  const filtered = useMemo(() => filterEntries(all, filters), [all, filters]);
  const a = useMemo(() => analyze(filtered), [filtered]);
  const original = useMemo(() => analyze(all), [all]);

  const isTelemetry = useMemo(
    () => all.some(r => r.raw?.type === 'ACTION' || r.raw?.type === 'LOG' || r.raw?.event),
    [all]
  );

  // Comprehensive telemetry analysis
  const telemetryData = useMemo(() => {
    if (!all.length) return null;
    return analyzeTelemetry(filtered);
  }, [filtered, all.length]);

  const visibleLogs = useMemo(() =>
    filtered
      .filter(r => !selected || r.issueKey === selected)
      .toSorted((x, y) => (y.time ?? -Infinity) - (x.time ?? -Infinity)),
    [filtered, selected]
  );

  const biggest = a.issues.toSorted((x, y) => y.count - x.count)[0];
  const peak = a.days.toSorted((x, y) => y[1] - x[1])[0];

  function update(key, value) {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(0);
    setSelected('');
  }

  function finish() {
    loading.current = false;
    setBusy(false);
    worker.current?.terminate();
    worker.current = null;
    if (input.current) input.current.value = '';
  }

  function load(file) {
    if (!file || loading.current) return;
    if (file.size > 50 * 1024 * 1024) {
      setNotice('Choose a file up to 50 MB. Your current snapshot has been kept.');
      return;
    }
    loading.current = true;
    setBusy(true);
    setNotice('Reading and parsing entries…');
    try {
      worker.current = new Worker(new URL('./log.worker.js', import.meta.url), { type: 'module' });
      worker.current.onmessage = ({ data: result }) => {
        if (!result.ok || !result.entries.length) {
          setNotice((result.message || 'No supported log or telemetry records found.') + ' Your previous snapshot has been kept.');
          finish();
          return;
        }
        setData({ ...result, name: file.name, bytes: file.size });
        setFilters(initialFilters);
        setStatuses({});
        // Automatically choose the best page based on loaded data
        const detectedTelemetry = result.entries.some(
          r => r.raw?.type === 'ACTION' || r.raw?.type === 'LOG' || r.raw?.event
        );
        switchPage(detectedTelemetry ? 'telemetry' : 'server_logs');

        setNotice(
          result.bad.length
            ? `${number(result.bad.length)} unsupported or malformed records skipped. Source positions: ${result.bad.slice(0, 10).join(', ')}${result.bad.length > 10 ? '…' : ''}.`
            : ''
        );
        finish();
      };
      worker.current.onerror = () => {
        setNotice('Could not read this file. Your previous snapshot has been kept.');
        finish();
      };
      worker.current.postMessage(file);
    } catch {
      setNotice('Could not start file reading. Please run the app through its local web server.');
      finish();
    }
  }

  async function loadSample(filename) {
    if (loading.current) return;
    setBusy(true);
    setNotice(`Loading ${filename}…`);
    try {
      const res = await fetch(`./examples/${filename}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const file = new File([text], filename, {
        type: filename.endsWith('.json') ? 'application/json' : 'text/plain'
      });
      load(file);
    } catch (err) {
      setNotice(`Could not auto-fetch ${filename} (${err.message}). You can drag and drop it from the examples folder.`);
      setBusy(false);
    }
  }

  function preset(days) {
    if (original.last === null) return;
    const end = day(original.last);
    const start = day(Date.parse(end + 'T00:00:00Z') - (days - 1) * 86400000);
    setFilters(f => ({ ...f, from: start, to: end }));
    setSelected('');
    setPage(0);
  }

  function exportReport() {
    const header = `# Log & Telemetry Snapshot\n\nFile: ${data?.name}\nActive Mode: ${activeTab === 'telemetry' ? 'Client Telemetry Explorer' : 'Server Log Health'}\nSelected dates: ${filters.from || 'all'} through ${filters.to || 'all'} (IST)\nTotal entries: ${all.length}; Errors: ${a.errors}.\nAll timestamps formatted in Indian Standard Time (IST, UTC+05:30).\n\n`;
    download('health-report.md', header + a.issues.map(i => issueReport(i, statuses[i.key] || 'New')).join('\n---\n'));
  }

  return (
    <>
      <header>
        <a className="brand" href="./">
          <span className="brand-icon">∿</span> Log Health
        </a>
        <nav className="header-page-nav" aria-label="Page switcher">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => switchPage('telemetry')}
          >
            <span className="tab-icon">📱</span> Client Telemetry Studio
            {isTelemetry && data && <span className="tab-pill">Active</span>}
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'server_logs' ? 'active' : ''}`}
            onClick={() => switchPage('server_logs')}
          >
            <span className="tab-icon">🩺</span> Server Log Health
            {!isTelemetry && data && <span className="tab-pill">Active</span>}
          </button>
        </nav>
        <span className="pill">
          <span className="pill-dot" />
          IST (UTC+05:30)
        </span>
      </header>

      <main>
        {activeTab === 'telemetry' ? (
          data && telemetryData ? (
            <TelemetryView
              telemetryData={telemetryData}
              datasetName={data.name}
              datasetBytes={data.bytes}
              onSwitchToServerLogs={() => switchPage('server_logs')}
              onLoadSample={loadSample}
              onUploadClick={() => input.current?.click()}
              busy={busy}
            />
          ) : (
            <section className="panel empty-state">
              <div className="empty-icon-box"><span className="empty-icon">📱</span></div>
              <h2>Client Telemetry & User Journey Studio</h2>
              <p>Replay interactive client sessions, inspect button clicks, track screen transitions, measure API latencies, and diagnose 404/500 failures.</p>
              <div className="empty-sample-actions">
                <div className="empty-sample-buttons">
                  <button className="primary-btn highlight-card" disabled={busy} onClick={() => loadSample('telemetry-2026-10-16.json')}>
                    <div className="sample-btn-title">📱 Launch Client Telemetry Demo (telemetry-2026-10-16.json)</div>
                    <small>User journeys (Shubham Kharche, Amit), button clicks, and API 404 diagnosis</small>
                  </button>
                  <button className="secondary sample-card-btn" disabled={busy} onClick={() => input.current?.click()}>
                    <div className="sample-btn-title">↑ Upload Telemetry JSON File</div>
                    <small>Client session recordings (.json) up to 50 MB</small>
                  </button>
                </div>
              </div>
            </section>
          )
        ) : (
          <>
            {/* Title and Top Action Presets */}
            <div className="title-row">
              <div>
                <div className="eyebrow">
                  <span className="eyebrow-badge">SERVER LOG HEALTH & TRIAGE</span>
                  LOG HEALTH WORKSPACE
                </div>
                <h1>From errors to next steps.</h1>
                <p className="muted">
                  Evidence, suggested investigations and QA checks in one place. All times shown in IST.
                </p>
              </div>

              <div className="top-action-bar">
                <div className="sample-toggle-group" role="group" aria-label="Dataset presets">
                  <span className="toggle-label">Presets:</span>
                  <button
                    type="button"
                    className={`toggle-btn ${data?.name === 'demo.jsonl' ? 'active' : ''}`}
                    disabled={busy}
                    onClick={() => loadSample('demo.jsonl')}
                    title="Load backend database error logs (deadlocks, missing columns)"
                  >
                    <span className="toggle-icon">📄</span> demo.jsonl
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${data?.name === 'telemetry-2026-10-16.json' ? 'active' : ''}`}
                    disabled={busy}
                    onClick={() => loadSample('telemetry-2026-10-16.json')}
                    title="Load client telemetry sample"
                  >
                    <span className="toggle-icon">📱</span> telemetry-2026-10-16.json
                  </button>
                </div>
                <button className="primary-btn" disabled={busy} onClick={() => input.current.click()}>
                  {busy ? 'Reading…' : '↑ Upload file'}
                </button>
                <input aria-label="Upload file" ref={input} type="file" accept=".log,.txt,.jsonl,.ndjson,.json" hidden onChange={e => load(e.target.files[0])} />
              </div>
            </div>

            {/* Global Date Filters */}
            <section className="top-filters" aria-label="Dashboard date filters">
              <div className="date-label">
                <strong>Analysis period</strong>
                <small>IST timezone · applies across dashboard</small>
              </div>
              <label>
                From
                <input aria-label="From date" type="date" value={filters.from} onChange={e => update('from', e.target.value)} />
              </label>
              <label>
                To
                <input aria-label="To date" type="date" value={filters.to} onChange={e => update('to', e.target.value)} />
              </label>
              <div className="quick">
                <button className="secondary" disabled={!data} onClick={() => preset(1)}>Latest day</button>
                <button className="secondary" disabled={!data} onClick={() => preset(7)}>Last 7 log days</button>
                <button className="secondary" onClick={() => { setFilters(f => ({ ...f, from: '', to: '' })); setPage(0); setSelected(''); }}>All dates</button>
              </div>
            </section>
            {filters.from && filters.to && filters.from > filters.to && (
              <p className="warning" role="alert">From date is after To date. Adjust the range to see results.</p>
            )}

            {/* Upload Zone */}
            <div
              className={`upload-zone ${drag ? 'drag' : ''}`}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files[0]); }}
            >
              <div className="upload-meta">
                <span className="upload-icon">⚡</span>
                <div>
                  <strong>{data ? data.name : 'Drop your server log file here'}</strong>
                  <p>
                    {data
                      ? `${number(all.length)} valid records · ${(data.bytes / 1024 / 1024).toFixed(2)} MB · ${original.first === null ? 'Unknown dates' : `${toISTDate(original.first)} → ${toISTDate(original.last)} IST`}`
                      : 'JSON-lines (.log, .txt, .jsonl), or JSON array (.json) · up to 50 MB'}
                  </p>
                </div>
              </div>
              <span className="privacy-badge">🔒 In-browser local processing</span>
            </div>
            <p className="notice" role="status" aria-live="polite">{notice}</p>

            {!data ? (
              <section className="panel empty-state">
                <div className="empty-icon-box"><span className="empty-icon">📂</span></div>
                <h2>Choose a dataset to explore.</h2>
                <p>Upload your own log file or click a preset below to test immediately:</p>
                <div className="empty-sample-actions">
                  <div className="empty-sample-buttons">
                    <button className="secondary sample-card-btn highlight-card" disabled={busy} onClick={() => loadSample('demo.jsonl')}>
                      <div className="sample-btn-title">📄 Backend Server Log (demo.jsonl)</div>
                      <small>Database deadlocks, missing columns & procedures triage (Serilog)</small>
                    </button>
                    <button className="secondary sample-card-btn" disabled={busy} onClick={() => loadSample('telemetry-2026-10-16.json')}>
                      <div className="sample-btn-title">📱 Client Telemetry (telemetry-2026-10-16.json)</div>
                      <small>User journeys (Shubham Kharche, Amit), button clicks, route transitions, and API 404s</small>
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <div className="server-logs-page">
                {/* Secondary filters for Server Logs */}
                <div className="secondary-filters">
                  <div className="filter-view-toggles" role="group" aria-label="Evidence level toggle">
                    <button
                      type="button"
                      className={`view-toggle-btn ${filters.level.toLowerCase() === 'error' ? 'active' : ''}`}
                      onClick={() => update('level', filters.level.toLowerCase() === 'error' ? '' : 'Error')}
                    >
                      ⚠️ Errors only {data && <span className="toggle-badge">{number(original.errors)}</span>}
                    </button>
                    <button
                      type="button"
                      className={`view-toggle-btn ${!filters.level ? 'active' : ''}`}
                      onClick={() => update('level', '')}
                    >
                      📋 All records {data && <span className="toggle-badge">{number(all.length)}</span>}
                    </button>
                  </div>
                  <label className="search">
                    Search all evidence
                    <input value={filters.query} onChange={e => update('query', e.target.value)} placeholder="Message, user, endpoint, device, ID…" />
                  </label>
                  <label>
                    Category
                    <select value={filters.category} onChange={e => update('category', e.target.value)}>
                      <option value="">All categories</option>
                      {[...new Set(all.map(r => r.category))].sort().map(x => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  <label>
                    Level
                    <select value={filters.level} onChange={e => update('level', e.target.value)}>
                      <option value="">All levels</option>
                      {[...new Set(all.map(r => r.level))].sort().map(x => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  <button className="secondary reset-btn" onClick={() => { setFilters(initialFilters); setSelected(''); setPage(0); }}>
                    Reset all
                  </button>
                </div>

                <div className="metrics">
                  {[
                    ['Selected entries', a.entries, 'Within every active filter', 'metric-entries'],
                    ['Error / fatal entries', a.errors, 'Events, not failed operations', 'metric-errors'],
                    ['Issue groups', a.issues.length, 'Grouped by underlying root cause', 'metric-issues'],
                    ['Affected endpoints', a.paths.length, 'Distinct paths with recorded events', 'metric-endpoints']
                  ].map(([label, n, help, cls]) => (
                    <article key={label} className={`metric-card ${cls}`}>
                      <span>{label}</span>
                      <strong>{data ? number(n) : '—'}</strong>
                      <small>{help}</small>
                    </article>
                  ))}
                </div>

                <div className="insight-grid">
                  <article className="insight insight-rose">
                    <div className="eyebrow">BIGGEST REPEATED ISSUE</div>
                    <h2>{biggest ? `${biggest.share.toFixed(1)}% of error entries` : 'No error entries selected'}</h2>
                    <p>{biggest ? biggest.title : 'Try a wider date range or clear your filters.'}</p>
                    {biggest && <small>{number(biggest.count)} entries share this underlying message.</small>}
                  </article>
                  <article className="insight insight-amber">
                    <div className="eyebrow">BUSIEST ERROR DAY</div>
                    <h2>{peak ? peak[0] : 'No dated errors'}</h2>
                    <p>{peak ? `${number(peak[1])} recorded error entries on this IST date.` : 'A valid timestamp is needed for the timeline.'}</p>
                    <small>Volume reflects the supplied log coverage.</small>
                  </article>
                  <article className="insight insight-cyan">
                    <div className="eyebrow">INVESTIGATION COVERAGE</div>
                    <h2>{a.traceCoverage.toFixed(0)}% have request / event IDs</h2>
                    <p>{number(a.withoutPath)} error entries have no request path.</p>
                    <small>Identified across request IDs and session tokens.</small>
                  </article>
                </div>

                <section className="panel action-panel">
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">START HERE</div>
                      <h2>Prioritized investigation queue</h2>
                      <p className="muted">Suggested triage, not incident severity. Open an issue for evidence and a concrete checklist.</p>
                    </div>
                    <button className="secondary export-btn" disabled={!a.issues.length} onClick={exportReport}>
                      Export action report (IST) ↓
                    </button>
                  </div>
                  {a.issues.length ? (
                    a.issues.map(i => (
                      <Issue
                        key={i.key}
                        issue={i}
                        status={statuses[i.key] || 'New'}
                        onStatus={s => setStatuses(old => ({ ...old, [i.key]: s }))}
                        onInspect={() => {
                          setSelected(i.key);
                          setPage(0);
                          logs.current.scrollIntoView({ behavior: 'smooth' });
                        }}
                      />
                    ))
                  ) : (
                    <p className="empty">No error-level entries match this selection.</p>
                  )}
                </section>

                <div className="two-col chart-panels">
                  <section className="panel">
                    <div className="panel-head">
                      <h2>Activity timeline</h2>
                      <span className="muted small">Recorded dates · IST</span>
                    </div>
                    <div className="chart">
                      {a.days.length ? (
                        a.days.map(([d, n]) => (
                          <button
                            key={d}
                            className="bar-column"
                            title={`${d}: ${n} entries. Click to filter.`}
                            onClick={() => {
                              setFilters(f => ({ ...f, from: d, to: d }));
                              setPage(0);
                              setSelected('');
                            }}
                          >
                            <b>{number(n)}</b>
                            <span className="bar" style={{ height: `${Math.max(6, (130 * n) / (peak ? peak[1] : 1))}px` }} />
                            <small>{d.slice(5)}</small>
                          </button>
                        ))
                      ) : (
                        <p className="empty">No timestamped entries in this selection.</p>
                      )}
                    </div>
                  </section>

                  <section className="panel">
                    <div className="panel-head">
                      <h2>Categories</h2>
                      <span className="muted small">Rule-based distribution</span>
                    </div>
                    <Bars items={a.categories} />
                  </section>
                </div>

                <div className="two-col chart-panels">
                  <section className="panel">
                    <h2>Top affected endpoints / routes</h2>
                    <Bars items={a.paths.slice(0, 5)} />
                  </section>
                  <section className="panel">
                    <h2>Top sources / targets</h2>
                    <Bars items={a.modules.slice(0, 5)} />
                  </section>
                </div>

                <section className="panel" ref={logs}>
                  <div className="panel-head">
                    <div>
                      <h2>Log evidence</h2>
                      <p className="muted">{number(visibleLogs.length)} entries · newest first · IST</p>
                    </div>
                    {selected && (
                      <button className="secondary" onClick={() => { setSelected(''); setPage(0); }}>
                        Clear issue selection ×
                      </button>
                    )}
                  </div>

                  {visibleLogs.slice(page * 20, (page + 1) * 20).map((r, i) => (
                    <details className="log" key={`${r.line}-${i}`}>
                      <summary>
                        <span className="small muted log-time">{time(r.time)}</span>
                        <span className={`level level-${String(r.level).toLowerCase()}`}>{r.level}</span>
                        <span className="log-title">
                          {r.message}
                          <small>{r.path || r.module}</small>
                        </span>
                        <span className="chevron">⌄</span>
                      </summary>
                      <div className="log-body">
                        <strong><span className="issue-cat-tag">{r.category}</span> · source record {r.line}</strong>
                        {r.raw['@x'] && (
                          <>
                            <h3>Exception / stack trace</h3>
                            <pre className="trace-box">{r.raw['@x']}</pre>
                          </>
                        )}
                        <h3>Full record</h3>
                        <pre className="json-box">{JSON.stringify(r.raw, null, 2)}</pre>
                      </div>
                    </details>
                  ))}

                  {!visibleLogs.length && <p className="empty">No matching entries.</p>}

                  <div className="pagination">
                    <span>
                      {visibleLogs.length
                        ? `${page * 20 + 1}–${Math.min((page + 1) * 20, visibleLogs.length)} of ${number(visibleLogs.length)}`
                        : '0 entries'}
                    </span>
                    <div>
                      <button className="secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                        ← Previous
                      </button>
                      <button className="secondary" disabled={(page + 1) * 20 >= visibleLogs.length} onClick={() => setPage(p => p + 1)}>
                        Next →
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </>
        )}

        <footer>
          <span>Log & Telemetry analysis · rules are transparent and editable · Indian Standard Time (IST)</span>
          <span>New upload replaces data and workflow choices. Reload clears the session.</span>
        </footer>
      </main>
    </>
  );
}
