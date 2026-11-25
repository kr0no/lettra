import { createInstance, type i18n as I18n } from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Language } from '@shared/types'
import en from './en.json'
import es from './es.json'

export function resolveLanguage(setting: Language): 'en' | 'es' {
  if (setting !== 'system') return setting
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

const i18n: I18n = createInstance()

export async function initI18n(setting: Language): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, es: { translation: es } },
    lng: resolveLanguage(setting),
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes
  })
}

export { i18n }
