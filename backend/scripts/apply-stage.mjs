import { supabaseServiceClient } from '../src/lib/supabaseClient.js'

const printUsage = () => {
  console.log(
    'Usage: node scripts/apply-stage.mjs --stage=\"Stage Name\" [--summary=\"Stage summary\"] <gcdIssueId> [<gcdIssueId> ...]'
  )
}

const rawArgs = process.argv.slice(2)
let stageName = null
let stageSummary = ''
const gcdIssueIds = []

for (let index = 0; index < rawArgs.length; index += 1) {
  const token = rawArgs[index]
  if (token === '--stage') {
    stageName = rawArgs[index + 1] ?? null
    index += 1
  } else if (token.startsWith('--stage=')) {
    stageName = token.slice('--stage='.length)
  } else if (token === '--summary') {
    stageSummary = rawArgs[index + 1] ?? ''
    index += 1
  } else if (token.startsWith('--summary=')) {
    stageSummary = token.slice('--summary='.length)
  } else if (token === '--help' || token === '-h') {
    printUsage()
    process.exit(0)
  } else if (token.includes(',')) {
    token
      .split(',')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .forEach((chunk) => gcdIssueIds.push(chunk))
  } else if (token.trim()) {
    gcdIssueIds.push(token)
  }
}

if (!stageName || !gcdIssueIds.length) {
  printUsage()
  process.exit(1)
}

const normalizedIds = Array.from(
  new Set(
    gcdIssueIds
      .map((value) => value?.toString().trim())
      .filter((value) => Boolean(value))
  )
)

if (!normalizedIds.length) {
  console.error('No valid gcdIssueIds were provided.')
  process.exit(1)
}

const { data: rows, error: fetchError } = await supabaseServiceClient
  .from('hero_timelines')
  .select('id, metadata')
  .in('metadata->>gcdIssueId', normalizedIds)

if (fetchError) {
  console.error('Failed to load hero timeline rows:', fetchError.message)
  process.exit(1)
}

if (!rows?.length) {
  console.warn('No hero timeline rows matched the provided gcdIssueIds.')
  process.exit(0)
}

const summaryText = stageSummary?.trim() || null

for (const row of rows) {
  const metadata = row.metadata ?? {}
  const updated = {
    ...metadata,
    stageName,
    stage_name: stageName,
  }
  if (summaryText) {
    updated.stageSummary = summaryText
    updated.stage_summary = summaryText
  }

  const { error: updateError } = await supabaseServiceClient
    .from('hero_timelines')
    .update({ metadata: updated })
    .eq('id', row.id)

  if (updateError) {
    console.error(`Failed to update timeline row ${row.id}:`, updateError.message)
    process.exit(1)
  }
  console.log(`Updated timeline row ${row.id} with stage "${stageName}".`)
}

console.log(`Stage "${stageName}" applied to ${rows.length} issues.`)
