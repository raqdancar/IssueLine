// Fetch one GCD issue and transform it into a collected-edition draft payload.
import { getIssueById } from '../gcd/issueService.js'
import { parseGcdIssueIdentifier } from '../gcd/importCli/issueIdentifierUtils.js'
import { normalizeGcdCollectedEdition } from './gcdCollectedEditionMapper.js'

export const normalizeGcdCollectedEditionIdentifier = (value) => {
  const parsed = parseGcdIssueIdentifier(value)
  if (parsed === null) {
    throw new Error('Invalid GCD identifier. Use numeric issue ID or /issue/<id>/ URL.')
  }
  return parsed
}

export const fetchCollectedEditionFromGcd = async (identifier) => {
  const gcdIssueId = normalizeGcdCollectedEditionIdentifier(identifier)
  const rawIssue = await getIssueById(gcdIssueId)
  if (!rawIssue) {
    return {
      gcdIssueId,
      rawIssue: null,
      normalizedEdition: null,
    }
  }

  // Return both raw and normalized payloads to support preview + persistence flows.
  return {
    gcdIssueId,
    rawIssue,
    normalizedEdition: normalizeGcdCollectedEdition(rawIssue),
  }
}
