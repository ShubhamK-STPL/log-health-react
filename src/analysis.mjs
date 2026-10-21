export const PLAYBOOKS = {
  'Missing procedure': {owner:'Backend + DBA',urgency:0,cause:'The application may be connected to a database missing an expected migration, or the procedure name/schema differs.',impact:'The logged database operation cannot complete; related background items may be skipped.',steps:['Confirm the database/schema used by the failing application instance.','Compare the procedure name in the exception with the deployed database and migration history.','Check the release package for the expected procedure; agree the corrective migration with the DBA.'],qa:['Repeat the affected API or job with the same test conditions.','Validate generated records or bills for completeness and duplicates.','Review a fresh log covering the retest for the same error.']},
  'Missing database column': {owner:'Backend + DBA',urgency:0,cause:'Application SQL and the deployed schema may be out of sync, or a query alias is incorrect.',impact:'The recorded query fails before returning its expected result.',steps:['Identify the table or alias referenced by the failing query.','Compare the deployed schema and query with the intended release.','Correct the query or apply the reviewed migration in a test environment first.'],qa:['Repeat the affected request with populated and empty data.','Verify response fields and stored values against expected results.','Check fresh logs for the same SQL error.']},
  'Database deadlock': {owner:'Backend + DBA',urgency:1,cause:'Concurrent transactions may acquire conflicting locks in different orders.',impact:'A transaction was aborted; the log alone cannot establish whether a retry later succeeded.',steps:['Capture the database deadlock report near the logged timestamp.','Compare transaction order, query indexes and transaction duration.','Review bounded retries and idempotency before retrying failed work.'],qa:['Run concurrent requests against the affected operation in a test environment.','Check that retries create no duplicate records and preserve balances.','Compare fresh deadlock counts over comparable workloads.']},
  'Timeout': {owner:'Backend + operations',urgency:1,cause:'Slow queries, lock waits, capacity pressure or a downstream service may have exceeded a configured timeout.',impact:'The caller did not receive a result in time; a downstream write may still have completed.',steps:['Identify whether the timeout is in SQL, HTTP or a gateway from the exception.','Correlate request/trace IDs with dependency logs and server metrics.','Investigate slow queries or lock waits before changing timeout settings.'],qa:['Repeat representative requests and record durations against your agreed target.','Verify whether timed-out writes completed before retrying them.','Confirm that repeated requests do not duplicate transactions.']},
  'Null reference': {owner:'Backend developer',urgency:1,cause:'A code path may dereference an absent object or an unexpected null result.',impact:'The recorded execution path failed; the affected business scope needs confirmation.',steps:['Find the first application-owned frame in the stack trace.','Inspect request inputs and database results around that code path.','Reproduce the missing-data condition and handle it explicitly.'],qa:['Test valid, missing, empty and null input or database-result cases.','Assert a useful response and no partial unintended writes.','Repeat the original failing flow after the fix.']},
  'Data parsing': {owner:'Backend + data owner',urgency:1,cause:'A database value or null may not match the application model type.',impact:'The recorded result could not be mapped into the expected application data.',steps:['Identify the column and actual value/type from the error.','Compare database nullability and value formats with the model.','Reproduce using the problematic data and agree validation or mapping changes.'],qa:['Cover null, blank, boundary and unexpected-type values.','Verify the complete response and calculations for valid records.','Check that invalid records are handled without hiding data loss.']},
  'Index out of range': {owner:'Backend developer',urgency:1,cause:'A collection may be empty or smaller than the code expects.',impact:'Processing failed at an invalid collection position.',steps:['Locate the application frame and collection involved.','Reproduce empty and small collections or invalid pagination inputs.','Validate bounds and the assumptions about collection size.'],qa:['Test zero, one and multiple elements plus boundary indexes.','Confirm no record is silently omitted or processed twice.','Re-run the original request with the same data shape.']},
  'Endpoint not found (404)': {owner:'Frontend + API owner',urgency:1,cause:'The requested API route is missing, misspelled, removed, or query parameters failed backend routing.',impact:'Client features relying on this endpoint (e.g. geofence delivery areas, subscriptions) cannot load.',steps:['Verify that the route exists on the deployed API backend and compare casing.','Check query parameters (IDs, flags) against expected backend route signatures.','Verify reverse proxy / API gateway routing rules and URL rewrites.'],qa:['Replay the failing endpoint with valid parameters and verify 200 OK.','Check client fallback handling when resources are absent.','Confirm fresh telemetry has zero 404 occurrences.']},
  'Server error (500)': {owner:'Backend developer',urgency:0,cause:'An unhandled exception occurred on the backend server during request processing.',impact:'The API call failed and the client received an HTTP 500 error.',steps:['Correlate the client event timestamp and user/party ID with backend server logs.','Inspect backend exception stack trace and database transactions.','Reproduce with the client request payload in staging.'],qa:['Retest the endpoint with the offending payload after the fix.','Verify no 500 error is logged during retesting.']},
  'Auth / Permission (401/403)': {owner:'Backend / Auth team',urgency:1,cause:'The user session expired, token is invalid, or the role lacks permission for this resource.',impact:'The client request was rejected by authentication or authorization filters.',steps:['Verify token expiration and refresh flow.','Check role permissions for the affected endpoint.','Inspect headers sent by the client.'],qa:['Test with valid credentials and verify access.','Test with invalid credentials and assert clean re-login prompt.']},
  'Other': {owner:'Application owner',urgency:2,cause:'No specific rule matched. Review the exception and surrounding records before assigning a cause.',impact:'A log event was recorded; its user or business impact needs investigation.',steps:['Inspect the full exception and first application-owned frame.','Use request, trace or job identifiers to locate related entries.','Reproduce the operation and assign the relevant developer or service owner.'],qa:['Define the expected outcome before changing code.','Repeat the original failing scenario.','Review fresh logs and validate business results.']}
};

