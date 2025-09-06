async function fetchJSON(url, { tries = 3, baseDelayMs = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });

      if (r.status === 429) {
        const text = await r.text().catch(() => '');
        throw Object.assign(new Error('RATE_LIMIT'), { code: 429, body: text });
      }
      if (r.status === 503) {
        const text = await r.text().catch(() => '');
        throw Object.assign(new Error('SERVICE_UNAVAILABLE'), { code: 503, body: text });
      }
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw Object.assign(new Error(`HTTP ${r.status}`), { code: r.status, body: text });
      }

      const txt = await r.text();
      try { return JSON.parse(txt); }
      catch { throw Object.assign(new Error('BAD_JSON'), { code: 'BAD_JSON', body: txt }); }
    } catch (e) {
      lastErr = e;
      if (attempt === tries - 1) break;
      const delay = Math.round(baseDelayMs * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4));
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastErr;
}

export async function getStations() {

  return fetchJSON('/stations');
}

export async function getHistorical(stationId) {
  const url = '/historical_weather?station=' + encodeURIComponent(stationId);
  return fetchJSON(url);
}
