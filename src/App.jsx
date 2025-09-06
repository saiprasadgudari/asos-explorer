import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView.jsx'
import ChartPanel, { normalizeHistorical } from './components/ChartPanel.jsx'
import { getStations, getHistorical } from './api.js'

export default function App() {
  const [stations, setStations] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [series, setSeries] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null)
      try {
        const raw = await getStations()
        const rows = Array.isArray(raw) ? raw : (raw.stations || raw.results || raw.data || [])
        const pick = (o, ks) => { for (const k of ks) if (o?.[k] != null) return o[k]; return null }

        const list = rows.map(r => {
          const station_id = pick(r, ['station_id'])
          const name       = pick(r, ['station_name','name','desc']) || station_id || 'Unknown'
          const lat        = Number(pick(r, ['latitude','lat','LAT','y']))
          const lon        = Number(pick(r, ['longitude','lon','lng','LON','x']))
          const icao       = pick(r, ['icao'])
          return { station_id, name, lat, lon, icao, raw: r }
        }).filter(s => s.station_id && Number.isFinite(s.lat) && Number.isFinite(s.lon))

        setStations(list)
      } catch (e) {
        console.error(e)
        setErr('Failed to load /stations. Ensure Vite proxy (dev) or vercel.json rewrites (prod) are set.')
      } finally { setLoading(false) }
    })()
  }, [])

  const filtered = useMemo(() => {
    const n = query.trim().toLowerCase()
    if (!n) return stations
    return stations.filter(s =>
      (`${s.name} ${s.station_id} ${s.icao || ''}`).toLowerCase().includes(n)
    )
  }, [stations, query])

  async function onSelectStation(s) {
    setSelected(s); setSeries(null); setErr(null); setLoading(true)
    try {
      const raw = await getHistorical(s.station_id)   
      const cleaned = normalizeHistorical(raw)
      setSeries(cleaned)
    } catch (e) {
      console.error(e)
      setSeries([])
      setErr('Failed to load /historical_weather?station=<station_id>. You may have hit 20/min or the station has no history.')
    } finally { setLoading(false) }
  }

  return (
    <>
      <header>
        <strong>ASOS Explorer (React)</strong>
        <span className="pill">Using station_id → /historical_weather?station=station_id</span>
        <span className="pill">Rate limit: 20/min</span>
      </header>

      <div className="wrap">
        <main>
          <MapView stations={stations} onSelect={onSelectStation} />

          <div className="card" style={{ marginTop: 10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, gap:8, flexWrap:'wrap' }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <strong>{selected?.name || '—'}</strong>
                <span style={{ color:'var(--muted)' }}>{selected?.station_id || ''}</span>
              </div>
            </div>

            <ChartPanel series={series} />
            {err && <div className="msg" style={{ marginTop:8 }}>{err}</div>}
          </div>
        </main>

        <aside className="card">
          <div style={{ display:'flex', gap:8 }}>
            <input className="input" placeholder="Search station name / station_id / ICAO"
                   style={{ flex:1 }} value={query} onChange={e=>setQuery(e.target.value)} />
            <button className="btn" onClick={() => window.location.reload()}>Reload</button>
          </div>
          <div style={{ color:'var(--muted)', fontSize:12, marginTop:6 }}>
            Click a station marker or pick from the list.
          </div>
          <div className="list" style={{ marginTop:8 }}>
            {filtered.slice(0, 1000).map((s, i) =>
              <div key={i} className="station" onClick={()=>onSelectStation(s)}>
                {s.name} ({s.station_id})
              </div>
            )}
          </div>
        </aside>
      </div>

      <div id="overlay" style={{ display: loading ? 'grid' : 'none' }}>
        <div className="msg" style={{ fontSize:14, background:'#0f172a' }}>Loading…</div>
      </div>
    </>
  )
}