export function categoryOf(r){
  const act = r.event?.action || '';
  const s = [r.Error, r['@mt'], r['@m'], r.message, r['@x'], act].filter(Boolean).join(' ').toLowerCase();
  if (/procedure .*does not exist/.test(s)) return 'Missing procedure';
  if (s.includes('unknown column')) return 'Missing database column';
  if (s.includes('deadlock')) return 'Database deadlock';
  if (/time.?out|timeout expired/.test(s)) return 'Timeout';
  if (/object reference|nullreference/.test(s)) return 'Null reference';
  if (s.includes('error parsing column')) return 'Data parsing';
  if (/index was out of range|indexoutofrange/.test(s)) return 'Index out of range';
  const status = Number(r.event?.data?.status ?? r.extra?.status);
  if (status === 404 || /\b404\b|not found/i.test(s)) return 'Endpoint not found (404)';
  if (status === 500 || /\b500\b|internal server error/i.test(s)) return 'Server error (500)';
  if (status === 401 || status === 403 || /\b(401|403)\b|unauthorized|forbidden/i.test(s)) return 'Auth / Permission (401/403)';
  if (r.event?.category === 'ui') return 'UI Interaction';
  if (r.event?.category === 'navigation') return 'Navigation';
  if (r.event?.category === 'api' || r.type === 'ACTION' || r.extra?.type?.includes('API')) return 'API Call';
  return 'Other';
}

