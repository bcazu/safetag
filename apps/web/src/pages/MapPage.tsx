import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { latLngBounds, type LatLngBounds } from 'leaflet'
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

// los slugs de comuna vienen del formulario Kobo ('villa_santana')
function communeLabel(slug: string): string {
  const s = slug.replaceAll('_', ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// MapContainer solo aplica bounds al montar; esto re-encuadra al filtrar
function FitBounds({ bounds }: { bounds: LatLngBounds | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds)
  }, [map, bounds])
  return null
}

export default function MapPage() {
  const { t } = useTranslation()
  // null = cargando; el mapa solo se monta con datos porque MapContainer
  // fija centro/bounds únicamente en el montaje
  const [cases, setCases] = useState<MapCase[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [communeFilter, setCommuneFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')

  useEffect(() => {
    supabase
      .from('map_cases')
      .select('*')
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setCases((data as MapCase[]) ?? [])
      })
  }, [])

  // comunas presentes en los datos = territorios donde hay revisiones
  const communes = useMemo(
    () =>
      [...new Set((cases ?? []).map((c) => c.commune).filter(Boolean))].sort() as string[],
    [cases],
  )

  const visible = useMemo(
    () =>
      (cases ?? []).filter(
        (c) =>
          (!communeFilter || c.commune === communeFilter) &&
          (!resultFilter ||
            (resultFilter === 'unassessed' ? !c.result : c.result === resultFilter)),
      ),
    [cases, communeFilter, resultFilter],
  )

  const bounds = useMemo(
    () =>
      visible.length > 0
        ? latLngBounds(visible.map((c) => [c.lat, c.lng] as [number, number])).pad(0.2)
        : null,
    [visible],
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
      <div className="map-filters">
        <select
          value={communeFilter}
          onChange={(e) => setCommuneFilter(e.target.value)}
        >
          <option value="">{t('app:map.allCommunes')}</option>
          {communes.map((c) => (
            <option key={c} value={c}>
              {communeLabel(c)}
            </option>
          ))}
        </select>
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
        >
          <option value="">{t('app:map.allResults')}</option>
          {Object.keys(RESULT_COLORS).map((r) => (
            <option key={r} value={r}>
              {t(`assessment.result.${r}`)}
            </option>
          ))}
          <option value="unassessed">{t('app:map.unassessed')}</option>
        </select>
        <span className="hint">
          {t('app:map.count', { count: visible.length })}
        </span>
      </div>
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
        <FitBounds bounds={bounds} />
        {visible.map((c) => (
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
