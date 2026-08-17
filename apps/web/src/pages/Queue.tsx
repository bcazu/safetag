import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { routeCase, AIS_STRUCTURAL_SYSTEMS } from '@safetag/rules'
import { supabase } from '../lib/supabase'
import type { CaseRow, ReviewerRow } from '../lib/types'

type Tab = 'open' | 'assessed' | 'all'

type QueueRow = CaseRow & {
  assessments: { result: string; signed_at: string }[]
}

export default function Queue({ reviewer }: { reviewer: ReviewerRow }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('open')
  const [cases, setCases] = useState<QueueRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCases(null)
    let query = supabase
      .from('cases')
      .select(
        'id, address, neighborhood, commune, building_name, status, priority, created_at, structural_system, building_use, floors_above, global_damage_pct, geotechnical, assigned_reviewer_id, assessments(result, signed_at)',
      )
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
    if (tab === 'open') query = query.in('status', ['pending', 'in_review'])
    if (tab === 'assessed') query = query.eq('status', 'assessed')
    query.then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setCases(data as QueueRow[])
    })
  }, [tab])

  function lastResult(c: QueueRow): string | null {
    const sorted = [...(c.assessments ?? [])].sort((a, b) =>
      b.signed_at.localeCompare(a.signed_at),
    )
    return sorted[0]?.result ?? null
  }

  if (error) return <main className="page error">{error}</main>

  return (
    <main className="page">
      <h2>{t('app:queue.title')}</h2>
      <div className="tabs">
        {(['open', 'assessed', 'all'] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            className={tab === k ? 'tab active' : 'tab'}
            onClick={() => setTab(k)}
          >
            {t(`app:queue.tab_${k}`)}
          </button>
        ))}
      </div>
      {!cases && <p>{t('app:queue.loading')}</p>}
      {cases && cases.length === 0 && <p>{t('app:queue.empty')}</p>}
      <ul className="case-list">
        {(cases ?? []).map((c) => {
          const required = routeCase({
            buildingUse: c.building_use,
            geotechnical: c.geotechnical,
          })
          const result = lastResult(c)
          return (
            <li key={c.id} className="case-card">
              <div>
                <strong>{c.address ?? c.building_name ?? c.id}</strong>
                {c.neighborhood && <span> · {c.neighborhood}</span>}
                {c.commune && <span> · {c.commune}</span>}
              </div>
              <div className="case-meta">
                {c.status === 'assessed' && result ? (
                  <span className={`chip derived-${result}`}>
                    {t(`assessment.result.${result}`)}
                  </span>
                ) : (
                  <span>
                    {c.status === 'in_review'
                      ? c.assigned_reviewer_id === reviewer.id
                        ? t('app:queue.assignedToMe')
                        : t('app:queue.assignedToOther')
                      : t(`case.status.${c.status}`)}
                  </span>
                )}
                <span>
                  {c.priority} {t('app:queue.priorityShort')}
                </span>
                {c.structural_system && (
                  <span>{AIS_STRUCTURAL_SYSTEMS[c.structural_system]}</span>
                )}
                {c.building_use != null && (
                  <span>{t(`buildingUse.${c.building_use}`)}</span>
                )}
                {c.global_damage_pct && (
                  <span>{t(`globalDamage.${c.global_damage_pct}`)}</span>
                )}
                {required.length > 0 && (
                  <span className="badge">
                    {t('app:queue.requires', {
                      specialties: required
                        .map((s) => t(`reviewerSpecialty.${s}`))
                        .join(' + '),
                    })}
                  </span>
                )}
              </div>
              <Link to={`/caso/${c.id}`}>{t('app:queue.open')}</Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
