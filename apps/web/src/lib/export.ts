import { AIS_STRUCTURAL_SYSTEMS } from '@safetag/rules'
import type { AisStructuralSystem } from '@safetag/rules'
import { supabase } from './supabase'
import { communeLabel } from './territory'

// Export consolidado para el PMU (backlog #9): CSV y GeoJSON client-side.
//
// PII y trazabilidad interna quedan FUERA por diseño (Ley 1581):
// `contact` y `occupancy` ni siquiera tienen grant de SELECT (0006);
// `comments` e `inspector_code` sí lo tienen pero no se piden aquí.
// `cases` tiene grants por columna: la lista del select es explícita
// a propósito — `select('*')` falla con 42501.

type Translate = (key: string, options?: Record<string, unknown>) => string

type ExportAssessment = {
  result: string
  risk_global_stability: string | null
  risk_geotechnical: string | null
  risk_structural: string | null
  risk_nonstructural: string | null
  signed_at: string
}

export type ExportCaseRow = {
  id: string
  kobo_submission_id: string | null
  municipality: string | null
  commune: string | null
  neighborhood: string | null
  address: string | null
  building_name: string | null
  structural_system: string | null
  building_use: number | null
  floors_above: number | null
  global_damage_pct: string | null
  inspection_type: string | null
  is_inhabited: 'yes' | 'no' | 'unknown' | null
  status: string
  priority: number
  created_at: string
  assessments: ExportAssessment[]
  lat: number | null
  lng: number | null
}

const CASE_COLUMNS =
  'id, kobo_submission_id, municipality, commune, neighborhood, address, ' +
  'building_name, structural_system, building_use, floors_above, ' +
  'global_damage_pct, inspection_type, is_inhabited, status, priority, ' +
  'created_at, assessments(result, risk_global_stability, risk_geotechnical, ' +
  'risk_structural, risk_nonstructural, signed_at)'

// PostgREST corta en 1000 filas por respuesta: paginar por rangos para no
// truncar el consolidado en silencio.
const CHUNK = 1000

export async function fetchExportRows(mun: string): Promise<ExportCaseRow[]> {
  const rows: Omit<ExportCaseRow, 'lat' | 'lng'>[] = []
  for (let from = 0; ; from += CHUNK) {
    let query = supabase
      .from('cases')
      .select(CASE_COLUMNS)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + CHUNK - 1)
    if (mun !== 'all') query = query.eq('municipality', mun)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    const page = (data ?? []) as unknown as Omit<ExportCaseRow, 'lat' | 'lng'>[]
    rows.push(...page)
    if (page.length < CHUNK) break
  }

  // Coordenadas planas vía map_cases (0013): `location` es geography y el
  // cliente no debe parsear WKB. Casos sin GPS quedan con lat/lng nulos.
  const coords = new Map<string, { lat: number; lng: number }>()
  for (let from = 0; ; from += CHUNK) {
    let query = supabase
      .from('map_cases')
      .select('id, lat, lng')
      .order('id', { ascending: true })
      .range(from, from + CHUNK - 1)
    if (mun !== 'all') query = query.eq('municipality', mun)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    const page = (data ?? []) as { id: string; lat: number; lng: number }[]
    for (const p of page) coords.set(p.id, { lat: p.lat, lng: p.lng })
    if (page.length < CHUNK) break
  }

  return rows.map((r) => ({
    ...r,
    lat: coords.get(r.id)?.lat ?? null,
    lng: coords.get(r.id)?.lng ?? null,
  }))
}

function lastAssessment(r: ExportCaseRow): ExportAssessment | null {
  const sorted = [...(r.assessments ?? [])].sort((a, b) =>
    b.signed_at.localeCompare(a.signed_at),
  )
  return sorted[0] ?? null
}

type Column = {
  header: string
  coord?: boolean // lat/lng: en GeoJSON van en geometry, no en properties
  value: (r: ExportCaseRow) => string | number | null
}

