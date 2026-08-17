import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AIS_STRUCTURAL_SYSTEMS,
  RISK_CRITERIA,
  RISK_LEVELS,
  allowedResults,
  damageLevelThresholds,
  deriveHabitability,
  routeCase,
  type RiskLevel,
  type Risks,
} from '@safetag/rules'
import { supabase } from '../lib/supabase'
import { communeLabel, divisionNames } from '../lib/territory'
import type { AssessmentRow, CaseRow, PhotoRow, ReviewerRow } from '../lib/types'

const RISK_KEYS = [
  'globalStability',
  'geotechnical',
  'structural',
  'nonstructural',
] as const
type RiskKey = (typeof RISK_KEYS)[number]

const SAFETY_MEASURES = [
  'shoring',
  'cordon_off',
  'partial_evacuation',
  'utility_shutoff',
  'possible_demolition',
] as const

const SPECIALIST_VISITS = ['structural', 'geotechnical', 'utilities'] as const

// Todos los casos de v1 llegan por Kobo: captura remota → sin 'green' (T4.4)
const RESULTS = allowedResults('remote')

export default function CaseDetail({ reviewer }: { reviewer: ReviewerRow }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [caseRow, setCaseRow] = useState<CaseRow | null>(null)
  const [photos, setPhotos] = useState<(PhotoRow & { url: string | null })[]>([])
  const [assessments, setAssessments] = useState<AssessmentRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [risks, setRisks] = useState<Partial<Record<RiskKey, RiskLevel>>>({})
  const [result, setResult] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [override, setOverride] = useState('')
  const [measures, setMeasures] = useState<Set<string>>(new Set())
  const [visits, setVisits] = useState<Set<string>>(new Set())
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [divNames, setDivNames] = useState<Map<string, string>>()

  useEffect(() => {
    divisionNames().then(setDivNames)
  }, [])

  useEffect(() => {
    if (!id) return
    // cases tiene grants por columna (0006 excluye la PII contact/occupancy):
    // select('*') falla con 42501 — siempre lista explícita
    supabase
      .from('cases')
      .select(
        'id, address, neighborhood, commune, building_name, status, priority, created_at, inspection_type, not_inspected_reason, structural_system, floor_system, year_range, building_use, ground_floor_use, floors_above, basements, worst_damaged_floor, global_damage_pct, warning_signs, structural_damage, geotechnical, assigned_reviewer_id, assigned_at',
      )
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setLoadError(error.message)
        else setCaseRow(data as CaseRow)
      })
    supabase
      .from('assessments')
      .select('*')
      .eq('case_id', id)
      .order('signed_at', { ascending: false })
      .then(({ data }) => setAssessments((data as AssessmentRow[]) ?? []))
    supabase
      .from('photos')
      .select('*')
      .eq('case_id', id)
      .then(async ({ data }) => {
        const rows = (data ?? []) as PhotoRow[]
        const withUrls = await Promise.all(
          rows.map(async (p) => {
            const { data: signed } = await supabase.storage
              .from('photos')
              .createSignedUrl(p.storage_path, 3600)
            return { ...p, url: signed?.signedUrl ?? null }
          }),
        )
        setPhotos(withUrls)
      })
  }, [id])

  // Realtime: si otro revisor toma/suelta/dictamina este caso mientras está
  // abierto, el estado local se actualiza al instante (los eventos respetan RLS)
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`case-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cases',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const next = payload.new as Partial<CaseRow>
          setCaseRow((prev) =>
            prev
              ? {
                  ...prev,
                  status: next.status ?? prev.status,
                  assigned_reviewer_id: next.assigned_reviewer_id ?? null,
                  assigned_at: next.assigned_at ?? null,
                }
              : prev,
          )
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  const derived = useMemo(() => {
    if (RISK_KEYS.some((k) => !risks[k])) return null
    return deriveHabitability(risks as Risks)
  }, [risks])

  const required = useMemo(
    () =>
      caseRow
        ? routeCase({
            buildingUse: caseRow.building_use,
            geotechnical: caseRow.geotechnical,
          })
        : [],
    [caseRow],
  )

  // T4.1: usos indispensables → solo especialidad estructural (bloqueo duro)
  const structuralBlocked =
    required.includes('structural') && reviewer.specialty !== 'structural'
  // T4.2: hallazgo geotécnico → geotecnista o marcar visita especializada
  const geotechUnmet =
    required.includes('geotechnical') &&
    reviewer.specialty !== 'geotechnical' &&
    !visits.has('geotechnical')

  const thresholds = caseRow?.structural_system
    ? damageLevelThresholds(caseRow.structural_system)
    : null

  function toggle(set: Set<string>, value: string, apply: (s: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    apply(next)
  }

  const mine = caseRow?.assigned_reviewer_id === reviewer.id

  // Reclamo atómico: la condición status='pending' hace que el segundo en
  // llegar actualice cero filas (y recargue el estado real del caso)
  async function claim() {
    const { data, error } = await supabase
      .from('cases')
      .update({
        status: 'in_review',
        assigned_reviewer_id: reviewer.id,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
    if (error) {
      setFormError(error.message)
      return
    }
    if (!data || data.length === 0) {
      // otro revisor lo tomó primero: refrescar
      const { data: fresh } = await supabase
        .from('cases')
        .select('status, assigned_reviewer_id, assigned_at')
        .eq('id', id)
        .single()
      if (fresh) setCaseRow({ ...caseRow!, ...(fresh as Partial<CaseRow>) })
      return
    }
    setCaseRow({
      ...caseRow!,
      status: 'in_review',
      assigned_reviewer_id: reviewer.id,
    })
  }

  async function release() {
    const { error } = await supabase
      .from('cases')
      .update({ status: 'pending', assigned_reviewer_id: null, assigned_at: null })
      .eq('id', id)
      .eq('assigned_reviewer_id', reviewer.id)
    if (error) setFormError(error.message)
    else
      setCaseRow({
        ...caseRow!,
        status: 'pending',
        assigned_reviewer_id: null,
      })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (RISK_KEYS.some((k) => !risks[k])) {
      setFormError(t('app:assessment.errRisks'))
      return
    }
    if (!result) {
      setFormError(t('app:assessment.errResult'))
      return
    }
    if (result !== derived && !override.trim()) {
      setFormError(t('app:assessment.errOverride'))
      return
    }
    if (structuralBlocked || geotechUnmet) return

    setBusy(true)
    const { error } = await supabase.from('assessments').insert({
      case_id: id,
      reviewer_id: reviewer.id,
      result,
      derived_result: derived,
      risk_global_stability: risks.globalStability,
      risk_geotechnical: risks.geotechnical,
      risk_structural: risks.structural,
      risk_nonstructural: risks.nonstructural,
      override_justification: result !== derived ? override.trim() : null,
      notes: notes.trim() || null,
      safety_measures: [...measures],
      specialist_visit: [...visits],
    })
    if (error) {
      setBusy(false)
      setFormError(
        error.code === '42501' ? t('app:assessment.errLicense') : error.message,
      )
      return
    }
    await supabase.from('cases').update({ status: 'assessed' }).eq('id', id)
    setBusy(false)
    navigate('/')
  }

  if (loadError) return <main className="page error">{loadError}</main>
  if (!caseRow) return <main className="page">{t('common.loading')}</main>

  const dmg = caseRow.structural_damage

  return (
    <main className="page">
      <Link to="/">← {t('app:case.back')}</Link>
      <h2>
        {caseRow.address ?? caseRow.building_name ?? caseRow.id}
        {caseRow.commune && ` · ${communeLabel(caseRow.commune, divNames)}`}
      </h2>

      <section>
        <h3>{t('app:case.characteristics')}</h3>
        <dl className="facts">
          {caseRow.structural_system && (
            <>
              <dt>{t('app:case.system')}</dt>
              <dd>{AIS_STRUCTURAL_SYSTEMS[caseRow.structural_system]}</dd>
            </>
          )}
          {caseRow.floors_above != null && (
            <>
              <dt>{t('app:case.floors')}</dt>
              <dd>
                {caseRow.floors_above}
                {caseRow.basements ? ` (+${caseRow.basements} sót.)` : ''}
              </dd>
            </>
          )}
          {caseRow.building_use != null && (
            <>
              <dt>{t('app:case.use')}</dt>
              <dd>{t(`buildingUse.${caseRow.building_use}`)}</dd>
            </>
          )}
          {caseRow.global_damage_pct && (
            <>
              <dt>{t('app:case.globalDamage')}</dt>
              <dd>{t(`globalDamage.${caseRow.global_damage_pct}`)}</dd>
            </>
          )}
          {dmg?.stability && (
            <>
              <dt>{t('app:case.stability')}</dt>
              <dd>
                {dmg.stability.collapse &&
                  t(`stability.collapse.${dmg.stability.collapse}`)}
                {dmg.stability.tilt &&
                  ` · ${t(`stability.tilt.${dmg.stability.tilt}`)}`}
              </dd>
            </>
          )}
          {caseRow.warning_signs && caseRow.warning_signs.length > 0 && (
            <>
              <dt>{t('app:case.warningSigns')}</dt>
              <dd>
                {caseRow.warning_signs
                  .map((s) => t(`warningSign.${s}`))
                  .join(', ')}
              </dd>
            </>
          )}
        </dl>

        {dmg?.elements && Object.keys(dmg.elements).length > 0 && (
          <>
            <h4>
              {t('app:case.damageMatrix', {
                floor: caseRow.worst_damaged_floor ?? '—',
              })}
            </h4>
            <ul className="damage-list">
              {Object.entries(dmg.elements).map(([el, d]) => (
                <li key={el}>
                  {t(`damageElement.${el}`)}: {t(`damageLevel.${d.level}`)}
                  {d.extent_pct != null &&
                    ` (${d.extent_pct}% ${t('app:case.extent')})`}
                </li>
              ))}
            </ul>
          </>
        )}

        {thresholds && thresholds.status === 'verified' && (
          <details>
            <summary>
              {t('app:case.thresholds', { appliesTo: thresholds.appliesTo })}
            </summary>
            <ul className="damage-list">
              {thresholds.levels.map((l) => (
                <li key={l.level}>
                  {t(`damageLevel.${l.level}`)}:{' '}
                  {l.maxWidthMm != null && l.minWidthMm == null
                    ? `< ${l.maxWidthMm} mm`
                    : l.minWidthMm != null && l.maxWidthMm != null
                      ? `${l.minWidthMm} – ${l.maxWidthMm} mm`
                      : l.minWidthMm != null
                        ? `> ${l.minWidthMm} mm`
                        : ''}
                  {l.qualitative ? ` — ${l.qualitative}` : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
        {thresholds && thresholds.status === 'unknown' && (
          <p className="notice">
            {t('app:case.thresholdsUnknown', { reason: thresholds.reason })}
          </p>
        )}
      </section>

      <section>
        <h3>{t('app:case.photos')}</h3>
        {photos.length === 0 && <p>{t('app:case.noPhotos')}</p>}
        <div className="photo-grid">
          {photos.map(
            (p) =>
              p.url && (
                <figure key={p.id}>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt={p.photo_type ?? ''} loading="lazy" />
                  </a>
                  <figcaption>
                    {p.photo_type ? t(`photoType.${p.photo_type}`) : ''}
                  </figcaption>
                </figure>
              ),
          )}
        </div>
      </section>

      <section>
        <h3>{t('app:assessment.title')}</h3>

        {/* dictámenes ya firmados: lectura, no re-dictamen */}
        {assessments && assessments.length > 0 ? (
          assessments.map((a) => (
            <article key={a.id} className="assessment-card">
              <p className={`derived derived-${a.result}`}>
                {t(`assessment.result.${a.result}`)}
              </p>
              {a.derived_result && a.result !== a.derived_result && (
                <p className="notice">
                  {t('app:assessment.derived')}:{' '}
                  {t(`assessment.result.${a.derived_result}`)} —{' '}
                  {a.override_justification}
                </p>
              )}
              <dl className="facts">
                {(
                  [
                    ['globalStability', a.risk_global_stability],
                    ['geotechnical', a.risk_geotechnical],
                    ['structural', a.risk_structural],
                    ['nonstructural', a.risk_nonstructural],
                  ] as const
                ).map(
                  ([key, level]) =>
                    level && (
                      <span key={key} style={{ display: 'contents' }}>
                        <dt>{t(`risk.${key}`)}</dt>
                        <dd>{t(`riskLevel.${level}`)}</dd>
                      </span>
                    ),
                )}
                {a.safety_measures && a.safety_measures.length > 0 && (
                  <>
                    <dt>{t('app:assessment.measures')}</dt>
                    <dd>
                      {a.safety_measures
                        .map((m) => t(`safetyMeasure.${m}`))
                        .join(', ')}
                    </dd>
                  </>
                )}
                {a.specialist_visit && a.specialist_visit.length > 0 && (
                  <>
                    <dt>{t('app:assessment.specialistVisit')}</dt>
                    <dd>
                      {a.specialist_visit
                        .map((v) => t(`specialistVisit.${v}`))
                        .join(', ')}
                    </dd>
                  </>
                )}
                {a.notes && (
                  <>
                    <dt>{t('app:assessment.notes')}</dt>
                    <dd>{a.notes}</dd>
                  </>
                )}
                <dt>{t('assessment.signedAt')}</dt>
                <dd>{new Date(a.signed_at).toLocaleString()}</dd>
              </dl>
            </article>
          ))
        ) : caseRow.status === 'pending' ? (
          <div className="stack">
            <p className="notice">{t('app:claim.intro')}</p>
            <button type="button" onClick={claim}>
              {t('app:claim.take')}
            </button>
            {formError && <p className="error">{formError}</p>}
          </div>
        ) : !mine ? (
          <p className="notice">
            {t('app:claim.takenByOther', {
              since: caseRow.assigned_at
                ? new Date(caseRow.assigned_at).toLocaleString()
                : '—',
            })}
          </p>
        ) : (
          <>
            <button type="button" className="linklike" onClick={release}>
              {t('app:claim.release')}
            </button>
            {structuralBlocked && (
              <p className="error">
                {t('app:assessment.needStructural', {
                  use: t(`buildingUse.${caseRow.building_use}`),
                })}
              </p>
            )}
            <form onSubmit={submit} className="stack">
          <fieldset>
            <legend>{t('app:assessment.risks')}</legend>
            {RISK_KEYS.map((key) => {
              const criteria = RISK_CRITERIA[key]
              return (
                <div key={key} className="risk-row">
                  <label>
                    {t(`app:assessment.risk_${key}`)}
                    <select
                      value={risks[key] ?? ''}
                      onChange={(e) =>
                        setRisks({
                          ...risks,
                          [key]: (e.target.value || undefined) as RiskLevel,
                        })
                      }
                    >
                      <option value="">
                        {t('app:assessment.selectLevel')}
                      </option>
                      {RISK_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {t(`riskLevel.${l}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {criteria.status === 'verified' ? (
                    <details>
                      <summary>
                        {t('app:assessment.guidanceTable', {
                          table: criteria.table,
                        })}
                      </summary>
                      <ul>
                        {RISK_LEVELS.map((l) => (
                          <li key={l}>
                            <strong>{t(`riskLevel.${l}`)}:</strong>{' '}
                            {criteria.criteria[l]}
                          </li>
                        ))}
                        {criteria.tiltRule && <li>{criteria.tiltRule}</li>}
                      </ul>
                    </details>
                  ) : (
                    <p className="hint">{t('app:assessment.noGuidance')}</p>
                  )}
                </div>
              )
            })}
          </fieldset>

          <p className={`derived derived-${derived ?? 'pending'}`}>
            {t('app:assessment.derived')}:{' '}
            {derived
              ? t(`assessment.result.${derived}`)
              : t('app:assessment.derivedPending')}
          </p>

          <label>
            {t('app:assessment.result')}
            <select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="">—</option>
              {RESULTS.map((r) => (
                <option key={r} value={r}>
                  {t(`assessment.result.${r}`)}
                </option>
              ))}
            </select>
          </label>
          {derived === 'green' && (
            <p className="notice">{t('app:assessment.remoteNote')}</p>
          )}

          {derived && result && result !== derived && (
            <label>
              {t('app:assessment.override')}
              <textarea
                value={override}
                onChange={(e) => setOverride(e.target.value)}
                required
              />
              <span className="hint">{t('app:assessment.overrideHint')}</span>
            </label>
          )}

          <fieldset>
            <legend>{t('app:assessment.measures')}</legend>
            {SAFETY_MEASURES.map((m) => {
              const demolitionLocked =
                m === 'possible_demolition' &&
                !reviewer.can_recommend_demolition
              return (
                <label key={m} className="check">
                  <input
                    type="checkbox"
                    checked={measures.has(m)}
                    disabled={demolitionLocked}
                    onChange={() => toggle(measures, m, setMeasures)}
                  />
                  {t(`safetyMeasure.${m}`)}
                  {demolitionLocked && (
                    <span className="hint">
                      {' '}
                      — {t('app:assessment.demolitionBlocked')}
                    </span>
                  )}
                </label>
              )
            })}
          </fieldset>

          <fieldset>
            <legend>{t('app:assessment.specialistVisit')}</legend>
            {SPECIALIST_VISITS.map((v) => (
              <label key={v} className="check">
                <input
                  type="checkbox"
                  checked={visits.has(v)}
                  onChange={() => toggle(visits, v, setVisits)}
                />
                {t(`specialistVisit.${v}`)}
              </label>
            ))}
          </fieldset>
          {geotechUnmet && (
            <p className="error">{t('app:assessment.needGeotech')}</p>
          )}

          <label>
            {t('app:assessment.notes')}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {formError && <p className="error">{formError}</p>}
          <button
            type="submit"
            disabled={busy || structuralBlocked || geotechUnmet}
          >
            {t(busy ? 'app:assessment.submitting' : 'app:assessment.submit')}
          </button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
