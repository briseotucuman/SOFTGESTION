import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { generarAsientos } from '../contabilidadUtils.js'
import { Lock, Unlock } from 'lucide-react'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function ultimos(n) {
  const h = new Date(), out = []
  for (let i = 0; i < n; i++) {
    const d = new Date(h.getFullYear(), h.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
function rango(p) {
  const [a, m] = p.split('-').map(Number)
  const fin = new Date(a, m, 0).getDate()
  return { desde: `${p}-01`, hasta: `${p}-${String(fin).padStart(2, '0')}` }
}

export default function CierrePeriodos({ usuario }) {
  const [filas, setFilas] = useState({})
  const [falta, setFalta] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('periodos_cerrados').select('*')
    if (error) { setFalta(true); return }
    setFalta(false)
    setFilas(Object.fromEntries((data || []).map(r => [r.periodo, r])))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const cerrar = async (p) => {
    const motivo = window.prompt(`Cerrar ${p}. Se contabilizan los asientos pendientes del mes y después ya no se podrá modificar. Nota (opcional):`, '')
    if (motivo === null) return
    setBusy(p); setMsg(null)
    try {
      const { desde, hasta } = rango(p)
      await generarAsientos({ desde, hasta, usuario: usuario?.email || null })
      const { error } = await supabase.rpc('cerrar_periodo', { p_periodo: p, p_motivo: motivo || null })
      if (error) throw error
      setMsg({ ok: true, t: `Período ${p} cerrado.` })
    } catch (e) { setMsg({ ok: false, t: e.message || String(e) }) }
    setBusy(''); cargar()
  }
  const reabrir = async (p) => {
    const motivo = window.prompt(`Reabrir ${p}. Indicá el motivo (queda registrado):`, '')
    if (motivo === null) return
    if (!motivo.trim()) { setMsg({ ok: false, t: 'Para reabrir hay que indicar un motivo.' }); return }
    setBusy(p); setMsg(null)
    const { error } = await supabase.rpc('reabrir_periodo', { p_periodo: p, p_motivo: motivo })
    setMsg(error ? { ok: false, t: error.message } : { ok: true, t: `Período ${p} reabierto. Recordá volver a cerrarlo al terminar.` })
    setBusy(''); cargar()
  }

  if (falta) return <div style={{ ...s.card, padding: 16 }}>Falta activar el cierre de períodos: ejecutá el script <b>cierre_periodos_softgestion.sql</b> en Supabase (SQL Editor).</div>

  const lista = [...new Set([...ultimos(18), ...Object.keys(filas)])].sort().reverse()
  return (
    <div>
      <div style={{ ...s.card, padding: 14, marginBottom: 12, fontSize: 13, color: paleta.muted }}>
        Un mes cerrado no admite altas, cambios ni bajas de facturas, compras, cobros, pagos, movimientos, sueldos ni asientos. Cobrar o pagar un comprobante viejo con fecha de un mes abierto sigue funcionando. Solo un administrador puede cerrar y reabrir.
      </div>
      {msg && <div style={{ ...s.card, padding: 12, marginBottom: 12, color: msg.ok ? paleta.success : paleta.danger, background: msg.ok ? paleta.successSoft : paleta.dangerSoft }}>{msg.t}</div>}
      <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['Período', 'Estado', 'Detalle', ''].map(h => <th key={h} style={s.tablaCabecera()}>{h}</th>)}</tr></thead>
          <tbody>
            {lista.map(p => {
              const f = filas[p], cerrado = f && !f.reabierto_en
              const [a, m] = p.split('-')
              return (
                <tr key={p} style={{ borderTop: `1px solid ${paleta.line}` }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{MESES[+m - 1]} {a}</td>
                  <td style={{ padding: '8px 12px', color: cerrado ? paleta.success : paleta.muted }}>{cerrado ? '🔒 Cerrado' : 'Abierto'}</td>
                  <td style={{ padding: '8px 12px', color: paleta.muted }}>
                    {cerrado ? `${f.cerrado_por || ''} · ${new Date(f.cerrado_en).toLocaleDateString('es-AR')}${f.motivo ? ' · ' + f.motivo : ''}`
                      : f?.reabierto_en ? `Reabierto por ${f.reabierto_por || ''} el ${new Date(f.reabierto_en).toLocaleDateString('es-AR')}${f.motivo ? ' · ' + f.motivo : ''}` : ''}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    {cerrado
                      ? <button style={s.btnSecundario} disabled={!!busy} onClick={() => reabrir(p)}><Unlock size={13} /> Reabrir</button>
                      : <button style={s.btnPrimario('#1e40af')} disabled={!!busy} onClick={() => cerrar(p)}><Lock size={13} /> {busy === p ? 'Cerrando…' : 'Cerrar'}</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
