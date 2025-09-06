import { useEffect, useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { isNumeric, discoverNumericKeysWithCounts, filterByRange } from '../lib/series.js'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)



const isNumeric = (v) =>
  (typeof v === 'number' && Number.isFinite(v)) ||
  (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))

function detectTimeKey(row) {
  const c = ['timestamp','time','datetime','date','valid_time','obsTimeUtc','valid','ob_time']
  return c.find(k => k in row) || null
}
function toLabel(d) { return d.toISOString().replace('T',' ').slice(0,16) + 'Z' }
function toLocalDateStr(d) {
  const tz = d.getTimezoneOffset()
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10)
}

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

    // derive wind_speed from wind_x/y when available
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

function discoverNumericKeys(series, maxRows = 10000) {
  const counts = new Map()
  const n = Math.min(series.length, maxRows)
  for (let i = 0; i < n; i++) {
    const r = series[i]
    for (const k of Object.keys(r)) {
      if (k.startsWith('__')) continue
      if (isNumeric(r[k])) counts.set(k, (counts.get(k) || 0) + 1)
    }
  }
  return Array.from(counts.keys()).sort((a,b) => (counts.get(b) - counts.get(a)))
}

function filterByRange(series, rangeKey) {
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

function filterByDay(series, dayStr) {
  if (!dayStr) return series
  // local day window [00:00 .. 23:59:59.999]
  const start = new Date(dayStr + 'T00:00:00')
  const end   = new Date(dayStr + 'T23:59:59.999')
  const s = start.getTime(), e = end.getTime()
  return series.filter(r => {
    const t = r.__t.getTime()
    return t >= s && t <= e
  })
}

export default function ChartPanel({ series }) {
  const [metric, setMetric]     = useState(null)
  const [range, setRange]       = useState('all')   
  const [day, setDay]           = useState('')      
  const [dayDraft, setDayDraft] = useState('')      

  // discover metrics
  const keys = useMemo(() => {
    if (!series || !series.length) return []
    return discoverNumericKeys(series)
  }, [series])

  // bounds & helpers for date selection
  const minDay = useMemo(() => (series?.[0]?.__t ? toLocalDateStr(series[0].__t) : ''), [series])
  const maxDay = useMemo(() => (series?.[series.length-1]?.__t ? toLocalDateStr(series[series.length-1].__t) : ''), [series])
  const todayStr = useMemo(() => toLocalDateStr(new Date()), [])
  const hasTodayData = useMemo(
    () => Array.isArray(series) && series.some(r => toLocalDateStr(r.__t) === todayStr),
    [series, todayStr]
  )

  useEffect(() => {
    if (!keys.length) { setMetric(null); return }
    const preferred = ['temperature','temp','air_temp','dewpoint','wind_speed','wind_x','wind_y','pressure','precip','seaLevelPressure']
    setMetric(preferred.find(k => keys.includes(k)) || keys[0])
  }, [JSON.stringify(keys)])

  useEffect(() => { setDayDraft(day) }, [day])

  if (series === null) return <div className="msg">Pick a station to see historical data.</div>
  if (!series.length)   return <div className="msg">⚠️ No historical data for this station (or API returned empty).</div>
  if (!keys.length)     return <div className="msg">⚠️ No numeric metrics detected in this payload.</div>

  const filtered = day ? filterByDay(series, day) : filterByRange(series, range)

  const labels = filtered.map(r => r.__label)
  const ys = metric ? filtered.map(r => (isNumeric(r[metric]) ? Number(r[metric]) : null)) : null
  const hasData = ys && ys.some(v => v != null)

  if (!hasData) {
    const jumpTo = hasTodayData ? todayStr : maxDay
    const jumpLabel = hasTodayData ? `Go to today (${todayStr})` : (maxDay ? `Go to latest (${maxDay})` : null)

    return (
      <div className="msg" style={{ textAlign:'left' }}>
        <div>⚠️ No values for that metric/date. Try another metric or clear the date.</div>
        {jumpLabel && (
          <div style={{ marginTop:10 }}>
            <button
              className="btn"
              onClick={() => { setDay(jumpTo); setDayDraft(jumpTo); }}
            >
              {jumpLabel}
            </button>
          </div>
        )}
      </div>
    )
  }

  const data = {
    labels,
    datasets: [{
      label: metric,
      data: ys,
      tension: .25,
      pointRadius: 0,
      borderWidth: 2,
      borderColor: 'rgba(122,162,255,1)',
      backgroundColor: 'rgba(122,162,255,0.2)'
    }]
  }

  const canApply = dayDraft && dayDraft.length === 10

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <label style={{ color:'var(--muted)', fontSize:12 }}>Metric:</label>
          <select className="select" value={metric || ''} onChange={e => setMetric(e.target.value)}>
            {keys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:6, alignItems:'center', opacity: day ? 0.5 : 1 }}>
            <label style={{ color:'var(--muted)', fontSize:12 }}>Range:</label>
            {['24h','3d','7d','all'].map(r =>
              <button
                key={r}
                className="btn"
                disabled={!!day}
                style={{ padding:'6px 10px', background: !day && range===r ? '#12213a' : undefined }}
                onClick={() => setRange(r)}
              >{r}</button>
            )}
          </div>

          {/* Calendar picker with Apply / Clear */}
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <label style={{ color:'var(--muted)', fontSize:12 }}>Day:</label>
            <input
              className="input"
              type="date"
              value={dayDraft}
              min={minDay || undefined}
              max={maxDay || undefined}
              onChange={(e) => setDayDraft(e.target.value)}
            />
            <button className="btn" disabled={!canApply} onClick={() => setDay(dayDraft)}>Apply</button>
            {day && <button className="btn" onClick={() => { setDay(''); setDayDraft('') }}>Clear</button>}
          </div>
        </div>
      </div>

      <div style={{ height: 320 }}>
        <Line
          data={data}
          options={{
            responsive: true,
            animation: false,
            maintainAspectRatio: false,
            scales: {
              x: { ticks: { maxRotation: 0, autoSkip: true, color: '#9bb0d3' }, grid: { color: 'rgba(155,176,211,0.15)' } },
              y: { ticks: { color: '#9bb0d3' }, grid: { color: 'rgba(155,176,211,0.15)' } }
            },
            plugins: { legend: { labels: { color: '#e8eefc' } }, tooltip: { mode: 'nearest', intersect: false } }
          }}
        />
      </div>
    </div>
  )
}
