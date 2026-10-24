import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s } from '../estilos.js'
import { Mail, MessageCircle, Copy } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const iso = d => d.toLocaleDateString('en-CA')
const fmt = f => String(f).split('-').reverse().join('/')
const sumar = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const guardado = (k, def = '') => { try { return localStorage.getItem(k) || def } catch { return def } }
const guardar = (k, v) => { try { localStorage.setItem(k, v) } catch { /* sin storage */ } }

// Resumen semanal: movimientos de los últimos 7 días + lo que viene (cobros, pagos y cheques de los próximos 7 días)
export default function ResumenSemanal() {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [d, setD] = useState({})
  const [email, setEmail] = useState(guardado('sg_resumen_email', 'briseotucuman@gmail.com'))
  const [tel, setTel] = useState(guardado('sg_resumen_tel'))
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([
      supabase.from('movimientos_financieros').select('fecha, tipo, monto').gte('fecha', iso(sumar(new Date(), -6))),
      supabase.from('facturas').select('id, numero_factura, total, fecha_vencimiento, estado, clientes(razon_social, nombre_contacto)').in('estado', ['emitida', 'pendiente', 'parcial', 'vencida']),
      supabase.from('pagos').select('factura_id, monto'),
      supabase.from('facturas_compra').select('id, numero_factura, total, fecha_vencimiento, estado, proveedores(razon_social)').neq('estado', 'pagada').neq('estado', 'anulada'),
      supabase.from('pagos_compra').select('factura_compra_id, monto'),
      supabase.from('cheques').select('numero, banco, importe, fecha_pago, tipo, estado, clientes(razon_social, nombre_contacto), proveedores(razon_social)').in('estado', ['cartera', 'emitido']).order('fecha_pago')
    ]).then(res => {
      if (!vivo) return
      const err = res.find(r => r.error); if (err) setError(err.error.message)
      const [mv, fa, pg, fc, pc, ch] = res.map(r => r.data || [])
      setD({ mv, fa, pg, fc, pc, ch }); setCargando(false)
    })
    return () => { vivo = false }
  }, [])

  const texto = useMemo(() => {
    if (!d.mv) return ''
    const hoy = iso(new Date()), en7 = iso(sumar(new Date(), 7))
    const ingresos = d.mv.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0)
    const egresos = d.mv.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0)
    const cobrado = {}; d.pg.forEach(p => { cobrado[p.factura_id] = (cobrado[p.factura_id] || 0) + Number(p.monto) })
    const pagadoC = {}; d.pc.forEach(p => { pagadoC[p.factura_compra_id] = (pagadoC[p.factura_compra_id] || 0) + Number(p.monto) })
    const porCobrar = d.fa.map(f => ({ ...f, saldo: Number(f.total) - (cobrado[f.id] || 0) })).filter(f => f.saldo > 0.5)
    const porPagar = d.fc.map(f => ({ ...f, saldo: Number(f.total) - (pagadoC[f.id] || 0) })).filter(f => f.saldo > 0.5)
    const venc = arr => arr.filter(f => f.fecha_vencimiento && f.fecha_vencimiento < hoy)
    const prox = arr => arr.filter(f => f.fecha_vencimiento && f.fecha_vencimiento >= hoy && f.fecha_vencimiento <= en7)
    const tot = arr => arr.reduce((a, f) => a + f.saldo, 0)
    const chSemana = d.ch.filter(c => c.fecha_pago <= en7)
    const L = []
    L.push(`RESUMEN SEMANAL — BRISEO`, `Al ${fmt(hoy)}`, '')
    L.push(`ÚLTIMOS 7 DÍAS`, `Ingresos: ${ars(ingresos)}`, `Egresos: ${ars(egresos)}`, `Neto: ${ars(ingresos - egresos)}`, '')
    L.push(`CUENTAS POR COBRAR: ${ars(tot(porCobrar))} (${porCobrar.length} facturas)`)
    L.push(`  Vencidas: ${ars(tot(venc(porCobrar)))} (${venc(porCobrar).length})`)
    L.push(`  Vencen esta semana: ${ars(tot(prox(porCobrar)))} (${prox(porCobrar).length})`)
    prox(porCobrar).slice(0, 5).forEach(f => L.push(`   - ${f.numero_factura || 's/n'} ${f.clientes?.razon_social || f.clientes?.nombre_contacto || ''} ${ars(f.saldo)} (${fmt(f.fecha_vencimiento)})`))
    L.push('', `CUENTAS POR PAGAR: ${ars(tot(porPagar))} (${porPagar.length} facturas)`)
    L.push(`  Vencidas: ${ars(tot(venc(porPagar)))} (${venc(porPagar).length})`)
    L.push(`  Vencen esta semana: ${ars(tot(prox(porPagar)))} (${prox(porPagar).length})`)
    prox(porPagar).slice(0, 5).forEach(f => L.push(`   - ${f.numero_factura || 's/n'} ${f.proveedores?.razon_social || ''} ${ars(f.saldo)} (${fmt(f.fecha_vencimiento)})`))
    L.push('', `CHEQUES QUE VENCEN ESTA SEMANA (o vencidos): ${chSemana.length}`)
    if (!chSemana.length) L.push('  Ninguno')
    chSemana.forEach(c => L.push(`  - ${c.tipo === 'tercero' ? 'DEPOSITAR' : 'TENER FONDOS'} N° ${c.numero} ${c.banco || ''} ${ars(c.importe)} — ${fmt(c.fecha_pago)}${c.fecha_pago < hoy ? ' (VENCIDO)' : ''} ${c.tipo === 'tercero' ? (c.clientes?.razon_social || c.clientes?.nombre_contacto || '') : (c.proveedores?.razon_social || '')}`))
    return L.join('\n')
  }, [d])

  if (cargando) return <p style={{ color: '#64748b', padding: 16 }}>Cargando…</p>
  const enviarMail = () => { guardar('sg_resumen_email', email); window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Resumen semanal BRISEO')}&body=${encodeURIComponent(texto)}` }
  const enviarWsp = () => { guardar('sg_resumen_tel', tel); window.open(`https://wa.me/${tel.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank') }
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* sin portapapeles */ } }

  return (
    <div>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 8, marginBottom: 10 }}>No se pudo cargar parte de los datos: {error}</div>}
      <pre style={{ ...s.card, padding: 16, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.55 }}>{texto}</pre>
      <div style={{ ...s.grid2, marginTop: 12 }}>
        <div><label style={s.label}>Enviar a (mail)</label><input style={s.input} value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label style={s.label}>WhatsApp (con código de país, ej. 5493814123456)</label><input style={s.input} value={tel} onChange={e => setTel(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button style={s.btnPrimario('#1e40af')} onClick={enviarMail} disabled={!email}><Mail size={14} style={{ verticalAlign: '-2px' }} /> Enviar por mail</button>
        <button style={s.btnPrimario('#16a34a')} onClick={enviarWsp} disabled={!tel.replace(/\D/g, '')}><MessageCircle size={14} style={{ verticalAlign: '-2px' }} /> Enviar por WhatsApp</button>
        <button style={s.btnSecundario} onClick={copiar}><Copy size={14} style={{ verticalAlign: '-2px' }} /> {copiado ? '¡Copiado!' : 'Copiar'}</button>
      </div>
    </div>
  )
}
