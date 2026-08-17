import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import type { ReviewerRow } from '../lib/types'

const SPECIALTIES = ['structural', 'geotechnical', 'general'] as const

export default function RegisterReviewer({
  userId,
  onRegistered,
}: {
  userId: string
  onRegistered: (r: ReviewerRow) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [license, setLicense] = useState('')
  const [branch, setBranch] = useState('')
  const [specialty, setSpecialty] =
    useState<(typeof SPECIALTIES)[number]>('general')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('reviewers')
      .insert({
        user_id: userId,
        name,
        professional_license: license,
        license_branch: branch || null,
        specialty,
      })
      .select('*')
      .single()
    setBusy(false)
    if (err) {
      setError(err.message)
    } else {
      onRegistered(data as ReviewerRow)
    }
  }

  return (
    <main className="page narrow">
      <h1>{t('app:register.title')}</h1>
      <p className="notice">{t('app:register.intro')}</p>
      <form onSubmit={submit} className="stack">
        <label>
          {t('app:register.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          {t('app:register.license')}
          <input
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            required
          />
        </label>
        <label>
          {t('app:register.branch')}
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder={t('app:register.branchHint')}
          />
        </label>
        <label>
          {t('app:register.specialty')}
          <select
            value={specialty}
            onChange={(e) =>
              setSpecialty(e.target.value as (typeof SPECIALTIES)[number])
            }
          >
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>
                {t(`reviewerSpecialty.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy}>
          {t('app:register.submit')}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </main>
  )
}
