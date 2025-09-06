    // src/lib/series.js
export const isNumeric = (v) =>
  (typeof v === 'number' && Number.isFinite(v)) ||
  (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))

function detectTimeKey(row) {
  const c = ['timestamp','time','datetime','date','valid_time','obsTimeUtc','valid','ob_time']
  return c.find(k => k in row) || null
}
function toLabel(d) { return d.toISOString().replace('T',' ').slice(0,16) + 'Z' }

/** Robust normalizer: array | {points:[...]} | {data:[...]} | {results:[...]} */
export function normalizeHistorical(raw) {
  let rows = Array.isArray(raw) ? raw : (raw?.points || raw?.data || raw?.results || [])
  if (!Array.isArray(rows) || rows.length === 0) return []

  const tKey = detectTimeKey(rows[0])
  if (!tKey) return []

  const cleaned = rows.map(r => {
    const v = r[tKey]
    let d
    if (typeof v === 'number') {
      const ms = v > 1e12 ? v : (v > 1e10 ? v : v * 1000)
      d = new Date(ms)
    } else {
      d = new Date(v)
    }
    if (isNaN(d)) return null

    let wind_speed
    if (r.wind_x != null || r.wind_y != null) {
      const wx = isNumeric(r.wind_x) ? Number(r.wind_x) : 0
      const wy = isNumeric(r.wind_y) ? Number(r.wind_y) : 0
      const sp = Math.sqrt(wx*wx + wy*wy)
      if (Number.isFinite(sp)) wind_speed = sp
    }

    return { ...r, ...(wind_speed !== undefined ? { wind_speed } : {}), __t: d, __label: toLabel(d) }
  }).filter(Boolean)

  cleaned.sort((a,b) => a.__t - b.__t)
  return cleaned
}

/** Scan up to maxRows rows to find numeric-ish keys and coverage counts. */
export function discoverNumericKeysWithCounts(series, maxRows = 10000) {
  const counts = new Map()
  const n = Math.min(series.length, maxRows)
  for (let i = 0; i < n; i++) {
    const r = series[i]
    for (const k of Object.keys(r)) {
      if (k.startsWith('__')) continue
      if (isNumeric(r[k])) counts.set(k, (counts.get(k) || 0) + 1)
    }
  }
  const keys = Array.from(counts.keys()).sort((a,b) => (counts.get(b) - counts.get(a)))
  return { keys, counts }
}

export function filterByRange(series, rangeKey) {
  if (!Array.isArray(series) || series.length === 0) return series
  if (rangeKey === 'all') return series
  const end = series[series.length - 1].__t.getTime()
  let start
  switch (rangeKey) {
    case '24h': start = end - 24*3600*1000; break
    case '3d' : start = end - 3*24*3600*1000; break
    case '7d' : start = end - 7*24*3600*1000; break
    default   : return series
  }
  return series.filter(r => r.__t.getTime() >= start)
}
