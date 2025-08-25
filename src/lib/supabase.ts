import { createClient } from '@supabase/supabase-js'

const url = (process.env.REACT_APP_SUPABASE_URL || '').trim()
const key = (process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim()

if (!url || !key) {
  // Не печатаем ключ, только факт
  console.error('[Supabase] ENV отсутствуют: REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY')
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co/.test(url)) {
  console.warn('[Supabase] URL выглядит подозрительно:', url)
}

export const supabase = createClient(url, key, { auth: { persistSession: false } })

// Вспомогательный ping, можно вызвать из компонентов при отладке
export async function supabasePing() {
  try {
    const { error } = await supabase.from('tsd').select('id').limit(1)
    if (error) throw error
    console.info('[Supabase] ping OK')
    return true
  } catch (e) {
    console.error('[Supabase] ping ERROR:', e)
    return false
  }
}
