import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Canal de eventos en vivo en memoria para sincronización automática instantánea entre módulos
export function emitirCambioDatos(origen = 'general') {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:data-changed', {
        detail: { origen, timestamp: Date.now() }
      }))
    }
  } catch (e) {
    console.warn('Error emitiendo evento de datos:', e)
  }
}

export function escucharCambiosDatos(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = (e) => {
    try {
      callback(e?.detail || {})
    } catch (err) {
      console.warn('Error en listener de cambio de datos:', err)
    }
  }
  window.addEventListener('app:data-changed', handler)
  return () => window.removeEventListener('app:data-changed', handler)
}
