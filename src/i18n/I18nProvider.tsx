import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  getDateLocale,
  normalizeLanguage,
  translate,
  type AppLanguage,
  type TranslationParams,
} from '../../shared/i18n'

interface I18nContextValue {
  language: AppLanguage
  locale: string
  setLanguage: (language: AppLanguage) => Promise<void>
  t: (source: string, params?: TranslationParams) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export const I18nProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>('zh-CN')

  useEffect(() => {
    let disposed = false
    window.electronAPI.config.getLanguage()
      .then((storedLanguage) => {
        if (!disposed) setLanguageState(normalizeLanguage(storedLanguage))
      })
      .catch((error) => console.error('Failed to load language:', error))

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage)
    await window.electronAPI.config.setLanguage(nextLanguage)
  }, [])

  const value = useMemo<I18nContextValue>(() => ({
    language,
    locale: getDateLocale(language),
    setLanguage,
    t: (source, params) => translate(language, source, params),
  }), [language, setLanguage])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}
