import { useEffect, useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import 'chart.js/auto' // auto-registers all needed Chart.js bits
import { isNumeric, discoverNumericKeysWithCounts, filterByRange } from '../lib/series.js'

// Re-export so App.jsx can continue importing normalizeHistorical from ChartPanel
export { normalizeHistorical } from '../lib/series.js'

const CHART_HEIGHT = 320

function toLocalDateStr(d) {
  const tz = d.getTimezoneOffset()
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10)
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
  const [range, setRange]       = useState('all')   // '24h' | '3d' | '7d' | 'all'
  const [day, setDay]           = useState('')      // YYYY-MM-DD
  const [dayDraft, setDayDraft] = useState('')      // input model

  // Discover numeric keys (via shared util)
  const discovery = useMemo(() => {
    if (!series || !series.length) return { keys: [], counts: new Map() }
    return discoverNumericKeysWithCounts(series)
  }, [series])

  // bounds & helpers for date selection
  const minDay = useMemo(() => (series?.[0]?.__t ? toLocalDateStr(series[0].__t) : ''), [series])
  const maxDay = useMemo(() => (series?.[series.length-1]?.__t ? toLocalDateStr(series[series.length-1].__t) : ''), [series])
  const todayStr = useMemo(() => toLocalDateStr(new Date()), [])
  const hasTodayData = useMemo(
    () => Array.isArray(series) && series.some(r => toLocalDateStr(r.__t) === todayStr),
    [series, todayStr]
  )

  // default metric
  useEffect(() => {
    const { keys } = discovery
    if (!keys || !keys.length) { setMetric(null); return }
    const preferred = ['temperature','temp','air_temp','dewpoint','wind_speed','wind_x','wind_y','pressure','precip','seaLevelPressure']
    const bestPreferred = preferred.find(k => keys.includes(k))
    setMetric(bestPreferred || keys[0])
  }, [JSON.stringify(discovery.keys)])

  useEffect(() => { setDayDraft(day) }, [day])

  if (series === null) return <div className="msg">Pick a station to see historical data.</div>
  if (!series.length)   return <div className="msg">⚠️ No historical data for this station (or API returned empty).</div>
  if (!discovery.keys.length) return <div className="msg">⚠️ No numeric metrics detected in this payload.</div>

  // Apply range or exact day filter
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
            {discovery.keys.map(k => <option key={k} value={k}>{k}</option>)}
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

      <div style={{ height: CHART_HEIGHT }}>
        <Line
          data={data}
          options={{
            responsive: true,
            animation: false,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: false },
            scales: {
              x: { ticks: { maxRotation: 0, autoSkip: true, color: '#9bb0d3' }, grid: { color: 'rgba(155,176,211,0.15)' } },
              y: { ticks: { color: '#9bb0d3' }, grid: { color: 'rgba(155,176,211,0.15)' } }
            },
            plugins: { legend: { labels: { color: '#e8eefc' } } }
          }}
        />
      </div>
    </div>
  )
}
