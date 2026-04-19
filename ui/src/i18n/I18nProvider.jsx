import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  translations,
} from './locales'

const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
})

const getInitialLocale = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored && SUPPORTED_LOCALES.includes(stored)) {
    return stored
  }

  const browserLanguage = window.navigator.language?.toLowerCase() ?? ''
  if (browserLanguage.startsWith('ca')) {
    return 'ca'
  }

  return DEFAULT_LOCALE
}

const resolveTranslation = (locale, key) => {
  const dictionary = translations[locale] ?? translations[DEFAULT_LOCALE]
  return key.split('.').reduce((current, token) => {
    if (current && typeof current === 'object' && token in current) {
      return current[token]
    }
    return undefined
  }, dictionary)
}

const interpolate = (template, params = {}) =>
  template.replace(/\{\{(\w+)\}\}/g, (_match, token) => {
    const value = params[token]
    return value === undefined || value === null ? '' : String(value)
  })

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale)

  const setLocale = useCallback((nextLocale) => {
    if (!SUPPORTED_LOCALES.includes(nextLocale)) return
    setLocaleState(nextLocale)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale)
    }
  }, [])

  const t = useCallback(
    (key, params) => {
      const value = resolveTranslation(locale, key) ?? resolveTranslation(DEFAULT_LOCALE, key)
      if (typeof value !== 'string') return key
      return interpolate(value, params)
    },
    [locale],
  )

  const contextValue = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)

