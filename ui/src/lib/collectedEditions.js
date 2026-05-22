const KNOWN_FORMAT_LABELS = {
  deluxe: 'Deluxe',
  epic_collection: 'Epic Collection',
  graphic_novel: 'Graphic Novel',
  hardcover: 'Hardcover',
  marvel_gold: 'Marvel Gold',
  omnibus: 'Omnibus',
  softcover: 'Softcover',
  tpb: 'TPB',
  trade_paperback: 'Trade Paperback',
  unknown: 'Unknown',
}

const normalizeFormatKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

export const formatCollectedEditionFormat = (value, fallback = 'Unknown') => {
  const key = normalizeFormatKey(value)
  if (!key) return fallback
  if (KNOWN_FORMAT_LABELS[key]) return KNOWN_FORMAT_LABELS[key]

  return key
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}
