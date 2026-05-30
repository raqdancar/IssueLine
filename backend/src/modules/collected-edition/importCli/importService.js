// Dona suport al flux CLI d'importacio d'edicions recopilatories.
import { fetchCollectedEditionFromGcd } from '../gcdCollectedEditionService.js'
import { findCollectedEditionDuplicate, insertCollectedEdition } from '../repository.js'

export const formatEditionPreview = (edition) => ({
  title: edition.title ?? '(missing)',
  subtitle: edition.subtitle ?? null,
  seriesTitle: edition.seriesTitle ?? null,
  publisher: edition.publisher ?? null,
  publicationDate: edition.publicationDate ?? null,
  coverDate: edition.coverDate ?? null,
  pageCount: edition.pageCount ?? null,
  format: edition.format ?? 'unknown',
  isbn: edition.isbn ?? null,
  gcdIssueId: edition.gcdIssueId ?? null,
  gcdIssueApiUrl: edition.gcdIssueApiUrl ?? null,
  sourceSeriesId: edition.sourceSeriesId ?? null,
  sourceExternalId: edition.sourceExternalId ?? null,
  coverImageUrl: edition.coverImageUrl ?? null,
})

export const prepareCollectedEditionImportByGcdIdentifier = async ({ gcdIdentifier }) => {
  const lookup = await fetchCollectedEditionFromGcd(gcdIdentifier)
  if (!lookup.normalizedEdition) {
    return {
      status: 'not_found',
      gcdIssueId: lookup.gcdIssueId,
      edition: null,
      duplicate: null,
    }
  }

  const edition = lookup.normalizedEdition
  // Check duplicates before any write so CLI can show a safe preview first.
  const duplicate = await findCollectedEditionDuplicate({
    sourceExternalId: edition.sourceExternalId,
    isbn: edition.isbn,
  })

  return {
    status: duplicate ? 'duplicate' : 'ready',
    gcdIssueId: lookup.gcdIssueId,
    edition,
    duplicate,
  }
}

export const persistCollectedEditionImport = async ({ hero, edition }) => {
  if (!hero?.api_id) {
    throw new Error('Hero selection is required.')
  }
  if (!edition) {
    throw new Error('Collected edition payload is required.')
  }

  const inserted = await insertCollectedEdition({
    heroApiId: hero.api_id,
    edition,
  })

  return {
    inserted,
    hero,
    edition,
  }
}
