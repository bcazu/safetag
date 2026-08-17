import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { routeCase, AIS_STRUCTURAL_SYSTEMS } from '@safetag/rules'
import { supabase } from '../lib/supabase'
import type { CaseRow, ReviewerRow } from '../lib/types'

export default function Queue({ reviewer }: { reviewer: ReviewerRow }) {
  const { t } = useTranslation()
  const [cases, setCases] = useState<CaseRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('cases')
      .select(
        'id, address, neighborhood, commune, building_name, status, priority, created_at, structural_system, building_use, floors_above, global_damage_pct, geotechnical, assigned_reviewer_id',
      )
      .in('status', ['pending', 'in_review'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setCases(data as CaseRow[])
      })
  }, [])

  if (error) return <main className="page error">{error}</main>
  if (!cases) return <main className="page">{t('app:queue.loading')}</main>

  return (
    <main className="page">
      <h2>{t('app:queue.title')}</h2>
      {cases.length === 0 && <p>{t('app:queue.empty')}</p>}
      <ul className="case-list">
        {cases.map((c) => {
          const required = routeCase({
            buildingUse: c.building_use,
            geotechnical: c.geotechnical,
          })
          return (
            <li key={c.id} className="case-card">
              <div>
                <strong>{c.address ?? c.building_name ?? c.id}</strong>
                {c.neighborhood && <span> · {c.neighborhood}</span>}
                {c.commune && <span> · {c.commune}</span>}
              </div>
              <div className="case-meta">
                <span>
                  {c.status === 'in_review'
                    ? c.assigned_reviewer_id === reviewer.id
                      ? t('app:queue.assignedToMe')
                      : t('app:queue.assignedToOther')
                    : t(`case.status.${c.status}`)}
                </span>
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
