// Keeps timeline-owned metadata separate from canonical issue data.
const HERO_ISSUE_METADATA_KEYS = new Set([
  'apiUrl',
  'api_url',
  'cover',
  'coverImagePath',
  'cover_image_path',
  'cover_original',
  'issueLabel',
  'issue_label',
  'keyDate',
  'key_date',
  'number',
  'onSaleDate',
  'on_sale_date',
  'pageCount',
  'page_count',
  'price',
  'publicationDate',
  'publication_date',
  'seriesName',
  'seriesNameRaw',
  'series_name',
  'series_name_raw',
  'title',
  'volume',
])

/**
 * Linked timeline rows only persist timeline-specific metadata. The GCD id is
 * intentionally retained during the gradual migration for legacy scripts.
 */
export const compactLinkedTimelineMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return metadata ?? null
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !HERO_ISSUE_METADATA_KEYS.has(key))
  )
}
