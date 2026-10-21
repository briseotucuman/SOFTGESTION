import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s } from '../estilos.js'
import { Search, ArrowLeft, Download } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const fmtFecha = f => (f ? String(f).split('T')[0].split('-').reverse().join('/') : '—')
const hoyISO = () => new Date().toISOString().split('T')[0]
const diasEntre = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000)

// Cuenta corriente por cliente (lo que nos deben) o proveedor (lo que debemos), con saldo corrido
export default function CuentaCorriente() {
  const [modo, setModo] = useState('clientes')
  const [cargando, setCargando] = useState(true)
  const [facturas, setFacturas] = useState([])
  const [pagos, setPagos] = useState([])
  const [partes, setPartes] = useState([])
  const [seleccion, setSeleccion] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [soloConSaldo, setSoloConSaldo] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    setCargando(true); setSeleccion(null); setError('')
    const esCli = modo === 'clientes'
    Promise.all([
      esCli
        ? supabase.from('facturas').select('id, numero_factura, cliente_id, fecha_emision, fecha_vencimiento, total, estado, tipo_comprobante').neq('estado', 'anulada')
        : supabase.from('facturas_compra').select('id, numero_factura, proveedor_id, fecha_emision, fecha_vencimiento, total, estado, concepto').neq('estado', 'anulada'),
      esCli
        ? supabase.from('pagos').select('id, factura_id, fecha_pago, monto, monto_retenciones, medio_pago, referencia')
        : supabase.from('pagos_compra').select('id, factura_compra_id, fecha_pago, monto, medio_pago, referencia'),
      esCli
        ? supabase.from('clientes').select('id, razon_social, nombre_contacto, cuit').order('razon_social')
        : supabase.from('proveedores').select('id, razon_social, cuit').order('razon_social')
    ]).then(([f, p, pa]) => {
      if (!vivo) return
      const fallo = [f, p, pa].find(r => r.error)
      if (fallo) setError(fallo.error.message || 'No se pudieron cargar los datos')
      setFacturas(f.data || []); setPagos(p.data || []); setPartes(pa.data || []); setCargando(false)
    })
    return () => { vivo = false }
  }, [modo])

  const esCli = modo === 'clientes'
  const campoParte = esCli ? 'cliente_id' : 'proveedor_id'
  const campoFactPago = esCli ? 'factura_id' : 'factura_compra_id'
  const nombre = p => p?.razon_social || p?.nombre_contacto || 'Sin nombre'

  const resumen = useMemo(() => {
    const factPorId = Object.fromEntries(facturas.map(f => [f.id, f]))
    const pagadoPorFact = {}
    pagos.forEach(p => { pagadoPorFact[p[campoFactPago]] = (pagadoPorFact[p[campoFactPago]] || 0) + Number(p.monto) })
    const filas = {}
    const hoy = hoyISO()
    facturas.forEach(f => {
      const k = f[campoParte] || 'sin-asignar'
      const r = filas[k] || (filas[k] = { id: k, facturado: 0, pagado: 0, vencido: 0, masViejo: null })
      const total = Number(f.total)
      const pag = Math.min(total, pagadoPorFact[f.id] || 0)
      r.facturado += total
      r.pagado += pag
      const saldo = total - pag
      if (saldo > 0.01) {
        const venc = f.fecha_vencimiento || f.fecha_emision
        if (venc && venc < hoy) { r.vencido += saldo; if (!r.masViejo || venc < r.masViejo) r.masViejo = venc }
      }
    })
    // pagos de facturas que no están en la lista (anuladas) no cuentan
    void factPorId
    return Object.values(filas).map(r => ({ ...r, saldo: r.facturado - r.pagado, parte: partes.find(p => p.id === r.id) }))
  }, [facturas, pagos, partes, campoParte, campoFactPago])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return resumen
      .filter(r => (!soloConSaldo || Math.abs(r.saldo) > 0.01))
      .filter(r => !q || nombre(r.parte).toLowerCase().includes(q) || (r.parte?.cuit || '').includes(q))
      .sort((a, b) => b.saldo - a.saldo)
  }, [resumen, busqueda, soloConSaldo])

  const totalSaldo = filtradas.reduce((a, r) => a + r.saldo, 0)
  const totalVencido = filtradas.reduce((a, r) => a + r.vencido, 0)

  // ---------- detalle con saldo corrido ----------
  const detalle = useMemo(() => {
    if (!seleccion) return []
    const delaParte = facturas.filter(f => (f[campoParte] || 'sin-asignar') === seleccion)
    const ids = new Set(delaParte.map(f => f.id))
    const numPorId = Object.fromEntries(delaParte.map(f => [f.id, f.numero_factura]))
    const movs = [
      ...delaParte.map(f => ({
        fecha: f.fecha_emision, orden: 0, tipo: 'factura', detalle: `${f.tipo_comprobante || 'Factura'} ${f.numero_factura || 's/n'}`,
        vence: f.fecha_vencimiento, debe: Number(f.total), haber: 0
      })),
      ...pagos.filter(p => ids.has(p[campoFactPago])).map(p => ({
        fecha: p.fecha_pago, orden: 1, tipo: 'pago',
        detalle: `${esCli ? 'Cobro' : 'Pago'} ${numPorId[p[campoFactPago]] || ''} · ${p.medio_pago || ''}${Number(p.monto_retenciones) > 0 ? ` (incl. retenciones ${ars(p.monto_retenciones)})` : ''}`,
        debe: 0, haber: Number(p.monto)
      }))
    ].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.orden - b.orden)
    let saldo = 0
    return movs.map(m => ({ ...m, saldo: (saldo += m.debe - m.haber) }))
  }, [seleccion, facturas, pagos, campoParte, campoFactPago, esCli])

  function exportarCSV() {
    const parte = resumen.find(r => r.id === seleccion)?.parte
    const lineas = [['Fecha', 'Detalle', 'Vence', esCli ? 'Facturado' : 'Compra', esCli ? 'Cobrado' : 'Pagado', 'Saldo'].join(';')]
    detalle.forEach(m => lineas.push([fmtFecha(m.fecha), m.detalle, m.vence ? fmtFecha(m.vence) : '', m.debe.toFixed(2).replace('.', ','), m.haber.toFixed(2).replace('.', ','), m.saldo.toFixed(2).replace('.', ',')].join(';')))
    const blob = new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `cuenta-corriente-${(nombre(parte) || 'parte').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const th = { padding: '10px', textAlign: 'left' }
  const thR = { ...th, textAlign: 'right' }

  if (seleccion) {
    const fila = resumen.find(r => r.id === seleccion)
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button style={s.btnSecundario} onClick={() => setSeleccion(null)}><ArrowLeft size={13} style={{ verticalAlign: '-2px' }} /> Volver</button>
          <h4 style={{ margin: 0, fontWeight: 700 }}>{fila?.parte ? nombre(fila.parte) : 'Sin asignar'}</h4>
          {fila?.parte?.cuit && <span style={{ fontSize: '12.5px', color: '#64748B' }}>CUIT {fila.parte.cuit}</span>}
          <button style={{ ...s.btnSecundario, marginLeft: 'auto' }} onClick={exportarCSV}><Download size={13} style={{ verticalAlign: '-2px' }} /> Exportar</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          {[[esCli ? 'Facturado' : 'Comprado', fila?.facturado, '#0F172A'], [esCli ? 'Cobrado' : 'Pagado', fila?.pagado, '#15803D'], [esCli ? 'Saldo a cobrar' : 'Saldo a pagar', fila?.saldo, '#B91C1C'], ['Vencido', fila?.vencido, '#B45309']].map(([t, v, c]) => (
            <div key={t} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>{t}</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: c, fontFamily: 'monospace' }}>{ars(v)}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ background: '#F8FAFC', color: '#64748B' }}>
              <th style={th}>Fecha</th><th style={th}>Detalle</th><th style={th}>Vence</th>
              <th style={thR}>{esCli ? 'Facturado' : 'Compra'}</th><th style={thR}>{esCli ? 'Cobrado' : 'Pagado'}</th><th style={thR}>Saldo</th>
            </tr></thead>
            <tbody>
              {detalle.length === 0 && <tr><td colSpan={6} style={{ padding: '16px', color: '#64748B' }}>Sin movimientos.</td></tr>}
              {detalle.map((m, i) => (
                <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{fmtFecha(m.fecha)}</td>
                  <td style={{ padding: '10px' }}>{m.detalle}</td>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#64748B' }}>{m.vence ? fmtFecha(m.vence) : ''}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{m.debe ? ars(m.debe) : ''}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#15803D' }}>{m.haber ? ars(m.haber) : ''}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{ars(m.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '12px' }}>No se pudieron cargar las cuentas corrientes: {error}</div>}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <button onClick={() => setModo('clientes')} style={modo === 'clientes' ? s.btnPrimario('#0F766E') : s.btnSecundario}>Clientes</button>
        <button onClick={() => setModo('proveedores')} style={modo === 'proveedores' ? s.btnPrimario('#0F766E') : s.btnSecundario}>Proveedores</button>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94A3B8' }} />
          <input style={{ ...s.input, paddingLeft: '30px' }} placeholder={`Buscar ${esCli ? 'cliente' : 'proveedor'} o CUIT…`} value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <label style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={soloConSaldo} onChange={e => setSoloConSaldo(e.target.checked)} /> Solo con saldo
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>{esCli ? 'Total a cobrar' : 'Total a pagar'}</div>
          <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace' }}>{ars(totalSaldo)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>De ese total, vencido</div>
          <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: '#B45309' }}>{ars(totalVencido)}</div>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr style={{ background: '#F8FAFC', color: '#64748B' }}>
            <th style={th}>{esCli ? 'Cliente' : 'Proveedor'}</th><th style={thR}>{esCli ? 'Facturado' : 'Comprado'}</th><th style={thR}>{esCli ? 'Cobrado' : 'Pagado'}</th>
            <th style={thR}>Saldo</th><th style={thR}>Vencido</th><th style={thR}>Atraso</th>
          </tr></thead>
          <tbody>
            {cargando && <tr><td colSpan={6} style={{ padding: '16px', color: '#64748B' }}>Cargando…</td></tr>}
            {!cargando && filtradas.length === 0 && <tr><td colSpan={6} style={{ padding: '16px', color: '#64748B' }}>No hay cuentas para mostrar.</td></tr>}
            {filtradas.map(r => (
              <tr key={r.id} onClick={() => setSeleccion(r.id)} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}>
                <td style={{ padding: '10px', fontWeight: 600 }}>{r.parte ? nombre(r.parte) : 'Sin asignar'}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{ars(r.facturado)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#15803D' }}>{ars(r.pagado)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{ars(r.saldo)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: r.vencido ? '#B45309' : '#94A3B8' }}>{ars(r.vencido)}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: '#64748B' }}>{r.masViejo ? `${diasEntre(hoyISO(), r.masViejo)} d` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '12px', color: '#64748B', marginTop: '8px' }}>Tocá una fila para ver el detalle con saldo corrido. El atraso es la antigüedad de la deuda vencida más vieja.</p>
    </div>
  )
}
