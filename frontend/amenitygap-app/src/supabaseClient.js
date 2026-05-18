import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export async function fetchAll(table, columns = '*', filters = {}) {
  const limit = 1000
  let offset = 0
  let all = []
  while (true) {
    let q = supabase.from(table).select(columns).range(offset, offset + limit - 1)
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v)
    const { data, error } = await q
    if (error) throw error
    if (!data || !data.length) break
    all = all.concat(data)
    if (data.length < limit) break
    offset += limit
  }
  return all
}
