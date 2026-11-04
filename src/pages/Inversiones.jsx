import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { Plus, Trash2 } from 'lucide-react'

export const CLASES = { fci: 'Fondos comunes de inversión', acciones: 'Acciones', letras: 'Letras y bonos', cedears: 'CEDEARs' }
const OPS = { compra: 'Compra', venta: 'Venta', rendimiento: 'Rendimiento cobrado', valuacion: 'Valuación de mercado' }
const hoy = new Date().toISOString().split('T')[0]
const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
const fmt = f => String(f).split('-').reverse().join('/')
const vacio = { fecha: hoy, clase: 'fci', instrumento: '', operacion: 'compra', cantidad: '', precio: '', importe: '', cuenta_id: '', observaciones: '' }

// Calcula tenencias a costo promedio y resultado de ventas, por instrumento
export function calcularTenencias(ops) {
  const m = {}
  ;[...ops].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado_en.localeCompare(b.creado_en)).forEach(o => {
    const k = `${o.clase}|${o.instrumento}`
    const t = (m[k] ||= { clase: o.clase, instrumento: o.instrumento, cantidad: 0, costo: 0, resultado: 0, rendimientos: 0, valuacion: null })
    const imp = Number(o.importe), cant = Number(o.cantidad) || 0
    if (o.operacion === 'compra') { t.cantidad += cant; t.costo += imp }
    else if (o.operacion === 'venta') {
      const porc = t.cantidad > 0 && cant > 0 ? Math.min(cant / t.cantidad, 1) : 1
      const costoVendido = t.costo * porc
      o.costo_vendido = costoVendido; o.resultado_venta = imp - costoVendido
      t.resultado += imp - costoVendido; t.costo -= costoVendido; t.cantidad -= cant
    } else if (o.operacion === 'rendimiento') t.rendimientos += imp
    else if (o.operacion === 'valuacion') t.valuacion = imp
  })
  return Object.values(m)
}

