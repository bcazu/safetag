import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'

// Centro por defecto: Pereira
const DEFAULT_CENTER: [number, number] = [4.8133, -75.6961]

interface MapCase {
  id: string
  address: string | null
  commune: string | null
  neighborhood: string | null
  status: 'pending' | 'in_review' | 'assessed'
  priority: number
  result: 'green' | 'yellow' | 'orange' | 'red' | 'site_visit' | null
  lat: number
  lng: number
}

// Mismos tonos del semáforo de App.css
const RESULT_COLORS: Record<string, string> = {
  green: '#166534',
  yellow: '#fde047',
  orange: '#f97316',
  red: '#b91c1c',
  site_visit: '#7c3aed',
}
const PENDING_COLOR = '#6b7280'

function markerColor(c: MapCase): string {
  return (c.result && RESULT_COLORS[c.result]) || PENDING_COLOR
}

export default function MapPage() {
  const { t } = useTranslation()
  // null = cargando; el mapa solo se monta con datos porque MapContainer
  // fija centro/bounds únicamente en el montaje
  const [cases, setCases] = useState<MapCase[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('map_cases')
      .select('*')
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setCases((data as MapCase[]) ?? [])
      })
  }, [])

  const bounds = useMemo(
    () =>
      cases && cases.length > 0
        ? latLngBounds(cases.map((c) => [c.lat, c.lng] as [number, number])).pad(0.2)
        : null,
    [cases],
  )

  if (error) return <main className="page error">{error}</main>
  if (!cases) return <main className="page">{t('common.loading')}</main>

  const legend: Array<[string, string]> = [
    ...Object.entries(RESULT_COLORS).map(
      ([key, color]): [string, string] => [t(`assessment.result.${key}`), color],
    ),
    [t('app:map.unassessed'), PENDING_COLOR],
  ]

  return (
    <main className="map-main">
      <MapContainer
        className="map"
        {...(bounds ? { bounds } : { center: DEFAULT_CENTER, zoom: 13 })}
        scrollWheelZoom
      >
        <TileLayer
          // Tiles de desarrollo; producción: OpenFreeMap (docs/setup.md §3)
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {cases.map((c) => (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lng]}
            radius={9}
            pathOptions={{
              color: '#1f2937',
              weight: 1,
              fillColor: markerColor(c),
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <strong>{c.address ?? c.id}</strong>
              {c.neighborhood && <div>{c.neighborhood}</div>}
              <div>
                {c.result
                  ? t(`assessment.result.${c.result}`)
                  : `${t(`case.status.${c.status}`)} · ${c.priority} ${t('app:queue.priorityShort')}`}
              </div>
              <Link to={`/caso/${c.id}`}>{t('app:queue.open')}</Link>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <aside className="map-legend">
        {legend.map(([label, color]) => (
          <span key={label}>
            <i style={{ background: color }} /> {label}
          </span>
        ))}
      </aside>
    </main>
  )
}