export function rootMessage(r){
  if (r.Error) return String(r.Error);
  if (r['@x']) return String(r['@x']).split(/\r?\n/)[0].replace(/^[\w.]+(?: \(0x[\da-f]+\))?:\s*/i, '');
  const raw = r['@mt'] || r['@m'] || r.message || r.Message || r.event?.action || '(No message)';
  const str = String(raw);
  const errMatch = str.match(/^(ERR:\s*\d+\s+[A-Z]+\s+)([^?#\s]+)/i);
  if (errMatch) return `${errMatch[1].toUpperCase()}${errMatch[2]}`;
  const reqMatch = str.match(/^((?:API\s+)?REQ:\s+[A-Z]+\s+)([^?#\s]+)/i);
  if (reqMatch) return `${reqMatch[1].toUpperCase()}${reqMatch[2]}`;
  return str.replace(/\s*\(\d+ms\)$/i, '').trim();
}

export function extractPath(r){
  if (r.RequestPath) return String(r.RequestPath);
  if (r.path) return String(r.path);
  const rawUrl = r.event?.data?.url || r.extra?.shortUrl || r.extra?.url || r.event?.data?.path || r.event?.device?.pathname || r.device?.pathname;
  if (rawUrl) {
    try {
      const u = String(rawUrl).startsWith('http') ? new URL(rawUrl).pathname : String(rawUrl).split(/[?#]/)[0];
      if (u) return u;
    } catch {}
  }
  const msg = String(r['@mt'] || r['@m'] || r.message || r.event?.action || '');
  const m = msg.match(/(?:GET|POST|PUT|DELETE|PATCH)\s+([^\s?#]+)/i);
  if (m) return m[1];
  return '';
}

export function extractModule(r){
  if (r.SourceContext) return String(r.SourceContext);
  if (r.event) {
    const target = r.event.target && r.event.target !== 'api' ? r.event.target : (r.event.data?.label || '');
    const cat = r.event.category ? r.event.category.toUpperCase() : 'ACTION';
    return target ? `${cat}: ${target}` : `Telemetry: ${cat}`;
  }
  if (r.extra?.type) return `Telemetry: ${r.extra.type}`;
  if (r.type) return `Telemetry: ${r.type}`;
  return 'Unspecified';
}

export function extractRequestId(r){
  return r.RequestId || r.event?.id || r.id || (r.user?.userId ? `user-${r.user.userId}` : undefined) || (r.event?.user?.userId ? `user-${r.event.user.userId}` : undefined);
}

export function normalize(r, line){
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw Error('Expected a log object');
  const stamp = r['@t'] ?? r.timestamp ?? r.Timestamp ?? r.event?.timestamp;
  const rawMsg = r['@m'] ?? r.message ?? r.Message ?? r['@mt'] ?? r.Error ?? r.event?.action;
  if (stamp === undefined && rawMsg === undefined && r['@l'] === undefined && r.level === undefined && !r.event) {
    throw Error('Unrecognized log record');
  }
  let level = String(r['@l'] ?? r.level ?? r.Level ?? '');
  if (!level) {
    if (r.event) {
      const status = Number(r.event.data?.status);
      const act = String(r.event.action || '');
      if (status >= 400 || /^ERR:\s*\d+/i.test(act)) level = 'Error';
      else if (/^WARN:/i.test(act)) level = 'Warning';
      else level = 'Information';
    } else {
      level = 'Information';
    }
  } else if (r.extra) {
    const status = Number(r.extra.status);
    if (status >= 400 || r.extra.type === 'API_ERROR') level = 'Error';
  }
  const reqId = extractRequestId(r);
  if (reqId && !r.RequestId) {
    r.RequestId = reqId;
  }
  const cat = categoryOf(r);
  const root = rootMessage(r);
  const path = extractPath(r);
  const module = extractModule(r);
  return {
    raw: r,
    line,
    time: Number.isFinite(Date.parse(stamp)) ? Date.parse(stamp) : null,
    level,
    message: String(rawMsg ?? '(No message)'),
    pattern: root,
    issueKey: JSON.stringify([cat, root]),
    path,
    module,
    category: cat,
    search: JSON.stringify(r).toLowerCase()
  };
}

export function parseLog(text){
  const entries = [], bad = [];
  text = text.replace(/^\uFEFF/, '');
  const add = (r, i) => {
    try {
      entries.push(normalize(r, i));
    } catch {
      bad.push(i);
    }
  };
  if (text.trim().startsWith('[')) {
    const data = JSON.parse(text);
    data.forEach((r, i) => add(r, i + 1));
  } else {
    text.split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      try {
        add(JSON.parse(line), i + 1);
      } catch {
        bad.push(i + 1);
      }
    });
  }
  return {entries, bad};
}

export const isError = r => /^(error|fatal|critical)$/i.test(r.level);
export const day = t => new Date(t).toISOString().slice(0, 10);

export function group(a, key){
  const m = new Map();
  for (const r of a) {
    const k = key(r);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1]);
}

export function extent(a){
  let first = null, last = null;
  for (const r of a) {
    if (r.time !== null) {
      first = first === null ? r.time : Math.min(first, r.time);
      last = last === null ? r.time : Math.max(last, r.time);
    }
  }
  return {first, last};
}

export function filterEntries(entries, f = {}){
  const q = (f.query || '').toLowerCase();
  return entries.filter(r =>
    (!q || r.search.includes(q)) &&
    (!f.category || r.category === f.category) &&
    (!f.level || r.level.toLowerCase() === f.level.toLowerCase()) &&
    (!f.from || (r.time !== null && day(r.time) >= f.from)) &&
    (!f.to || (r.time !== null && day(r.time) <= f.to))
  );
}

export function analyze(entries){
  const errors = entries.filter(isError);
  const buckets = new Map();
  for (const r of errors) {
    if (!buckets.has(r.issueKey)) buckets.set(r.issueKey, []);
    buckets.get(r.issueKey).push(r);
  }
  const issues = [...buckets].map(([key, rows]) => {
    const category = rows[0].category;
    const playbook = PLAYBOOKS[category] || PLAYBOOKS['Other'];
    const rank = playbook.urgency === 0 ? 0 : rows.length >= 10 ? 1 : 2;
    return {
      key,
      category,
      title: rows[0].pattern,
      count: rows.length,
      share: errors.length ? 100 * rows.length / errors.length : 0,
      rank,
      priority: ['Investigate first', 'Review next', 'Review'][rank],
      reason: rank === 0 ? 'Explicit database schema/dependency or server error' : rank === 1 ? 'Recurring issue: at least 10 error entries' : 'Limited evidence; confirm business impact',
      ...extent(rows),
      paths: group(rows.filter(r => r.path), r => r.path),
      modules: group(rows, r => r.module),
      requestIds: new Set(rows.map(r => r.raw.RequestId).filter(Boolean)).size,
      jobIds: new Set(rows.map(r => r.raw.JobId).filter(Boolean)).size,
      rows,
      playbook
    };
  }).sort((a, b) => a.rank - b.rank || b.count - a.count || a.title.localeCompare(b.title));

  const range = extent(entries);
  const days = group(errors.filter(r => r.time !== null), r => day(r.time)).sort((a, b) => a[0].localeCompare(b[0]));
  return {
    entries: entries.length,
    errors: errors.length,
    issues,
    paths: group(errors.filter(r => r.path), r => r.path),
    modules: group(errors, r => r.module),
    categories: group(errors.length ? errors : entries, r => r.category),
    days,
    ...range,
    missingTime: entries.filter(r => r.time === null).length,
    withoutPath: errors.filter(r => !r.path).length,
    traceCoverage: errors.length ? 100 * errors.filter(r => r.raw['@tr'] || r.raw.RequestId).length / errors.length : 0
  };
}

export function issueReport(issue, status = 'New'){
  const toIST = t => {
    if (t === null) return 'Unknown';
    const d = new Date(t);
    if (isNaN(d.getTime())) return 'Unknown';
    const ist = new Date(d.getTime() + 5.5 * 3600000);
    const pad = n => String(n).padStart(2, '0');
    const y = ist.getUTCFullYear(), m = pad(ist.getUTCMonth() + 1), day = pad(ist.getUTCDate());
    let hours = ist.getUTCHours();
    const mins = pad(ist.getUTCMinutes()), secs = pad(ist.getUTCSeconds()), ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${y}-${m}-${day} ${pad(hours)}:${mins}:${secs} ${ampm} IST`;
  };
  return `# ${issue.category}: ${issue.title}\n\nSuggested triage: ${issue.priority}\nReason: ${issue.reason}\nSuggested owner: ${issue.playbook.owner}\nManual workflow state: ${status}\n\n## Evidence\n- ${issue.count} error entries (${issue.share.toFixed(1)}% of error entries in the selected scope)\n- First: ${toIST(issue.first)}\n- Last: ${toIST(issue.last)}\n- ${issue.requestIds} distinct logged request IDs; ${issue.jobIds} distinct logged job IDs\n- Endpoints: ${issue.paths.map(([p, n]) => `${p} (${n})`).join(', ') || 'No request path recorded'}\n- Source modules: ${issue.modules.map(([p, n]) => `${p} (${n})`).join(', ')}\n\n## Possible cause (not confirmed)\n${issue.playbook.cause}\n\n## Potential impact\n${issue.playbook.impact}\n\n## Investigation\n${issue.playbook.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n## QA verification\n${issue.playbook.qa.map(x => `- [ ] ${x}`).join('\n')}\n\n## Sample log evidence\n\`\`\`json\n${JSON.stringify(issue.rows[0].raw, null, 2)}\n\`\`\`\n\nCounts represent logged events, not unique failed operations or affected users. Priorities are rules for triage, not confirmed incident severity. Verification is manual. Snapshot data cannot establish current uptime, error rate, or resolution.\nAll evidence timestamps are shown in Indian Standard Time (IST, 12-hour AM/PM format).\n`;
}

export function analyzeTelemetry(entries) {
  const usersMap = new Map();
  const devicesMap = new Map();
  const apiMap = new Map();
  const uiMap = new Map();
  const routesMap = new Map();
  const events = [];

  let totalLatency = 0;
  let latencyCalls = 0;
  let maxLatency = 0;
  let apiCallCount = 0;
  let apiErrorCount = 0;

  for (const r of entries) {
    const raw = r.raw || {};
    const evt = raw.event || {};
    const user = evt.user || raw.user || {};
    const device = evt.device || raw.device || {};
    const data = evt.data || raw.extra || {};

    const userName = user.customerName || (user.userId ? `User #${user.userId}` : 'Guest Explorer');
    const userKey = user.userId || userName;
    if (!usersMap.has(userKey)) {
      usersMap.set(userKey, {
        id: user.userId ?? 0,
        name: userName,
        mobile: user.mobileNo || '',
        partyId: user.partyId ?? 0,
        actions: 0,
        errors: 0,
        devices: new Set(),
        paths: new Set(),
        events: []
      });
    }
    const uObj = usersMap.get(userKey);
    uObj.actions++;
    if (isError(r)) uObj.errors++;
    if (device.deviceLabel) uObj.devices.add(device.deviceLabel);

    const responseMsg = data.response?.statusMessage || data.response?.message || null;
    const responsePayload = data.response || null;
    const requestUrl = data.url || (evt.action?.match(/(?:GET|POST|PUT|DELETE)\s+([^\s(]+)/i)?.[1]) || '';

    if (device.deviceLabel) {
      const devKey = device.deviceLabel;
      if (!devicesMap.has(devKey)) {
        devicesMap.set(devKey, {
          label: devKey,
          platform: device.devicePlatform || 'Unknown',
          count: 0
        });
      }
      devicesMap.get(devKey).count++;
    }

    let eventType = 'log';
    const status = Number(data.status || (evt.action?.match(/ERR:\s*(\d+)/i)?.[1]));
    const duration = Number(data.durationMs || (evt.action?.match(/\((\d+)ms\)/i)?.[1])) || null;

    if (evt.category === 'ui' || (raw.type === 'ACTION' && evt.data?.tag)) {
      eventType = 'click';
      const label = evt.data?.label || evt.action?.replace(/^Clicked\s+[^:]+:\s*"?([^"]*)"?$/i, '$1') || 'Button click';
      uiMap.set(label, (uiMap.get(label) || 0) + 1);
    } else if (evt.category === 'navigation' || evt.action?.startsWith('Route transition')) {
      eventType = 'route';
      const p = evt.data?.path || r.path || '/';
      routesMap.set(p, (routesMap.get(p) || 0) + 1);
    } else if (evt.category === 'api' || (raw.type === 'LOG' && raw.extra?.type?.includes('API')) || evt.action?.includes('REQ:') || evt.action?.includes('ERR:')) {
      apiCallCount++;
      if (status >= 400 || isError(r)) {
        eventType = 'api_error';
        apiErrorCount++;
      } else {
        eventType = 'api_ok';
      }

      if (duration !== null && !isNaN(duration)) {
        totalLatency += duration;
        latencyCalls++;
        if (duration > maxLatency) maxLatency = duration;
      }

      const endpoint = r.path || (requestUrl ? requestUrl.split(/[?#]/)[0] : 'Unknown API');
      if (!apiMap.has(endpoint)) {
        apiMap.set(endpoint, {
          endpoint,
          calls: 0,
          errors: 0,
          totalDuration: 0,
          durationCount: 0,
          maxDuration: 0,
          minDuration: Infinity,
          statuses: new Map(),
          responseMessages: new Set(),
          sampleResponse: null,
          users: new Set()
        });
      }
      const apiItem = apiMap.get(endpoint);
      apiItem.calls++;
      if (status >= 400 || isError(r)) apiItem.errors++;
      if (duration !== null && !isNaN(duration)) {
        apiItem.totalDuration += duration;
        apiItem.durationCount++;
        if (duration > apiItem.maxDuration) apiItem.maxDuration = duration;
        if (duration < apiItem.minDuration) apiItem.minDuration = duration;
      }
      if (status) {
        apiItem.statuses.set(status, (apiItem.statuses.get(status) || 0) + 1);
      }
      if (responseMsg) apiItem.responseMessages.add(responseMsg);
      if (responsePayload && !apiItem.sampleResponse) apiItem.sampleResponse = responsePayload;
      if (userName) apiItem.users.add(userName);
    } else if (isError(r)) {
      eventType = 'error';
    }

    const eventObj = {
      id: r.raw?.RequestId || evt.id || raw.id || `evt-${events.length}`,
      line: r.line,
      time: r.time,
      category: r.category,
      level: r.level,
      eventType,
      message: r.message,
      pattern: r.pattern,
      path: r.path,
      target: evt.target || evt.data?.label || '',
      status: status || null,
      duration: duration || null,
      requestUrl,
      responseMessage: responseMsg,
      responsePayload,
      user: {
        id: user.userId,
        name: userName,
        mobile: user.mobileNo,
        partyId: user.partyId,
        unitId: user.unitId,
        organizationId: user.organizationId,
        isAuthenticated: user.isAuthenticated ?? false
      },
      device: {
        label: device.deviceLabel || device.devicePlatform || 'Unknown',
        platform: device.devicePlatform,
        screen: device.screen,
        url: device.url,
        pathname: device.pathname,
        isOnline: device.isOnline ?? true
      },
      breadcrumbs: raw.breadcrumbs || [],
      raw
    };

    events.push(eventObj);

    if (usersMap.has(userKey)) {
      usersMap.get(userKey).events.push(eventObj);
      if (r.path) usersMap.get(userKey).paths.add(r.path);
    }
  }

  const apiList = [...apiMap.values()].map(item => ({
    ...item,
    avgDuration: item.durationCount ? Math.round(item.totalDuration / item.durationCount) : 0,
    minDuration: item.minDuration === Infinity ? 0 : item.minDuration,
    statusBreakdown: [...item.statuses.entries()].sort((a, b) => b[1] - a[1]),
    responseMessages: [...item.responseMessages],
    userList: [...item.users]
  })).sort((a, b) => b.calls - a.calls);

  const userList = [...usersMap.values()].map(u => {
    const times = u.events.map(e => e.time).filter(t => t !== null);
    const firstTime = times.length ? Math.min(...times) : null;
    const lastTime = times.length ? Math.max(...times) : null;
    return {
      ...u,
      firstTime,
      lastTime,
      durationMs: firstTime && lastTime ? Math.max(0, lastTime - firstTime) : 0,
      deviceCount: u.devices.size,
      deviceNames: [...u.devices].join(', '),
      pathsVisited: [...u.paths]
    };
  }).sort((a, b) => b.errors - a.errors || b.actions - a.actions);

  const deviceList = [...devicesMap.values()].sort((a, b) => b.count - a.count);
  const uiList = [...uiMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const routeList = [...routesMap.entries()].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count);

  return {
    totalEvents: entries.length,
    users: userList,
    devices: deviceList,
    apiCalls: apiCallCount,
    apiErrors: apiErrorCount,
    apiSuccessRate: apiCallCount ? ((apiCallCount - apiErrorCount) / apiCallCount) * 100 : 100,
    avgLatency: latencyCalls ? Math.round(totalLatency / latencyCalls) : 0,
    maxLatency,
    apiList,
    uiList,
    routeList,
    events
  };
}


