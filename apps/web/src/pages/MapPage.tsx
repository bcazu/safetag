import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L, { latLngBounds, type LatLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { supabase } from '../lib/supabase'
import { communeLabel, divisionNames } from '../lib/territory'

// Centro por defecto: Pereira
const DEFAULT_CENTER: [number, number] = [4.8133, -75.6961]

interface MapCase {
  id: string
  address: string | null
  municipality: string | null
  commune: string | null
  neighborhood: string | null
  status: 'pending' | 'in_review' | 'assessed'
  priority: number
  result: 'green' | 'yellow' | 'orange' | 'red' | 'site_visit' | null
  lat: number
  lng: number
}

// Colores del semáforo desde los tokens CSS --sem-* (única fuente, index.css)
function semColor(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--sem-${name}`)
    .trim()
}
const RESULT_COLORS: Record<string, string> = {
  green: semColor('green'),
  yellow: semColor('yellow'),
  orange: semColor('orange'),
  red: semColor('red'),
  site_visit: semColor('site-visit'),
}
const PENDING_COLOR = semColor('none')

function markerColor(c: MapCase): string {
  return (c.result && RESULT_COLORS[c.result]) || PENDING_COLOR
}

// MapContainer solo aplica bounds al montar; esto re-encuadra al filtrar
function FitBounds({ bounds }: { bounds: LatLngBounds | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds)
  }, [map, bounds])
  return null
}

// Capa de clustering (backlog #5): con cientos/miles de puntos, Leaflet puro
// se arrastra; markercluster agrupa por zoom. Los popups usan navegación SPA.
function ClusterLayer({
  cases,
  popupHtml,
}: {
  cases: MapCase[]
  popupHtml: (c: MapCase) => string
}) {
  const map = useMap()
  const navigate = useNavigate()

  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 50,
      disableClusteringAtZoom: 17,
    })
    for (const c of cases) {
      const marker = L.circleMarker([c.lat, c.lng], {
        radius: 9,
        color: '#1f2937',
        weight: 1,
        fillColor: markerColor(c),
        fillOpacity: 0.9,
      })
      marker.bindPopup(popupHtml(c))
      marker.on('popupopen', (e) => {
        const link = e.popup
          .getElement()
          ?.querySelector<HTMLAnchorElement>('a[data-case]')
        link?.addEventListener('click', (ev) => {
          ev.preventDefault()
          navigate(`/caso/${c.id}`)
        })
      })
      group.addLayer(marker)
    }
    map.addLayer(group)
    return () => {
      map.removeLayer(group)
    }
  }, [map, cases, popupHtml, navigate])

  return null
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
}

export default function MapPage() {
  const { t } = useTranslation()
  // null = cargando; el mapa solo se monta con datos porque MapContainer
  // fija centro/bounds únicamente en el montaje
  const [cases, setCases] = useState<MapCase[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [municipalityFilter, setMunicipalityFilter] = useState('')
  const [communeFilter, setCommuneFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [divNames, setDivNames] = useState<Map<string, string>>()

  useEffect(() => {
    supabase
      .from('map_cases')
      .select('*')
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setCases((data as MapCase[]) ?? [])
      })
    divisionNames().then(setDivNames)
  }, [])

  // territorios presentes en los datos = donde hay revisiones
  const municipalities = useMemo(
    () =>
      [
        ...new Set((cases ?? []).map((c) => c.municipality).filter(Boolean)),
      ].sort() as string[],
    [cases],
  )
  const communes = useMemo(
    () =>
      [
        ...new Set(
          (cases ?? [])
            .filter(
              (c) => !municipalityFilter || c.municipality === municipalityFilter,
            )
            .map((c) => c.commune)
            .filter(Boolean),
        ),
      ].sort() as string[],
    [cases, municipalityFilter],
  )

  const visible = useMemo(
    () =>
      (cases ?? []).filter(
        (c) =>
          (!municipalityFilter || c.municipality === municipalityFilter) &&
          (!communeFilter || c.commune === communeFilter) &&
          (!resultFilter ||
            (resultFilter === 'unassessed'
              ? !c.result
              : c.result === resultFilter)),
      ),
    [cases, municipalityFilter, communeFilter, resultFilter],
  )

  const bounds = useMemo(
    () =>
      visible.length > 0
        ? latLngBounds(
            visible.map((c) => [c.lat, c.lng] as [number, number]),
          ).pad(0.2)
        : null,
    [visible],
  )

  const popupHtml = useMemo(
    () => (c: MapCase) => {
      const title = escapeHtml(c.address ?? c.id)
      const place = [c.neighborhood, c.commune && communeLabel(c.commune, divNames)]
        .filter(Boolean)
        .map((s) => escapeHtml(s as string))
        .join(' · ')
      const state = c.result
        ? escapeHtml(t(`assessment.result.${c.result}`))
        : `${escapeHtml(t(`case.status.${c.status}`))} · ${c.priority} ${escapeHtml(t('app:queue.priorityShort'))}`
      return `<strong>${title}</strong>${place ? `<div>${place}</div>` : ''}<div>${state}</div><a data-case href="/caso/${c.id}">${escapeHtml(t('app:queue.open'))}</a>`
    },
    [t, divNames],
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
          value={municipalityFilter}
          onChange={(e) => {
            setMunicipalityFilter(e.target.value)
            setCommuneFilter('')
          }}
        >
          <option value="">{t('app:map.allMunicipalities')}</option>
          {municipalities.map((m) => (
            <option key={m} value={m}>
              {t(`municipality.${m}`)}
            </option>
          ))}
        </select>
        <select
          value={communeFilter}
          onChange={(e) => setCommuneFilter(e.target.value)}
        >
          <option value="">{t('app:map.allCommunes')}</option>
          {communes.map((c) => (
            <option key={c} value={c}>
              {communeLabel(c, divNames)}
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
        <ClusterLayer cases={visible} popupHtml={popupHtml} />
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
