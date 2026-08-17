import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { routeCase, AIS_STRUCTURAL_SYSTEMS } from '@safetag/rules'
import { supabase } from '../lib/supabase'
import type { CaseRow, ReviewerRow } from '../lib/types'

type Tab = 'open' | 'assessed' | 'all'
type Sort = 'priority' | 'territory' | 'recent'

const PAGE_SIZE = 50

type QueueRow = CaseRow & {
  municipality: string | null
  assessments: { result: string; signed_at: string }[]
}

export default function Queue({ reviewer }: { reviewer: ReviewerRow }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('open')
  const [sort, setSort] = useState<Sort>('priority')
  const [onlyAvailable, setOnlyAvailable] = useState(true)
  const [page, setPage] = useState(0)
  const [cases, setCases] = useState<QueueRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setPage(0), [tab, sort, onlyAvailable])

  useEffect(() => {
    setCases(null)
    let query = supabase
      .from('cases')
      .select(
        'id, address, neighborhood, commune, municipality, building_name, status, priority, created_at, structural_system, building_use, floors_above, global_damage_pct, geotechnical, assigned_reviewer_id, assessments(result, signed_at)',
        { count: 'exact' },
      )
    if (tab === 'open') {
      query = query.in('status', ['pending', 'in_review'])
      if (onlyAvailable) {
        // pendientes sin tomar + los que tengo tomados yo
        query = query.or(
          `status.eq.pending,assigned_reviewer_id.eq.${reviewer.id}`,
        )
      }
    }
    if (tab === 'assessed') query = query.eq('status', 'assessed')

    if (sort === 'territory') {
      query = query
        .order('municipality', { ascending: true, nullsFirst: false })
        .order('commune', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })
    } else if (sort === 'recent') {
      query = query.order('created_at', { ascending: false })
    } else {
      query = query
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
    }

    query
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      .then(({ data, error: err, count }) => {
        if (err) setError(err.message)
        else {
          setCases(data as QueueRow[])
          setTotal(count ?? 0)
        }
      })
  }, [tab, sort, onlyAvailable, page, reviewer.id])

  function lastResult(c: QueueRow): string | null {
    const sorted = [...(c.assessments ?? [])].sort((a, b) =>
      b.signed_at.localeCompare(a.signed_at),
    )
    return sorted[0]?.result ?? null
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (error) return <main className="page error">{error}</main>

  return (
    <main className="page">
      <h2>{t('app:queue.title')}</h2>
      <div className="queue-controls">
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
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="priority">{t('app:queue.sort_priority')}</option>
          <option value="territory">{t('app:queue.sort_territory')}</option>
          <option value="recent">{t('app:queue.sort_recent')}</option>
        </select>
        {tab === 'open' && (
          <label className="check">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
            />
            {t('app:queue.onlyAvailable')}
          </label>
        )}
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
                {c.municipality && (
                  <span> · {t(`municipality.${c.municipality}`)}</span>
                )}
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

      {pages > 1 && (
        <div className="pagination">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            ←
          </button>
          <span>
            {t('app:queue.pageOf', { page: page + 1, pages, total })}
          </span>
          <button
            type="button"
            disabled={page >= pages - 1}
            onClick={() => setPage(page + 1)}
          >
            →
          </button>
        </div>
      )}
    </main>
  )
}
