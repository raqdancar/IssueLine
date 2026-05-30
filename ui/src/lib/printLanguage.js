// Agrupa funcions compartides per accedir a dades i normalitzar informacio.

const normalizeValue = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const SPANISH_VALUES = new Set(['es', 'es-es', 'esp', 'spanish', 'espanol', 'castellano'])
const ENGLISH_VALUES = new Set(['en', 'en-us', 'en-gb', 'eng', 'english', 'ingles'])

export const resolvePrintLanguageBadge = (value) => {
  const normalized = normalizeValue(value)
  if (!normalized) return null

  if (SPANISH_VALUES.has(normalized) || normalized.startsWith('es-')) {
    return {
      flag: '\u{1F1EA}\u{1F1F8}',
      code: 'ES',
      label: 'Castellano',
    }
  }

  if (ENGLISH_VALUES.has(normalized) || normalized.startsWith('en-')) {
    return {
      flag: '\u{1F1EC}\u{1F1E7}',
      code: 'EN',
      label: 'English',
    }
  }

  return null
}
