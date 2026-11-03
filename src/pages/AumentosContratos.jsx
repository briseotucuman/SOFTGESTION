import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { calcularDesgloseFactura } from '../finanzasUtils.js'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const hoy = new Date().toISOString().split('T')[0]
const fmt = f => (f ? String(f).split('-').reverse().join('/') : '—')
const valorDe = c => Number(c.tipo_facturacion === 'por_hora' ? c.valor_hora : c.precio_acordado) || 0
const nombreCli = c => c.clientes?.razon_social || c.clientes?.nombre_contacto || '—'

// Aumentos por contrato (con historial) y facturación mensual de los contratos de precio fijo
export default function AumentosContratos() {
  const [mes, setMes] = useState(hoy.slice(0, 7))
  const [contratos, setContratos] = useState([])
  const [ajustes, setAjustes] = useState([])
  const [facturados, setFacturados] = useState(new Set())
  const [sel, setSel] = useState(new Set())
  const [pct, setPct] = useState('')
  const [vigencia, setVigencia] = useState(hoy)
  const [motivo, setMotivo] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const cargar = useCallback(async () => {
    setError('')
    const [c, a, f] = await Promise.all([
      supabase.from('contratos').select('id, numero_contrato, cliente_id, tipo_facturacion, precio_acordado, valor_hora, fecha_fin, clientes(razon_social, nombre_contacto)').eq('estado', 'activo'),
      supabase.from('contrato_ajustes').select('*').order('fecha_vigencia', { ascending: false }),
      supabase.from('facturas').select('contrato_id').neq('estado', 'anulada').gte('fecha_emision', `${mes}-01`).lte('fecha_emision', `${mes}-31`)
    ])
    if (c.error) return setError(c.error.message)
    setContratos((c.data || []).sort((x, y) => nombreCli(x).localeCompare(nombreCli(y))))
    if (a.error) setError('Falta crear las tablas nuevas: ejecutá mejoras_softgestion.sql en Supabase (SQL Editor).')
    else setAjustes(a.data || [])
    setFacturados(new Set((f.data || []).map(x => x.contrato_id)))
  }, [mes])
  useEffect(() => { cargar() }, [cargar])

  const ultimo = useMemo(() => { const m = {}; ajustes.forEach(a => { if (!m[a.contrato_id]) m[a.contrato_id] = a }); return m }, [ajustes])
  const alternar = id => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n) }
  const elegidos = contratos.filter(c => sel.has(c.id))

  const aplicarAumento = async () => {
    const p = Number(String(pct).replace(',', '.'))
    if (!p || !elegidos.length) return setMsg('Elegí contratos e indicá el porcentaje.')
    if (!confirm(`Aplicar ${p}% a ${elegidos.length} contrato(s), vigente desde ${fmt(vigencia)}?`)) return
    setTrabajando(true); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    for (const c of elegidos) {
      const campo = c.tipo_facturacion === 'por_hora' ? 'valor_hora' : 'precio_acordado'
      const ant = valorDe(c), nuevo = Math.round(ant * (1 + p / 100) * 100) / 100
      const { error: e1 } = await supabase.from('contrato_ajustes').insert([{ contrato_id: c.id, fecha_vigencia: vigencia, porcentaje: p, valor_anterior: ant, valor_nuevo: nuevo, motivo: motivo || null, creado_por: user?.email || null }])
      if (e1) { setMsg(e1.message); setTrabajando(false); return }
      const { error: e2 } = await supabase.from('contratos').update({ [campo]: nuevo }).eq('id', c.id)
      if (e2) { setMsg(e2.message); setTrabajando(false); return }
    }
    setMsg(`Aumento aplicado a ${elegidos.length} contrato(s).`); setSel(new Set()); setPct(''); setMotivo(''); setTrabajando(false); cargar()
  }

  const facturar = async () => {
    const lista = elegidos.filter(c => c.tipo_facturacion !== 'por_hora' && valorDe(c) > 0 && !facturados.has(c.id))
    if (!lista.length) return setMsg('Elegí contratos de precio fijo sin factura en el mes.')
    if (!confirm(`Generar ${lista.length} factura(s) del mes ${mes}?`)) return
    setTrabajando(true); setMsg('')
    const [a, m] = mes.split('-').map(Number)
    const ultimoDia = new Date(a, m, 0).getDate()
    let ok = 0
    for (const c of lista) {
      const d = calcularDesgloseFactura(valorDe(c), 21)
      const { error: e } = await supabase.from('facturas').insert([{
        numero_factura: `FAC-${a}-${String(Math.floor(Math.random() * 9000) + 1000)}`, contrato_id: c.id, cliente_id: c.cliente_id,
        fecha_emision: hoy, periodo_desde: `${mes}-01`, periodo_hasta: `${mes}-${ultimoDia}`, subtotal: d.neto, impuestos: d.iva, total: d.total,
        observaciones: `Abono mensual ${mes} — contrato ${c.numero_contrato || ''} (total incluye IVA)`, estado: 'emitida'
      }])
      if (e) { setMsg(`Error en ${nombreCli(c)}: ${e.message}`); break }
      ok++
    }
    setMsg(`${ok} factura(s) generadas. Revisalas y asignales número y vencimiento en Finanzas > Facturación.`); setSel(new Set()); setTrabajando(false); cargar()
  }

  return (
    <div>
      {error && <div style={{ ...s.card, padding: 12, color: paleta.danger, background: paleta.dangerSoft }}>{error}</div>}
      <div style={{ ...s.card, padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><label style={s.label}>Mes a facturar</label><input type="month" style={s.input} value={mes} onChange={e => setMes(e.target.value)} /></div>
        <div><label style={s.label}>Aumento %</label><input style={{ ...s.input, width: 90 }} value={pct} onChange={e => setPct(e.target.value)} placeholder="Ej: 8" /></div>
        <div><label style={s.label}>Vigente desde</label><input type="date" style={s.input} value={vigencia} onChange={e => setVigencia(e.target.value)} /></div>
        <div style={{ flex: 1, minWidth: 160 }}><label style={s.label}>Motivo</label><input style={s.input} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Paritaria, inflación…" /></div>
        <button style={s.btnPrimario('#1e40af')} disabled={trabajando} onClick={aplicarAumento}>Aplicar aumento ({elegidos.length})</button>
        <button style={s.btnPrimario('#15803D')} disabled={trabajando} onClick={facturar}>Generar facturas del mes</button>
      </div>
      {msg && <div style={{ ...s.card, padding: 12 }}>{msg}</div>}
      <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>
            <th style={{ ...s.tablaCabecera(), padding: '8px 10px' }}><input type="checkbox" checked={sel.size === contratos.length && contratos.length > 0} onChange={e => setSel(e.target.checked ? new Set(contratos.map(c => c.id)) : new Set())} /></th>
            {['Cliente', 'Contrato', 'Modalidad', 'Valor actual', 'Último aumento', `Facturado ${mes}`, 'Vence'].map(h => <th key={h} style={{ ...s.tablaCabecera(), padding: '8px 10px' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {contratos.map(c => {
              const u = ultimo[c.id]
              return (
                <tr key={c.id} style={{ borderTop: `1px solid ${paleta.line}` }}>
                  <td style={{ padding: '6px 10px' }}><input type="checkbox" checked={sel.has(c.id)} onChange={() => alternar(c.id)} /></td>
                  <td style={{ padding: '6px 10px', fontWeight: 600 }}>{nombreCli(c)}</td>
                  <td style={{ padding: '6px 10px' }}>{c.numero_contrato}</td>
                  <td style={{ padding: '6px 10px' }}>{c.tipo_facturacion === 'por_hora' ? 'Por hora' : 'Precio fijo'}</td>
                  <td style={{ padding: '6px 10px', fontFamily: paleta.fontMono }}>{ars(valorDe(c))}{c.tipo_facturacion === 'por_hora' ? '/h' : ''}</td>
                  <td style={{ padding: '6px 10px' }}>{u ? `${u.porcentaje}% · ${fmt(u.fecha_vigencia)}` : <span style={{ color: paleta.muted }}>Sin aumentos</span>}</td>
                  <td style={{ padding: '6px 10px' }}>{c.tipo_facturacion === 'por_hora' ? <span style={{ color: paleta.muted }}>Por horas (Agenda)</span> : facturados.has(c.id) ? <span style={{ color: paleta.success }}>✓ Facturado</span> : <span style={{ color: paleta.warn }}>Pendiente</span>}</td>
                  <td style={{ padding: '6px 10px' }}>{fmt(c.fecha_fin)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {contratos.length === 0 && <div style={{ padding: 14, color: paleta.muted }}>No hay contratos activos.</div>}
      </div>
      {ajustes.length > 0 && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 8px' }}>Historial de aumentos</h3>
          {ajustes.slice(0, 15).map(a => {
            const c = contratos.find(x => x.id === a.contrato_id)
            return <div key={a.id} style={{ fontSize: 13, padding: '3px 0' }}>{fmt(a.fecha_vigencia)} · {c ? nombreCli(c) : 'Contrato'} · <b>{a.porcentaje}%</b> · {ars(a.valor_anterior)} → {ars(a.valor_nuevo)}{a.motivo ? ` · ${a.motivo}` : ''}</div>
          })}
        </div>
      )}
    </div>
  )
}
