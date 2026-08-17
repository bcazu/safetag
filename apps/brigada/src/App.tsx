import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '@safetag/i18n'
import './App.css'

function App() {
  const { t, i18n } = useTranslation()

  return (
    <main>
      <header>
        <h1>
          {t('app.name')} — {t('app:title')}
        </h1>
        <p>{t('app:tagline')}</p>
        {SUPPORTED_LANGUAGES.length > 1 && (
          <label>
            {t('common.language')}{' '}
            <select
              value={i18n.resolvedLanguage}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
            >
              {SUPPORTED_LANGUAGES.map((lng) => (
                <option key={lng} value={lng}>
                  {lng}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
    </main>
  )
}

export default App
