import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import { supabase } from './lib/supabase'
import type { ReviewerRow } from './lib/types'
import Login from './pages/Login'
import RegisterReviewer from './pages/RegisterReviewer'
import Queue from './pages/Queue'
import CaseDetail from './pages/CaseDetail'
import MapPage from './pages/MapPage'
import './App.css'

function App() {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  // undefined = cargando; null = sin perfil de revisor todavía
  const [reviewer, setReviewer] = useState<ReviewerRow | null | undefined>()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setReviewer(undefined)
      return
    }
    supabase
      .from('reviewers')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setReviewer((data as ReviewerRow | null) ?? null))
  }, [session])

  if (!sessionReady) return null
  if (!session) return <Login />
  if (reviewer === undefined) {
    return <main className="page">{t('common.loading')}</main>
  }
  if (reviewer === null) {
    return (
      <RegisterReviewer userId={session.user.id} onRegistered={setReviewer} />
    )
  }

  return (
    <BrowserRouter>
      <header className="topbar">
        <h1>
          {t('app.name')} — {t('app:title')}
        </h1>
        <nav className="topbar-nav">
          <NavLink to="/">{t('app:queue.title')}</NavLink>
          <NavLink to="/mapa">{t('app:map.title')}</NavLink>
        </nav>
        <div className="topbar-user">
          <span>
            {reviewer.name} ·{' '}
            {t(`reviewerSpecialty.${reviewer.specialty ?? 'general'}`)}
            {reviewer.license_status !== 'active' && (
              <em> · {t('app:register.pendingTitle')}</em>
            )}
          </span>
          <button type="button" onClick={() => supabase.auth.signOut()}>
            {t('app:auth.signOut')}
          </button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Queue />} />
        <Route path="/mapa" element={<MapPage />} />
        <Route path="/caso/:id" element={<CaseDetail reviewer={reviewer} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
