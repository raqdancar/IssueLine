import { supabaseServiceClient } from './src/services/supabaseClient.js'

const folders = await supabaseServiceClient.storage
  .from('issue-images')
  .list('covers', { limit: 200, sortBy: { column: 'name', order: 'asc' } })

if (folders.error) {
  console.error('error listing folders', folders.error)
  process.exit(1)
}

for (const entry of folders.data ?? []) {
  console.log('folder', entry.name)
  const files = await supabaseServiceClient.storage
    .from('issue-images')
    .list(`covers/${entry.name}`, { limit: 10, sortBy: { column: 'name', order: 'asc' } })
  if (files.error) {
    console.error('error listing files for', entry.name, files.error)
    continue
  }
  console.log(' sample files:', files.data?.slice(0, 3).map((file) => file.name))
}