export default function Inversiones() {
  const [ops, setOps] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [form, setForm] = useState(vacio)
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const [o, c] = await Promise.all([
      supabase.from('inversiones_operaciones').select('*').order('fecha', { ascending: false }),
      supabase.from('cuentas_bancarias').select('id, banco, tipo').eq('activa', true)
    ])
    if (o.error) setError('Falta crear la tabla: ejecutá inversiones_softgestion.sql en Supabase (SQL Editor).'); else { setError(''); setOps(o.data || []) }
    setCuentas(c.data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const tenencias = useMemo(() => calcularTenencias(ops.map(o => ({ ...o }))), [ops])
  const vigentes = tenencias.filter(t => t.cantidad > 0.000001 || t.costo > 0.005 || t.valuacion)
  const totCosto = vigentes.reduce((a, t) => a + t.costo, 0)
  const totValor = vigentes.reduce((a, t) => a + (t.valuacion ?? t.costo), 0)
  const resultados = tenencias.reduce((a, t) => a + t.resultado + t.rendimientos, 0)

  const guardar = async () => {
    const imp = Number(form.importe) || (Number(form.cantidad) * Number(form.precio)) || 0
    if (!form.instrumento.trim() || imp <= 0) return setError('Completá el instrumento y el importe.')
    if (form.operacion !== 'valuacion' && !form.cuenta_id) return setError('Elegí la cuenta de donde sale o a donde entra el dinero.')
    const { error: e } = await supabase.from('inversiones_operaciones').insert([{ fecha: form.fecha, clase: form.clase, instrumento: form.instrumento.trim(), operacion: form.operacion, cantidad: form.cantidad || null, precio: form.precio || null, importe: Math.round(imp * 100) / 100, cuenta_id: form.cuenta_id || null, observaciones: form.observaciones || null }])
    if (e) return setError(e.message)
    setForm({ ...vacio, clase: form.clase }); setAbierto(false); setError(''); cargar()
  }
  const borrar = async o => { if (confirm('¿Eliminar esta operación?')) { await supabase.from('inversiones_operaciones').delete().eq('id', o.id); cargar() } }
  const tarj = { ...s.card, padding: 14, flex: '1 1 200px' }
  const nomCta = id => cuentas.find(c => c.id === id)?.banco || ''

  return (
    <div>
      {error && <div style={{ ...s.card, padding: 12, color: paleta.danger, background: paleta.dangerSoft }}>{error}</div>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={tarj}><div style={{ color: paleta.muted, fontSize: 12 }}>Invertido (a costo)</div><div style={{ fontSize: 20, fontWeight: 700 }}>{ars(totCosto)}</div></div>
        <div style={tarj}><div style={{ color: paleta.muted, fontSize: 12 }}>Valor actual estimado</div><div style={{ fontSize: 20, fontWeight: 700 }}>{ars(totValor)}</div></div>
        <div style={tarj}><div style={{ color: paleta.muted, fontSize: 12 }}>Resultado no realizado</div><div style={{ fontSize: 20, fontWeight: 700, color: totValor - totCosto >= 0 ? paleta.success : paleta.danger }}>{ars(totValor - totCosto)}</div></div>
        <div style={tarj}><div style={{ color: paleta.muted, fontSize: 12 }}>Resultado realizado (ventas + rendimientos)</div><div style={{ fontSize: 20, fontWeight: 700, color: resultados >= 0 ? paleta.success : paleta.danger }}>{ars(resultados)}</div></div>
      </div>
      <div style={{ margin: '8px 0 12px' }}><button style={s.btnPrimario()} onClick={() => setAbierto(!abierto)}><Plus size={14} /> Nueva operación</button></div>
      {abierto && (
        <div style={{ ...s.card, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label style={s.label}>Fecha</label><input type="date" style={s.input} value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></div>
          <div><label style={s.label}>Operación</label><select style={s.input} value={form.operacion} onChange={e => setForm({ ...form, operacion: e.target.value })}>{Object.entries(OPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label style={s.label}>Tipo</label><select style={s.input} value={form.clase} onChange={e => setForm({ ...form, clase: e.target.value })}>{Object.entries(CLASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div style={{ flex: 1, minWidth: 160 }}><label style={s.label}>Instrumento</label><input style={s.input} value={form.instrumento} onChange={e => setForm({ ...form, instrumento: e.target.value })} placeholder="Ej: Fima Premium, GGAL, AL30, AAPL" /></div>
          {(form.operacion === 'compra' || form.operacion === 'venta') && <>
            <div><label style={s.label}>Cantidad</label><input type="number" step="any" style={{ ...s.input, width: 110 }} value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} /></div>
            <div><label style={s.label}>Precio</label><input type="number" step="any" style={{ ...s.input, width: 110 }} value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} /></div></>}
          <div><label style={s.label}>Importe total $</label><input type="number" step="0.01" style={{ ...s.input, width: 140 }} value={form.importe} onChange={e => setForm({ ...form, importe: e.target.value })} placeholder={form.cantidad && form.precio ? String(form.cantidad * form.precio) : ''} /></div>
          {form.operacion !== 'valuacion' && <div><label style={s.label}>{form.operacion === 'compra' ? 'Sale de la cuenta' : 'Entra a la cuenta'}</label><select style={s.input} value={form.cuenta_id} onChange={e => setForm({ ...form, cuenta_id: e.target.value })}><option value="">Elegir…</option>{cuentas.map(c => <option key={c.id} value={c.id}>{c.banco}</option>)}</select></div>}
          <button style={s.btnPrimario('#15803D')} onClick={guardar}>Guardar</button>
        </div>
      )}
      <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: 12, fontWeight: 700 }}>Tenencias</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['Tipo', 'Instrumento', 'Cantidad', 'Costo', 'Valor actual', 'Diferencia', 'Resultado realizado'].map(h => <th key={h} style={{ ...s.tablaCabecera(), padding: '8px 10px' }}>{h}</th>)}</tr></thead>
          <tbody>{vigentes.map(t => { const v = t.valuacion ?? t.costo; return (
            <tr key={t.clase + t.instrumento} style={{ borderTop: `1px solid ${paleta.line}` }}>
              <td style={{ padding: '6px 10px' }}>{CLASES[t.clase]}</td><td style={{ padding: '6px 10px', fontWeight: 600 }}>{t.instrumento}</td>
              <td style={{ padding: '6px 10px', fontFamily: paleta.fontMono }}>{Math.round(t.cantidad * 1e4) / 1e4}</td>
              <td style={{ padding: '6px 10px', fontFamily: paleta.fontMono }}>{ars(t.costo)}</td>
              <td style={{ padding: '6px 10px', fontFamily: paleta.fontMono }}>{ars(v)}{t.valuacion == null && <span style={{ color: paleta.muted, fontSize: 11 }}> (a costo)</span>}</td>
              <td style={{ padding: '6px 10px', fontFamily: paleta.fontMono, color: v - t.costo >= 0 ? paleta.success : paleta.danger }}>{ars(v - t.costo)}</td>
              <td style={{ padding: '6px 10px', fontFamily: paleta.fontMono }}>{ars(t.resultado + t.rendimientos)}</td>
            </tr>) })}</tbody>
        </table>
        {vigentes.length === 0 && <div style={{ padding: 14, color: paleta.muted }}>Todavía no hay inversiones cargadas.</div>}
      </div>
      <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: 12, fontWeight: 700 }}>Operaciones</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['Fecha', 'Operación', 'Instrumento', 'Cantidad', 'Importe', 'Cuenta', ''].map(h => <th key={h} style={{ ...s.tablaCabecera(), padding: '8px 10px' }}>{h}</th>)}</tr></thead>
          <tbody>{ops.map(o => (
            <tr key={o.id} style={{ borderTop: `1px solid ${paleta.line}` }}>
              <td style={{ padding: '6px 10px' }}>{fmt(o.fecha)}</td><td style={{ padding: '6px 10px' }}>{OPS[o.operacion]}</td><td style={{ padding: '6px 10px' }}>{o.instrumento}</td>
              <td style={{ padding: '6px 10px' }}>{o.cantidad ?? ''}</td><td style={{ padding: '6px 10px', fontFamily: paleta.fontMono }}>{ars(o.importe)}</td><td style={{ padding: '6px 10px' }}>{nomCta(o.cuenta_id)}</td>
              <td style={{ padding: '6px 10px' }}><button style={s.btnPeligro} onClick={() => borrar(o)}><Trash2 size={12} /></button></td>
            </tr>))}</tbody>
        </table>
      </div>
      <p style={{ color: paleta.muted, fontSize: 12 }}>Las compras, ventas y rendimientos generan sus asientos al tocar "Generar asientos" en Contabilidad. La valuación de mercado es solo informativa (no genera asiento). Las operaciones no modifican el saldo de la cuenta en Finanzas: cargá ese movimiento allí si querés reflejarlo.</p>
    </div>
  )
}
