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
import type { CaseRow, PhotoRow, ReviewerRow } from '../lib/types'

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
  const [loadError, setLoadError] = useState<string | null>(null)

  const [risks, setRisks] = useState<Partial<Record<RiskKey, RiskLevel>>>({})
  const [result, setResult] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [override, setOverride] = useState('')
  const [measures, setMeasures] = useState<Set<string>>(new Set())
  const [visits, setVisits] = useState<Set<string>>(new Set())
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setLoadError(error.message)
        else setCaseRow(data as CaseRow)
      })
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
        {caseRow.commune && ` · ${caseRow.commune}`}
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
          <p className="hint">{t('app:assessment.remoteNote')}</p>

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
      </section>
    </main>
  )
}
