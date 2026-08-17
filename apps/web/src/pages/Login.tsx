import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error, data } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) {
      setMessage(error.message)
    } else if (mode === 'signUp' && !data.session) {
      setMessage(t('app:auth.checkEmail'))
    }
  }

  return (
    <main className="page narrow">
      <h1>
        {t('app.name')} — {t('app:title')}
      </h1>
      <form onSubmit={submit} className="stack">
        <label>
          {t('app:auth.email')}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          {t('app:auth.password')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <button type="submit" disabled={busy}>
          {t(mode === 'signIn' ? 'app:auth.signIn' : 'app:auth.signUp')}
        </button>
      </form>
      <button
        type="button"
        className="linklike"
        onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
      >
        {t(mode === 'signIn' ? 'app:auth.toSignUp' : 'app:auth.toSignIn')}
      </button>
      {message && <p className="notice">{message}</p>}
    </main>
  )
}
