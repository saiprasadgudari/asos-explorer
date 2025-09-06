import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMemo } from 'react'

import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl, iconRetinaUrl, shadowUrl,
  iconSize: [25,41], iconAnchor: [12,41]
})
L.Marker.prototype.options.icon = DefaultIcon

export default function MapView({ stations, onSelect }) {
  const subset = useMemo(() => stations.slice(0, 1500), [stations]) 

  return (
    <MapContainer
      className="map"           
      center={[39.5, -98.35]}
      zoom={4}
      worldCopyJump
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {subset.map((s, i) => (
        <Marker key={i} position={[s.lat, s.lon]}
          eventHandlers={{ click: () => onSelect(s) }}>
          <Popup><b>{s.name}</b><br/>{s.station_id || s.icao || ''}</Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
