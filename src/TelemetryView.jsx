import React, { useState, useMemo } from 'react';

const number = n => (typeof n === 'number' ? n.toLocaleString('en-IN') : n);

const toIST = t => {
  if (t === null || t === undefined) return 'Not recorded';
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

const toISTTimeOnly = t => {
  if (t === null || t === undefined) return '--:--:--';
  const d = new Date(t);
  if (isNaN(d.getTime())) return '--:--:--';
  const ist = new Date(d.getTime() + 5.5 * 3600000);
  const pad = n => String(n).padStart(2, '0');
  let hours = ist.getUTCHours();
  const mins = pad(ist.getUTCMinutes()), secs = pad(ist.getUTCSeconds()), ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${pad(hours)}:${mins}:${secs} ${ampm} IST`;
};

export default function TelemetryView({
  telemetryData,
  datasetName,
  datasetBytes,
  onSwitchToServerLogs,
  onUploadClick,
  busy
}) {
  const [activeSubTab, setActiveSubTab] = useState('journey');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState('');

  // Select first user by default if not chosen
  const activeUser = useMemo(() => {
    if (!telemetryData?.users?.length) return null;
    if (selectedUserId) {
      return (
        telemetryData.users.find(u => String(u.id) === selectedUserId || u.name === selectedUserId) ||
        telemetryData.users[0]
      );
    }
    return telemetryData.users[0];
  }, [telemetryData, selectedUserId]);

  // Filtered events for the selected user journey or global
  const filteredEvents = useMemo(() => {
    if (!telemetryData?.events) return [];
    let list = telemetryData.events;

    if (activeUser && activeSubTab === 'journey') {
      list = list.filter(e => {
        if (activeUser.id && e.user?.id) return e.user.id === activeUser.id;
        return e.user?.name === activeUser.name;
      });
    }

    if (eventTypeFilter !== 'all') {
      if (eventTypeFilter === 'clicks') list = list.filter(e => e.eventType === 'click');
      else if (eventTypeFilter === 'routes') list = list.filter(e => e.eventType === 'route');
      else if (eventTypeFilter === 'api') list = list.filter(e => e.eventType === 'api_ok' || e.eventType === 'api_error');
      else if (eventTypeFilter === 'errors') list = list.filter(e => e.eventType === 'api_error' || e.eventType === 'error');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        e =>
          e.message?.toLowerCase().includes(q) ||
          e.path?.toLowerCase().includes(q) ||
          e.target?.toLowerCase().includes(q) ||
          e.responseMessage?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [telemetryData, activeUser, activeSubTab, eventTypeFilter, searchQuery]);

  function copyText(id, text) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 1500);
  }

  function downloadReport() {
    if (!telemetryData) return;
    const report = `# Client Telemetry & User Journey Report\n\n` +
      `File: ${datasetName || 'telemetry.json'}\n` +
      `Generated: ${toIST(Date.now())}\n\n` +
      `## Summary Metrics\n` +
      `- Total Recorded Events: ${telemetryData.totalEvents}\n` +
      `- Active Users: ${telemetryData.users.length} (${telemetryData.users.map(u => u.name).join(', ')})\n` +
      `- API Success Rate: ${telemetryData.apiSuccessRate.toFixed(1)}% (${telemetryData.apiCalls} calls, ${telemetryData.apiErrors} failed)\n` +
      `- Average API Latency: ${telemetryData.avgLatency} ms (Peak: ${telemetryData.maxLatency} ms)\n\n` +
      `## Failing Endpoints (404/500)\n` +
      telemetryData.apiList.filter(a => a.errors > 0).map(a =>
        `### ${a.endpoint}\n` +
        `- Errors: ${a.errors} / ${a.calls} calls (${((a.errors / a.calls) * 100).toFixed(0)}% fail rate)\n` +
        `- Avg Latency: ${a.avgDuration} ms (Max: ${a.maxDuration} ms)\n` +
        `- Response Messages: ${a.responseMessages.join(' | ') || 'None'}\n` +
        `- Impacted Users: ${a.userList.join(', ')}\n`
      ).join('\n') +
      `\n## User Journey Summaries\n` +
      telemetryData.users.map(u =>
        `### ${u.name} (Party ID: ${u.partyId || 'N/A'}, Mobile: ${u.mobile || 'N/A'})\n` +
        `- Total Actions: ${u.actions} (${u.errors} errors)\n` +
        `- Device: ${u.deviceNames}\n` +
        `- Screens: ${u.pathsVisited.join(', ') || '/'}\n`
      ).join('\n');

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry-report-${Date.now()}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="telemetry-studio">
      {/* Top Banner Navigation */}
      <div className="studio-header">
        <div className="studio-header-left">
          <div className="studio-badge">
            <span className="badge-pulse" />
            CLIENT TELEMETRY STUDIO
          </div>
          <h1 className="studio-title">User Journey & API Diagnostic Explorer</h1>
          <p className="studio-desc">
            Deep forensic analysis of user sessions, button clicks, API latencies, and client-side 404/500 root causes.
          </p>
        </div>

        <div className="studio-header-right">
          <div className="studio-actions">
            <button type="button" className="action-btn secondary" onClick={downloadReport} title="Export markdown report">
              📥 Export Report
            </button>
            <button type="button" className="action-btn primary" onClick={onUploadClick} disabled={busy}>
              {busy ? 'Reading…' : '↑ Upload File'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="telemetry-kpi-row">
        <div className="kpi-card glass-blue">
          <div className="kpi-top">
            <span className="kpi-title">User Sessions</span>
            <span className="kpi-icon">👥</span>
          </div>
          <div className="kpi-main">
            <span className="kpi-value">{telemetryData.users.length}</span>
            <span className="kpi-tag">{telemetryData.users.filter(u => u.partyId).length} Authenticated</span>
          </div>
          <div className="kpi-footer">
            {telemetryData.users.slice(0, 3).map(u => (
              <span key={u.name} className="user-pill-mini">
                👤 {u.name.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>

        <div className="kpi-card glass-red">
          <div className="kpi-top">
            <span className="kpi-title">API Success Rate</span>
            <span className="kpi-icon">⚡</span>
          </div>
          <div className="kpi-main">
            <span className="kpi-value">{telemetryData.apiSuccessRate.toFixed(1)}%</span>
            <span className={`kpi-tag ${telemetryData.apiErrors ? 'tag-warn' : 'tag-good'}`}>
              {telemetryData.apiErrors} Failed Calls
            </span>
          </div>
          <div className="kpi-footer">
            <span>{number(telemetryData.apiCalls)} total requests recorded</span>
          </div>
        </div>

        <div className="kpi-card glass-amber">
          <div className="kpi-top">
            <span className="kpi-title">API Latency</span>
            <span className="kpi-icon">⏱️</span>
          </div>
          <div className="kpi-main">
            <span className="kpi-value">{telemetryData.avgLatency} <small>ms</small></span>
            <span className="kpi-tag tag-peak">Peak {telemetryData.maxLatency} ms</span>
          </div>
          <div className="kpi-footer">
            <span>{telemetryData.maxLatency > 500 ? '⚠️ High latency spikes detected' : '⚡ Response times healthy'}</span>
          </div>
        </div>

        <div className="kpi-card glass-cyan">
          <div className="kpi-top">
            <span className="kpi-title">UI Activity</span>
            <span className="kpi-icon">🖱️</span>
          </div>
          <div className="kpi-main">
            <span className="kpi-value">{number(telemetryData.totalEvents)}</span>
            <span className="kpi-tag">Total Actions</span>
          </div>
          <div className="kpi-footer">
            <span>{telemetryData.uiList.reduce((s, x) => s + x.count, 0)} clicks · {telemetryData.routeList.reduce((s, x) => s + x.count, 0)} navigations</span>
          </div>
        </div>
      </div>

      {/* Main Studio Navigation Bar */}
      <div className="studio-tabs-bar">
        <div className="tabs-left">
          <button
            type="button"
            className={`studio-tab-item ${activeSubTab === 'journey' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('journey')}
          >
            🎬 User Journey & Session Replay
            <span className="tab-counter">{telemetryData.users.length} Users</span>
          </button>

          <button
            type="button"
            className={`studio-tab-item ${activeSubTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('api')}
          >
            🌐 API Endpoints & Failure Diagnosis
            <span className="tab-counter">{telemetryData.apiList.length} Endpoints</span>
          </button>

          <button
            type="button"
            className={`studio-tab-item ${activeSubTab === 'interactions' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('interactions')}
          >
            📱 UI Clicks & Screen Flows
            <span className="tab-counter">{telemetryData.uiList.length} Targets</span>
          </button>
        </div>

        <div className="tabs-right">
          <button
            type="button"
            className="switch-back-btn"
            onClick={onSwitchToServerLogs}
            title="Switch to Server Log Health (Database deadlock & backend exception triage)"
          >
            🩺 Switch to Server Log Health →
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: USER JOURNEY & SESSION REPLAY                                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'journey' && (
        <div className="journey-layout">
          {/* Left Column: User Session Selector Cards */}
          <aside className="user-sidebar">
            <div className="sidebar-header">
              <h3>Recorded User Sessions ({telemetryData.users.length})</h3>
              <p>Select a user to replay their complete step-by-step experience:</p>
            </div>

            <div className="user-card-list">
              {telemetryData.users.map(u => {
                const isSelected = activeUser && (activeUser.id ? activeUser.id === u.id : activeUser.name === u.name);
                return (
                  <div
                    key={u.id || u.name}
                    className={`user-session-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedUserId(String(u.id || u.name))}
                  >
                    <div className="usc-top">
                      <div className="usc-avatar">{u.name.charAt(0).toUpperCase()}</div>
                      <div className="usc-info">
                        <strong>{u.name}</strong>
                        <span className="usc-role">
                          {u.partyId ? `Party #${u.partyId}` : 'Guest User'}
                          {u.mobile ? ` · 📞 ${u.mobile}` : ''}
                        </span>
                      </div>
                      {u.errors > 0 ? (
                        <span className="usc-err-badge">🔴 {u.errors} Err</span>
                      ) : (
                        <span className="usc-ok-badge">🟢 Clean</span>
                      )}
                    </div>

                    <div className="usc-details">
                      <div className="usc-stat">
                        <span className="usc-stat-label">Device</span>
                        <span className="usc-stat-val" title={u.deviceNames}>
                          {u.deviceNames ? u.deviceNames.split('(')[0] : 'Unknown'}
                        </span>
                      </div>
                      <div className="usc-stat">
                        <span className="usc-stat-label">Events</span>
                        <span className="usc-stat-val">{u.actions}</span>
                      </div>
                      <div className="usc-stat">
                        <span className="usc-stat-label">Screens</span>
                        <span className="usc-stat-val">{u.pathsVisited.join(', ') || '/'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Right Column: Interactive Step-by-Step Session Flow */}
          <section className="journey-flow-view">
            {activeUser && (
              <div className="flow-profile-header">
                <div className="profile-hero">
                  <div className="profile-avatar-lg">{activeUser.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <h2>{activeUser.name}’s User Journey</h2>
                    <div className="profile-meta-tags">
                      {activeUser.partyId > 0 && <span className="meta-pill">Party ID: {activeUser.partyId}</span>}
                      {activeUser.mobile && <span className="meta-pill">Mobile: {activeUser.mobile}</span>}
                      {activeUser.unitId > 0 && <span className="meta-pill">Unit ID: {activeUser.unitId}</span>}
                      {activeUser.organizationId > 0 && <span className="meta-pill">Org ID: {activeUser.organizationId}</span>}
                      <span className="meta-pill">{activeUser.deviceNames || 'Mobile Device'}</span>
                      <span className="meta-pill">⏱️ Session Span: {toISTTimeOnly(activeUser.firstTime)} → {toISTTimeOnly(activeUser.lastTime)}</span>
                    </div>
                  </div>
                </div>

                {/* Filter Toolbar for Steps */}
                <div className="journey-toolbar">
                  <div className="type-filter-chips">
                    {[
                      ['all', 'All Events'],
                      ['clicks', '🖱️ Clicks'],
                      ['routes', '🧭 Navigations'],
                      ['api', '🌐 API Calls'],
                      ['errors', '❌ Errors (404s)']
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={`chip-btn ${eventTypeFilter === key ? 'active' : ''}`}
                        onClick={() => setEventTypeFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="search-box">
                    <input
                      type="text"
                      placeholder="Filter user steps (e.g. Geofence, 404, button)…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button type="button" className="clear-btn" onClick={() => setSearchQuery('')}>×</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Visual Step-by-Step Node Chain */}
            <div className="journey-steps-chain">
              {filteredEvents.length === 0 ? (
                <div className="empty-flow">
                  <p>No events found for this filter.</p>
                </div>
              ) : (
                filteredEvents.map((evt, idx) => {
                  const isError = evt.eventType === 'api_error' || evt.eventType === 'error';
                  const isApi = evt.eventType === 'api_ok' || evt.eventType === 'api_error';
                  const isClick = evt.eventType === 'click';
                  const isRoute = evt.eventType === 'route';

                  return (
                    <div
                      key={evt.id || idx}
                      className={`flow-node-card ${isError ? 'node-error' : isClick ? 'node-click' : isRoute ? 'node-route' : 'node-api'}`}
                    >
                      <div className="node-step-indicator">
                        <span className="node-num">#{idx + 1}</span>
                        <div className="node-icon-bubble">
                          {isClick && '🖱️'}
                          {isRoute && '🧭'}
                          {evt.eventType === 'api_ok' && '✅'}
                          {evt.eventType === 'api_error' && '❌'}
                          {evt.eventType === 'log' && '📝'}
                          {evt.eventType === 'error' && '⚠️'}
                        </div>
                        {idx < filteredEvents.length - 1 && <div className="node-connector-line" />}
                      </div>

                      <div className="node-content">
                        <div className="node-header">
                          <div className="node-header-tags">
                            <span className="node-time">{toISTTimeOnly(evt.time)}</span>
                            <span className={`node-type-badge type-${evt.eventType}`}>
                              {isClick && 'UI Click'}
                              {isRoute && 'Route Navigation'}
                              {evt.eventType === 'api_ok' && 'API 200 OK'}
                              {evt.eventType === 'api_error' && `API ${evt.status || 404} Error`}
                              {evt.eventType === 'log' && 'Runtime Log'}
                            </span>
                            {evt.duration !== null && (
                              <span className={`node-duration ${evt.duration > 200 ? 'duration-spike' : ''}`}>
                                ⏱️ {evt.duration}ms {evt.duration > 500 ? '(Slow Call)' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Primary Message */}
                        <div className="node-main-msg">
                          {isClick && (
                            <div>
                              <span className="action-prefix">User clicked:</span>
                              <strong>"{evt.target || evt.message.replace(/^Clicked BUTTON: "/, '').replace(/"$/, '')}"</strong>
                              {evt.path && <span className="path-sub">on screen <code>{evt.path}</code></span>}
                            </div>
                          )}

                          {isRoute && (
                            <div>
                              <span className="action-prefix">Navigated to screen:</span>
                              <strong className="route-dest"><code>{evt.path || evt.message.replace(/^Route transition: /, '')}</code></strong>
                            </div>
                          )}

                          {isApi && (
                            <div>
                              <span className="action-prefix">{isError ? 'Failed API Call:' : 'Successful API Call:'}</span>
                              <strong className="api-endpoint-str">{evt.path || evt.requestUrl?.split('?')[0] || evt.message}</strong>
                            </div>
                          )}

                          {!isClick && !isRoute && !isApi && (
                            <div>
                              <strong>{evt.message}</strong>
                            </div>
                          )}
                        </div>

                        {/* Root Cause Diagnosis Box for 404/500 */}
                        {isError && (
                          <div className="root-cause-banner">
                            <div className="rcb-title">
                              <strong>🔍 Diagnostic Root Cause (Status {evt.status || 404})</strong>
                            </div>
                            <div className="rcb-body">
                              {evt.responseMessage ? (
                                <p className="rcb-msg">
                                  Server message: <em>"{evt.responseMessage}"</em>
                                </p>
                              ) : (
                                <p className="rcb-msg">
                                  Endpoint returned 404 Not Found. Target route or parameters were not recognized by backend.
                                </p>
                              )}
                              {evt.requestUrl?.includes('?') && (
                                <div className="rcb-params">
                                  <span className="param-label">Query parameters passed:</span>
                                  <code>{evt.requestUrl.split('?')[1]}</code>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Deep Inspector Drawer */}
                        <details className="node-inspect-drawer">
                          <summary>Inspect Raw Telemetry Payload & Request Parameters ⌄</summary>
                          <div className="inspect-content">
                            {evt.requestUrl && (
                              <div className="inspect-row">
                                <span className="inspect-key">Full URL:</span>
                                <code className="inspect-val">{evt.requestUrl}</code>
                              </div>
                            )}

                            {evt.responsePayload && (
                              <div className="inspect-row">
                                <span className="inspect-key">Response Data:</span>
                                <pre className="inspect-json">{JSON.stringify(evt.responsePayload, null, 2)}</pre>
                              </div>
                            )}

                            {evt.device && (
                              <div className="inspect-row">
                                <span className="inspect-key">Device Context:</span>
                                <span className="inspect-val">
                                  {evt.device.label} · Screen: {evt.device.screen || 'N/A'} · Online: {evt.device.isOnline ? 'Yes' : 'No'}
                                </span>
                              </div>
                            )}

                            {evt.breadcrumbs?.length > 0 && (
                              <div className="inspect-row">
                                <span className="inspect-key">Breadcrumbs:</span>
                                <ul className="breadcrumbs-list-mini">
                                  {evt.breadcrumbs.map((b, bi) => (
                                    <li key={bi}>
                                      <small>{toISTTimeOnly(b.timestamp)}</small> · [{b.category}] {b.message}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="inspect-actions">
                              <button
                                type="button"
                                className="copy-json-btn"
                                onClick={() => copyText(evt.id, JSON.stringify(evt.raw, null, 2))}
                              >
                                {copiedId === evt.id ? '✓ Copied!' : '📋 Copy Raw JSON'}
                              </button>
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: API ENDPOINTS & FAILURE DIAGNOSIS                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'api' && (
        <section className="api-diagnostic-section">
          <div className="section-intro">
            <h2>API Endpoint Diagnostic & Failure Analysis</h2>
            <p>
              Breakdown of all backend endpoints queried during client telemetry sessions, including failure rates and server responses.
            </p>
          </div>

          <div className="api-cards-grid">
            {telemetryData.apiList.map(api => {
              const hasErrors = api.errors > 0;
              const failRate = ((api.errors / api.calls) * 100).toFixed(0);

              return (
                <div key={api.endpoint} className={`api-card ${hasErrors ? 'api-card-fail' : 'api-card-ok'}`}>
                  <div className="api-card-top">
                    <div className="api-method-badge">GET</div>
                    <code className="api-endpoint-name" title={api.endpoint}>{api.endpoint}</code>
                    <span className={`api-health-pill ${hasErrors ? 'health-bad' : 'health-good'}`}>
                      {hasErrors ? `${failRate}% Failing` : '100% Success'}
                    </span>
                  </div>

                  <div className="api-card-stats">
                    <div className="stat-box">
                      <span className="stat-num">{api.calls}</span>
                      <span className="stat-title">Total Requests</span>
                    </div>
                    <div className="stat-box">
                      <span className={`stat-num ${hasErrors ? 'num-err' : ''}`}>{api.errors}</span>
                      <span className="stat-title">404/500 Errors</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-num">{api.avgDuration} <small>ms</small></span>
                      <span className="stat-title">Avg Latency</span>
                    </div>
                    <div className="stat-box">
                      <span className={`stat-num ${api.maxDuration > 500 ? 'num-warn' : ''}`}>{api.maxDuration} <small>ms</small></span>
                      <span className="stat-title">Peak Latency</span>
                    </div>
                  </div>

                  {/* Plain-English Root Cause Message from Backend */}
                  {hasErrors && (
                    <div className="api-error-explanation">
                      <strong>⚠️ Diagnostic Server Response:</strong>
                      {api.responseMessages.length > 0 ? (
                        <ul className="response-msg-list">
                          {api.responseMessages.map((msg, mi) => (
                            <li key={mi}>"{msg}"</li>
                          ))}
                        </ul>
                      ) : (
                        <p>Endpoint returned HTTP 404 (Not Found).</p>
                      )}
                    </div>
                  )}

                  <div className="api-card-footer">
                    <span className="footer-users">Impacted: {api.userList.join(', ')}</span>
                    <span className="footer-status">
                      Status: {api.statusBreakdown.map(([s, n]) => `${s} (${n})`).join(', ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: UI CLICKS & SCREEN FLOWS                                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'interactions' && (
        <section className="interactions-section">
          <div className="section-intro">
            <h2>User Interface Interactions & Navigation Heatmap</h2>
            <p>Most frequently clicked components, buttons, and route transitions recorded across client sessions.</p>
          </div>

          <div className="two-column-grid">
            <div className="panel-box">
              <h3>🖱️ Top Clicked Components & Buttons</h3>
              {telemetryData.uiList.length === 0 ? (
                <p className="empty-msg">No UI clicks recorded in this dataset.</p>
              ) : (
                <div className="rank-list">
                  {telemetryData.uiList.map((item, idx) => {
                    const maxCount = telemetryData.uiList[0].count;
                    const pct = Math.max(8, (item.count / maxCount) * 100);
                    return (
                      <div key={item.label} className="rank-row">
                        <div className="rank-header">
                          <span className="rank-name">
                            <span className="rank-badge">#{idx + 1}</span> {item.label}
                          </span>
                          <strong className="rank-count">{item.count} clicks</strong>
                        </div>
                        <div className="bar-bg">
                          <div className={`bar-fill fill-${idx % 4}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="panel-box">
              <h3>🧭 Screen Routes & Navigations</h3>
              {telemetryData.routeList.length === 0 ? (
                <p className="empty-msg">No route navigations recorded.</p>
              ) : (
                <div className="rank-list">
                  {telemetryData.routeList.map((item, idx) => {
                    const maxCount = telemetryData.routeList[0].count;
                    const pct = Math.max(8, (item.count / maxCount) * 100);
                    return (
                      <div key={item.path} className="rank-row">
                        <div className="rank-header">
                          <span className="rank-name">
                            <span className="rank-badge">#{idx + 1}</span> <code>{item.path}</code>
                          </span>
                          <strong className="rank-count">{item.count} visits</strong>
                        </div>
                        <div className="bar-bg">
                          <div className={`bar-fill fill-${(idx + 1) % 4}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
