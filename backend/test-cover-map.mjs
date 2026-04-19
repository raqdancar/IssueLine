import { supabaseServiceClient } from './src/lib/supabaseClient.js'

const listBucketObjects = async (bucket, prefix = '') => {
  const storage = supabaseServiceClient.storage.from(bucket)
  const traverse = async (folder = '') => {
    const limit = 100
    let offset = 0
    const entries = []
    while (true) {
      const { data, error } = await storage.list(folder, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) {
        throw new Error(`list failed ${folder}: ${error.message}`)
      }
      if (!data?.length) break
      for (const entry of data) {
        const entryPath = folder ? `${folder}/${entry.name}` : entry.name
        const isFile = entry.metadata && typeof entry.metadata.size === 'number'
        if (isFile) {
          entries.push(entryPath)
        } else {
          const nested = await traverse(entryPath)
          entries.push(...nested)
        }
      }
      if (data.length < limit) break
      offset += data.length
    }
    return entries
  }
  return traverse(prefix)
}

const sanitizeSegment = (value) => value?.replace(/^\/+|\/+$/g, '') ?? ''

const buildCoverIndex = (paths) => {
  const index = new Map()
  for (const fullPath of paths) {
    const segments = fullPath.split('/').filter(Boolean)
    if (segments.length < 2) continue
    const seriesFolder = segments.at(-2)
    const filename = segments.at(-1)
    const key = filename.replace(/\.[^.]+$/, '')
    if (!index.has(seriesFolder)) {
      index.set(seriesFolder, new Set())
    }
    index.get(seriesFolder).add(key)
  }
  return index
}

const main = async () => {
  const paths = await listBucketObjects('issue-images', sanitizeSegment('covers'))
  console.log('paths count', paths.length)
  const index = buildCoverIndex(paths)
  console.log('keys', Array.from(index.keys()))
}

await main()
