import { createClient } from '@supabase/supabase-js'
import { fetch, Headers, Request, Response } from 'undici'
import { environment } from '../config/environment.js'

if (!globalThis.fetch) {
  globalThis.fetch = fetch
}
if (!globalThis.Headers) {
  globalThis.Headers = Headers
}
if (!globalThis.Request) {
  globalThis.Request = Request
}
if (!globalThis.Response) {
  globalThis.Response = Response
}

export const supabaseServiceClient = createClient(environment.supabaseUrl, environment.supabaseServiceKey, {
  auth: { persistSession: false },
})