function exportColumns(t: Translate, divNames?: Map<string, string>): Column[] {
  const opt = (key: string, slug: string | number | null) =>
    slug == null ? null : t(key, { defaultValue: String(slug) })
  const risk = (slug: string | null) => opt(`riskLevel.${slug}`, slug)
  return [
    { header: t('app:export.col_id'), value: (r) => r.id },
    { header: t('app:export.col_kobo'), value: (r) => r.kobo_submission_id },
    {
      header: t('app:export.col_municipality'),
      value: (r) => opt(`municipality.${r.municipality}`, r.municipality),
    },
    {
      header: t('app:export.col_commune'),
      value: (r) => (r.commune ? communeLabel(r.commune, divNames) : null),
    },
    { header: t('app:export.col_neighborhood'), value: (r) => r.neighborhood },
    { header: t('app:export.col_address'), value: (r) => r.address },
    { header: t('app:export.col_building'), value: (r) => r.building_name },
    { header: t('app:export.col_lat'), coord: true, value: (r) => r.lat },
    { header: t('app:export.col_lng'), coord: true, value: (r) => r.lng },
    {
      header: t('app:export.col_system'),
      value: (r) =>
        r.structural_system
          ? (AIS_STRUCTURAL_SYSTEMS[
              r.structural_system as AisStructuralSystem
            ] ?? r.structural_system)
          : null,
    },
    {
      header: t('app:export.col_use'),
      value: (r) => opt(`buildingUse.${r.building_use}`, r.building_use),
    },
    { header: t('app:export.col_floors'), value: (r) => r.floors_above },
    {
      header: t('app:export.col_damage'),
      value: (r) => opt(`globalDamage.${r.global_damage_pct}`, r.global_damage_pct),
    },
    {
      header: t('app:export.col_inspection'),
      value: (r) => opt(`inspectionType.${r.inspection_type}`, r.inspection_type),
    },
    {
      header: t('app:export.col_inhabited'),
      value: (r) => opt(`app:export.inhabited_${r.is_inhabited}`, r.is_inhabited),
    },
    {
      header: t('app:export.col_status'),
      value: (r) => opt(`case.status.${r.status}`, r.status),
    },
    { header: t('app:export.col_priority'), value: (r) => r.priority },
    { header: t('app:export.col_created'), value: (r) => r.created_at },
    {
      header: t('app:export.col_result'),
      value: (r) => {
        const a = lastAssessment(r)
        return a ? opt(`assessment.result.${a.result}`, a.result) : null
      },
    },
    {
      header: t('app:export.col_signed'),
      value: (r) => lastAssessment(r)?.signed_at ?? null,
    },
    {
      header: t('app:export.col_riskGlobal'),
      value: (r) => risk(lastAssessment(r)?.risk_global_stability ?? null),
    },
    {
      header: t('app:export.col_riskGeo'),
      value: (r) => risk(lastAssessment(r)?.risk_geotechnical ?? null),
    },
    {
      header: t('app:export.col_riskStruct'),
      value: (r) => risk(lastAssessment(r)?.risk_structural ?? null),
    },
    {
      header: t('app:export.col_riskNonstruct'),
      value: (r) => risk(lastAssessment(r)?.risk_nonstructural ?? null),
    },
  ]
}

function csvField(v: string | number | null): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** CSV separado por comas, UTF-8 con BOM (Excel en español). */
export function casesCsv(
  rows: ExportCaseRow[],
  t: Translate,
  divNames?: Map<string, string>,
): string {
  const cols = exportColumns(t, divNames)
  const lines = [
    cols.map((c) => csvField(c.header)).join(','),
    ...rows.map((r) => cols.map((c) => csvField(c.value(r))).join(',')),
  ]
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

/** FeatureCollection con Point [lon, lat]; sin GPS → geometry null. */
export function casesGeoJson(
  rows: ExportCaseRow[],
  t: Translate,
  divNames?: Map<string, string>,
): string {
  const cols = exportColumns(t, divNames).filter((c) => !c.coord)
  const features = rows.map((r) => ({
    type: 'Feature' as const,
    geometry:
      r.lat != null && r.lng != null
        ? { type: 'Point' as const, coordinates: [r.lng, r.lat] }
        : null,
    properties: Object.fromEntries(cols.map((c) => [c.header, c.value(r)])),
  }))
  return JSON.stringify({ type: 'FeatureCollection', features })
}

export function downloadFile(
  filename: string,
  mime: string,
  content: string,
): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportFilename(mun: string, ext: 'csv' | 'geojson'): string {
  const date = new Date().toISOString().slice(0, 10)
  const suffix = mun === 'all' ? '' : `-${mun}`
  return `safetag-casos${suffix}-${date}.${ext}`
}
