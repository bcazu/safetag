import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { routeCase } from '@safetag/rules'
import { supabase } from '../lib/supabase'
import type { CaseRow } from '../lib/types'

// Filas de las vistas agregadas de 0015 (sin PII; conteos bajo RLS)
type TerritoryRow = {
  municipality: string | null
  commune: string | null
  status: 'pending' | 'in_review' | 'assessed'
  result: string | null
  n: number
}
type RoutingRow = {
  municipality: string | null
  building_use: number | null
  geotechnical: CaseRow['geotechnical']
  status: string
  n: number
}
type PriorityRow = { municipality: string | null; priority: number; n: number }
type DailyRow = {
  day: string
  municipality: string | null
  cases_created: number
  assessments_signed: number
}

const SEM_ORDER = ['green', 'yellow', 'orange', 'red', 'site_visit'] as const

type Tip = {
  x: number
  y: number
  title: string
  rows: { color?: string; label: string; value: string }[]
}

function inMun<T extends { municipality: string | null }>(
  rows: T[],
  mun: string,
): T[] {
  return mun === 'all' ? rows : rows.filter((r) => r.municipality === mun)
}

export default function Dashboard() {
  const { t } = useTranslation()
  const [territory, setTerritory] = useState<TerritoryRow[] | null>(null)
  const [routing, setRouting] = useState<RoutingRow[]>([])
  const [priority, setPriority] = useState<PriorityRow[]>([])
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [active7d, setActive7d] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mun, setMun] = useState<string>('all')
  const [tip, setTip] = useState<Tip | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('dashboard_territory').select('*'),
      supabase.from('dashboard_routing').select('*'),
      supabase.from('dashboard_priority').select('*'),
      supabase.from('dashboard_daily').select('*'),
      supabase.from('dashboard_active_reviewers').select('*').maybeSingle(),
    ]).then(([te, ro, pr, da, ac]) => {
      const err = te.error ?? ro.error ?? pr.error ?? da.error ?? ac.error
      if (err) {
        setError(err.message)
        return
      }
      setTerritory((te.data ?? []) as TerritoryRow[])
      setRouting((ro.data ?? []) as RoutingRow[])
      setPriority((pr.data ?? []) as PriorityRow[])
      setDaily((da.data ?? []) as DailyRow[])
      setActive7d((ac.data as { active_7d: number } | null)?.active_7d ?? 0)
    })
  }, [])

  const munOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of territory ?? []) if (r.municipality) set.add(r.municipality)
    return [...set].sort()
  }, [territory])

  const munLabel = (code: string) =>
    t(`municipality.${code}`, { defaultValue: code })

  const terr = useMemo(() => inMun(territory ?? [], mun), [territory, mun])

  const totals = useMemo(() => {
    let total = 0
    let assessed = 0
    let unsafe = 0
    const sem = new Map<string, number>()
    for (const r of terr) {
      total += r.n
      if (r.status === 'assessed') {
        assessed += r.n
        if (r.result) {
          sem.set(r.result, (sem.get(r.result) ?? 0) + r.n)
          if (r.result === 'red' || r.result === 'orange') unsafe += r.n
        }
      }
    }
    return { total, assessed, open: total - assessed, unsafe, sem }
  }, [terr])

  // Enrutamiento: la regla vive en packages/rules; aquí solo se aplica a los
  // hechos crudos (regla dura 9 del proyecto)
  const specialists = useMemo(() => {
    let structural = 0
    let geotechnical = 0
    for (const r of inMun(routing, mun)) {
      if (r.status === 'assessed') continue
      const req = routeCase({
        buildingUse: r.building_use,
        geotechnical: r.geotechnical,
      })
      if (req.includes('structural')) structural += r.n
      if (req.includes('geotechnical')) geotechnical += r.n
    }
    return { structural, geotechnical, any: structural + geotechnical }
  }, [routing, mun])

  const priorityBands = useMemo(() => {
    const bands = [
      { key: 'high', color: 'var(--viz-ord-high)', n: 0 },
      { key: 'mid', color: 'var(--viz-ord-mid)', n: 0 },
      { key: 'low', color: 'var(--viz-ord-low)', n: 0 },
    ]
    for (const r of inMun(priority, mun)) {
      const band = r.priority >= 70 ? bands[0] : r.priority >= 40 ? bands[1] : bands[2]
      band.n += r.n
    }
    return bands
  }, [priority, mun])

  // Avance por territorio: municipios, o comunas del municipio filtrado
  const progress = useMemo(() => {
    const byKey = new Map<string, { total: number; assessed: number }>()
    for (const r of terr) {
      const key =
        mun === 'all' ? (r.municipality ?? '—') : (r.commune ?? '—')
      const acc = byKey.get(key) ?? { total: 0, assessed: 0 }
      acc.total += r.n
      if (r.status === 'assessed') acc.assessed += r.n
      byKey.set(key, acc)
    }
    return [...byKey.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total)
  }, [terr, mun])

  const progressLabel = (key: string) => {
    if (key === '—') return t('app:dash.noTerritory')
    if (mun === 'all') return munLabel(key)
    return key.startsWith(`${mun}-`) ? key.slice(mun.length + 1) : key
  }

  // Ritmo: últimos 14 días, huecos en 0
  const rhythm = useMemo(() => {
    const byDay = new Map<string, { created: number; signed: number }>()
    for (const r of inMun(daily, mun)) {
      const acc = byDay.get(r.day) ?? { created: 0, signed: 0 }
      acc.created += r.cases_created
      acc.signed += r.assessments_signed
      byDay.set(r.day, acc)
    }
    const days: { day: string; created: number; signed: number }[] = []
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      days.push({ day: iso, ...(byDay.get(iso) ?? { created: 0, signed: 0 }) })
    }
    return days
  }, [daily, mun])

  if (error) return <main className="page error">{error}</main>
  if (!territory) return <main className="page">{t('common.loading')}</main>

  const pctAssessed =
    totals.total > 0 ? Math.round((totals.assessed / totals.total) * 100) : 0

  return (
    <main className="page dash">
      <h2>{t('app:dash.title')}</h2>

      <div className="dash-filters">
        <select value={mun} onChange={(e) => setMun(e.target.value)}>
          <option value="all">{t('app:map.allMunicipalities')}</option>
          {munOptions.map((m) => (
            <option key={m} value={m}>
              {munLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="kpis">
        <Kpi label={t('app:dash.kpiTotal')} value={totals.total} />
        <Kpi label={t('app:dash.kpiOpen')} value={totals.open} />
        <Kpi
          label={t('app:dash.kpiAssessed')}
          value={totals.assessed}
          detail={`${pctAssessed}%`}
        />
        <Kpi label={t('app:dash.kpiUnsafe')} value={totals.unsafe} />
        <Kpi
          label={t('app:dash.kpiSpecialist')}
          value={specialists.any}
          detail={
            specialists.any > 0
              ? `${specialists.structural} ${t('reviewerSpecialty.structural').toLowerCase()} · ${specialists.geotechnical} ${t('reviewerSpecialty.geotechnical').toLowerCase()}`
              : undefined
          }
        />
        <Kpi label={t('app:dash.kpiReviewers')} value={active7d ?? 0} />
      </div>

      <section className="viz-card">
        <h3>{t('app:dash.semTitle')}</h3>
        {totals.assessed === 0 ? (
          <p className="hint">{t('app:dash.semEmpty')}</p>
        ) : (
          <SemaphoreBar sem={totals.sem} total={totals.assessed} setTip={setTip} />
        )}
        <TableView
          caption={t('app:dash.semTitle')}
          head={[t('app:dash.thResult'), t('app:dash.thCases'), '%']}
          rows={SEM_ORDER.filter((k) => totals.sem.get(k)).map((k) => [
            t(`assessment.result.${k}`),
            String(totals.sem.get(k)),
            `${Math.round(((totals.sem.get(k) ?? 0) / totals.assessed) * 100)}%`,
          ])}
        />
      </section>

      <div className="dash-grid">
        <section className="viz-card">
          <h3>
            {mun === 'all'
              ? t('app:dash.progressTitle')
              : t('app:dash.progressTitleCommune')}
          </h3>
          <div className="meters">
            {progress.map((p) => {
              const pct =
                p.total > 0 ? Math.round((p.assessed / p.total) * 100) : 0
              return (
                <div key={p.key} className="meter-row">
                  <span className="meter-label">{progressLabel(p.key)}</span>
                  <div className="meter" role="img" aria-label={`${pct}%`}>
                    <div className="meter-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="meter-value">
                    {p.assessed}/{p.total} · {pct}%
                  </span>
                </div>
              )
            })}
          </div>
          <TableView
            caption={t('app:dash.progressTitle')}
            head={[
              t('app:dash.thTerritory'),
              t('app:dash.kpiAssessed'),
              t('app:dash.thCases'),
              '%',
            ]}
            rows={progress.map((p) => [
              progressLabel(p.key),
              String(p.assessed),
              String(p.total),
              p.total > 0
                ? `${Math.round((p.assessed / p.total) * 100)}%`
                : '0%',
            ])}
          />
        </section>

        <section className="viz-card">
          <h3>{t('app:dash.priorityTitle')}</h3>
          <PriorityBars bands={priorityBands} setTip={setTip} />
          <TableView
            caption={t('app:dash.priorityTitle')}
            head={[t('app:dash.thBand'), t('app:dash.thCases')]}
            rows={priorityBands.map((b) => [
              t(`app:dash.band_${b.key}`),
              String(b.n),
            ])}
          />
        </section>
      </div>

      <section className="viz-card">
        <h3>{t('app:dash.rhythmTitle')}</h3>
        <RhythmChart days={rhythm} setTip={setTip} />
        <TableView
          caption={t('app:dash.rhythmTitle')}
          head={[
            t('app:dash.thDay'),
            t('app:dash.rhythmCases'),
            t('app:dash.rhythmAssessments'),
          ]}
          rows={rhythm.map((d) => [
            d.day,
            String(d.created),
            String(d.signed),
          ])}
        />
      </section>

      {tip && (
        <div
          className="viz-tooltip"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          <strong>{tip.title}</strong>
          {tip.rows.map((r) => (
            <div key={r.label} className="viz-tooltip-row">
              {r.color && (
                <i className="viz-key" style={{ background: r.color }} />
              )}
              <span className="viz-tooltip-value">{r.value}</span>
              <span className="viz-tooltip-label">{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

function Kpi({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail?: string
}) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value.toLocaleString('es-CO')}</span>
      {detail && <span className="tile-detail">{detail}</span>}
    </div>
  )
}

/** Barra apilada única del semáforo. El color nunca va solo: conteo dentro
 * del segmento cuando cabe, leyenda con texto y tabla (alivio del WARN de
 * contraste del amarillo). */
function SemaphoreBar({
  sem,
  total,
  setTip,
}: {
  sem: Map<string, number>
  total: number
  setTip: (t: Tip | null) => void
}) {
  const { t } = useTranslation()
  const parts = SEM_ORDER.filter((k) => (sem.get(k) ?? 0) > 0)
  return (
    <>
      <div className="sem-bar">
        {parts.map((k) => {
          const n = sem.get(k) ?? 0
          const pct = (n / total) * 100
          // etiqueta dentro solo si cabe con holgura (nunca recortada)
          const labelFits = pct >= 6 + 3 * String(n).length
          return (
            <div
              key={k}
              tabIndex={0}
              className="sem-seg"
              style={{
                width: `${pct}%`,
                background: `var(--sem-${k.replace('_', '-')})`,
                color: `var(--sem-${k.replace('_', '-')}-text)`,
              }}
              onPointerMove={(e) =>
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  title: t(`assessment.result.${k}`),
                  rows: [
                    {
                      label: t('app:dash.thCases').toLowerCase(),
                      value: `${n} (${Math.round(pct)}%)`,
                    },
                  ],
                })
              }
              onPointerLeave={() => setTip(null)}
              onFocus={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setTip({
                  x: r.left,
                  y: r.bottom,
                  title: t(`assessment.result.${k}`),
                  rows: [
                    {
                      label: t('app:dash.thCases').toLowerCase(),
                      value: `${n} (${Math.round(pct)}%)`,
                    },
                  ],
                })
              }}
              onBlur={() => setTip(null)}
            >
              {labelFits && <span>{n}</span>}
            </div>
          )
        })}
      </div>
      <div className="viz-legend">
        {parts.map((k) => (
          <span key={k}>
            <i
              className="viz-key"
              style={{ background: `var(--sem-${k.replace('_', '-')})` }}
            />
            {t(`assessment.result.${k}`)} · {sem.get(k)}
          </span>
        ))}
      </div>
    </>
  )
}

function PriorityBars({
  bands,
  setTip,
}: {
  bands: { key: string; color: string; n: number }[]
  setTip: (t: Tip | null) => void
}) {
  const { t } = useTranslation()
  const max = Math.max(1, ...bands.map((b) => b.n))
  const total = bands.reduce((s, b) => s + b.n, 0)
  return (
    <div className="hbars">
      {bands.map((b) => (
        <div key={b.key} className="hbar-row">
          <span className="hbar-label">{t(`app:dash.band_${b.key}`)}</span>
          <div
            className="hbar-track"
            tabIndex={0}
            onPointerMove={(e) =>
              setTip({
                x: e.clientX,
                y: e.clientY,
                title: t(`app:dash.band_${b.key}`),
                rows: [
                  {
                    label: t('app:dash.ofQueue'),
                    value:
                      total > 0
                        ? `${b.n} (${Math.round((b.n / total) * 100)}%)`
                        : '0',
                  },
                ],
              })
            }
            onPointerLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
          >
            <div
              className="hbar-fill"
              style={{ width: `${(b.n / max) * 100}%`, background: b.color }}
            />
            <span className="hbar-value">{b.n}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Línea de 14 días, 2 series (paleta categórica validada), crosshair +
 * tooltip con ambas series, puntos finales con anillo de superficie. */
function RhythmChart({
  days,
  setTip,
}: {
  days: { day: string; created: number; signed: number }[]
  setTip: (t: Tip | null) => void
}) {
  const { t } = useTranslation()
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 190
  const padL = 34
  const padR = 16
  const padT = 12
  const padB = 26

  const rawMax = Math.max(1, ...days.flatMap((d) => [d.created, d.signed]))
  // techo "limpio": 1-2-5 × 10^k
  const pow = 10 ** Math.floor(Math.log10(rawMax))
  const yMax = [1, 2, 5, 10]
    .map((m) => m * pow)
    .find((v) => v >= rawMax) as number
  const x = (i: number) =>
    padL + (i * (W - padL - padR)) / Math.max(1, days.length - 1)
  const y = (v: number) => padT + (1 - v / yMax) * (H - padT - padB)

  const path = (get: (d: (typeof days)[number]) => number) =>
    days.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(get(d))}`).join(' ')

  const fmtDay = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
    })

  const showTip = (i: number, cx: number, cy: number) => {
    setHover(i)
    setTip({
      x: cx,
      y: cy,
      title: fmtDay(days[i].day),
      rows: [
        {
          color: 'var(--viz-1)',
          label: t('app:dash.rhythmCases'),
          value: String(days[i].created),
        },
        {
          color: 'var(--viz-2)',
          label: t('app:dash.rhythmAssessments'),
          value: String(days[i].signed),
        },
      ],
    })
  }

  const last = days.length - 1
  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="rhythm"
        role="img"
        aria-label={t('app:dash.rhythmTitle')}
        tabIndex={0}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - rect.left) / rect.width) * W
          const i = Math.round(
            ((px - padL) / (W - padL - padR)) * (days.length - 1),
          )
          if (i >= 0 && i < days.length) showTip(i, e.clientX, e.clientY)
        }}
        onPointerLeave={() => {
          setHover(null)
          setTip(null)
        }}
        onFocus={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          showTip(last, r.right - 80, r.top + 40)
        }}
        onBlur={() => {
          setHover(null)
          setTip(null)
        }}
      >
        {[0, yMax / 2, yMax].map((v) => (
          <g key={v}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(v)}
              y2={y(v)}
              className="rhythm-grid"
            />
            <text x={padL - 6} y={y(v) + 4} className="rhythm-tick" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {days.map(
          (d, i) =>
            i % 3 === 0 && (
              <text
                key={d.day}
                x={x(i)}
                y={H - 8}
                className="rhythm-tick"
                textAnchor="middle"
              >
                {fmtDay(d.day)}
              </text>
            ),
        )}
        {hover != null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={padT}
            y2={H - padB}
            className="rhythm-crosshair"
          />
        )}
        <path d={path((d) => d.created)} className="rhythm-line s1" />
        <path d={path((d) => d.signed)} className="rhythm-line s2" />
        <circle cx={x(last)} cy={y(days[last].created)} r={4.5} className="rhythm-dot s1" />
        <circle cx={x(last)} cy={y(days[last].signed)} r={4.5} className="rhythm-dot s2" />
      </svg>
      <div className="viz-legend">
        <span>
          <i className="viz-key line" style={{ background: 'var(--viz-1)' }} />
          {t('app:dash.rhythmCases')}
        </span>
        <span>
          <i className="viz-key line" style={{ background: 'var(--viz-2)' }} />
          {t('app:dash.rhythmAssessments')}
        </span>
      </div>
    </>
  )
}

function TableView({
  caption,
  head,
  rows,
}: {
  caption: string
  head: string[]
  rows: string[][]
}) {
  const { t } = useTranslation()
  return (
    <details className="viz-table">
      <summary>{t('app:dash.table')}</summary>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
