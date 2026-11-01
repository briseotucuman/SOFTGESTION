import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { arsC, r2, traerTodo } from '../contabilidadUtils.js'
import { calcularSaldos } from './ContabilidadInformes.jsx'
import { Download } from 'lucide-react'

const th = { ...s.tablaCabecera(), padding: '8px 10px' }
const num = { padding: '5px 10px', textAlign: 'right', fontFamily: paleta.fontMono, whiteSpace: 'nowrap' }
const fmt = f => String(f).split('-').reverse().join('/')
const RET = [['1.1.03.02', 'IVA'], ['1.1.03.03', 'Ganancias'], ['1.1.03.04', 'Ingresos Brutos'], ['1.1.03.05', 'TEM'], ['1.1.03.06', 'SUSS'], ['1.1.03.07', 'Otras']]

function leer(k) { try { return localStorage.getItem(k) || '' } catch { return '' } }
function guardar(k, v) { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } }

function csv(nombre, filas) {
  const txt = filas.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }))
  a.download = nombre; a.click()
}

export default function ContabilidadImpuestos({ cuentas, lineas, desde, hasta }) {
  const [ventas, setVentas] = useState([])
  const [compras, setCompras] = useState([])
  const [err, setErr] = useState('')
  const [libro, setLibro] = useState('ventas')
  const [alIibb, setAlIibb] = useState(() => leer('sg_aliq_iibb'))
  const [alTem, setAlTem] = useState(() => leer('sg_aliq_tem'))

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const v = await traerTodo(() => supabase.from('facturas').select('id, numero_factura, tipo_comprobante, fecha_emision, subtotal, total, estado, clientes(razon_social, nombre_contacto, cuit)').neq('estado', 'anulada').gte('fecha_emision', desde).lte('fecha_emision', hasta).order('fecha_emision'))
        const c = await traerTodo(() => supabase.from('facturas_compra').select('id, numero_factura, fecha_emision, subtotal, total, estado, proveedores(razon_social, cuit)').neq('estado', 'anulada').gte('fecha_emision', desde).lte('fecha_emision', hasta).order('fecha_emision'))
        if (vivo) { setVentas(v); setCompras(c) }
      } catch (e) { if (vivo) setErr(e.message || String(e)) }
    })()
    return () => { vivo = false }
  }, [desde, hasta])

  const porCodigo = useMemo(() => Object.fromEntries(calcularSaldos(cuentas, lineas, desde, hasta).map(c => [c.codigo, c])), [cuentas, lineas, desde, hasta])
  const ivaDeb = porCodigo['2.1.03.01'] ? porCodigo['2.1.03.01'].haber - porCodigo['2.1.03.01'].debe : 0
  const ivaCred = porCodigo['1.1.03.01'] ? porCodigo['1.1.03.01'].debe - porCodigo['1.1.03.01'].haber : 0
  const retIva = porCodigo['1.1.03.02'] ? porCodigo['1.1.03.02'].debe - porCodigo['1.1.03.02'].haber : 0
  const posicion = r2(ivaDeb - ivaCred - retIva)
  const retenciones = RET.map(([cod, nombre]) => [nombre, porCodigo[cod] ? r2(porCodigo[cod].debe) : 0])
  const totalRet = retenciones.reduce((a, [, v]) => a + v, 0)

  const netoVentas = ventas.reduce((a, f) => a + (/cr[eé]dito/i.test(f.tipo_comprobante || '') ? -1 : 1) * Number(f.subtotal ?? f.total), 0)
  const iibb = r2(netoVentas * (Number(alIibb) || 0) / 100), tem = r2(netoVentas * (Number(alTem) || 0) / 100)
  const retIibb = retenciones.find(r => r[0] === 'Ingresos Brutos')[1], retTem = retenciones.find(r => r[0] === 'TEM')[1]

  const filas = libro === 'ventas'
    ? ventas.map(f => ({ id: f.id, fecha: f.fecha_emision, comp: `${f.tipo_comprobante || ''} ${f.numero_factura || ''}`.trim(), tercero: f.clientes?.razon_social || f.clientes?.nombre_contacto || '', cuit: f.clientes?.cuit || '', neto: Number(f.subtotal ?? f.total), total: Number(f.total) }))
    : compras.map(f => ({ id: f.id, fecha: f.fecha_emision, comp: f.numero_factura || '', tercero: f.proveedores?.razon_social || '', cuit: f.proveedores?.cuit || '', neto: Number(f.subtotal ?? f.total), total: Number(f.total) }))
  const tot = filas.reduce((a, f) => ({ neto: a.neto + f.neto, iva: a.iva + (f.total - f.neto), total: a.total + f.total }), { neto: 0, iva: 0, total: 0 })
  const exportar = () => csv(`libro_iva_${libro}.csv`, [['Fecha', 'Comprobante', libro === 'ventas' ? 'Cliente' : 'Proveedor', 'CUIT', 'Neto', 'IVA', 'Total'], ...filas.map(f => [f.fecha, f.comp, f.tercero, f.cuit, f.neto, r2(f.total - f.neto), f.total])])
  const tarj = { ...s.card, padding: 14, flex: '1 1 200px' }

  return (
    <div>
      {err && <div style={{ ...s.card, color: paleta.danger }}>{err}</div>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={tarj}><div style={{ color: paleta.muted, fontSize: 12 }}>IVA débito fiscal (ventas)</div><div style={{ fontSize: 20, fontWeight: 700 }}>{arsC(ivaDeb)}</div></div>
        <div style={tarj}><div style={{ color: paleta.muted, fontSize: 12 }}>IVA crédito fiscal (compras)</div><div style={{ fontSize: 20, fontWeight: 700 }}>{arsC(ivaCred)}</div></div>
        <div style={tarj}><div style={{ color: paleta.muted, fontSize: 12 }}>Retenciones de IVA sufridas</div><div style={{ fontSize: 20, fontWeight: 700 }}>{arsC(retIva)}</div></div>
        <div style={{ ...tarj, background: posicion > 0 ? paleta.warnSoft : paleta.successSoft }}>
          <div style={{ color: paleta.muted, fontSize: 12 }}>{posicion > 0 ? 'IVA a pagar del período' : 'Saldo a favor de IVA'}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: posicion > 0 ? paleta.warn : paleta.success }}>{arsC(Math.abs(posicion))}</div>
        </div>
      </div>
      <p style={{ color: paleta.muted, fontSize: 12, margin: '2px 4px 14px' }}>Cálculo sobre los asientos del período {fmt(desde)} – {fmt(hasta)}. Si no ves cifras, generá antes los asientos. El saldo a favor de períodos anteriores no está incluido.</p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...s.card, flex: '1 1 320px' }}>
          <h3 style={{ margin: '0 0 8px' }}>Retenciones y percepciones sufridas</h3>
          {retenciones.map(([n, v]) => <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}><span>{n}</span><span style={{ fontFamily: paleta.fontMono }}>{arsC(v)}</span></div>)}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${paleta.lineStrong}`, marginTop: 4, paddingTop: 4, fontWeight: 700 }}><span>Total a computar como pago a cuenta</span><span style={{ fontFamily: paleta.fontMono }}>{arsC(totalRet)}</span></div>
        </div>
        <div style={{ ...s.card, flex: '1 1 320px' }}>
          <h3 style={{ margin: '0 0 8px' }}>Estimación de Ingresos Brutos y TEM</h3>
          <div style={{ fontSize: 13, marginBottom: 8 }}>Ventas netas del período: <b>{arsC(netoVentas)}</b></div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div><label style={s.label}>Alícuota IIBB %</label><input type="number" step="0.01" style={{ ...s.input, width: 110 }} value={alIibb} onChange={e => { setAlIibb(e.target.value); guardar('sg_aliq_iibb', e.target.value) }} /></div>
            <div><label style={s.label}>Alícuota TEM %</label><input type="number" step="0.01" style={{ ...s.input, width: 110 }} value={alTem} onChange={e => { setAlTem(e.target.value); guardar('sg_aliq_tem', e.target.value) }} /></div>
          </div>
          <div style={{ fontSize: 13, marginTop: 10 }}>IIBB estimado {arsC(iibb)} − retenciones {arsC(retIibb)} = <b>{arsC(iibb - retIibb)}</b></div>
          <div style={{ fontSize: 13 }}>TEM estimado {arsC(tem)} − retenciones {arsC(retTem)} = <b>{arsC(tem - retTem)}</b></div>
          <div style={{ color: paleta.muted, fontSize: 11.5, marginTop: 6 }}>Estimación informativa con la alícuota que cargues; confirmá con tu contador el régimen y la alícuota que te corresponden.</div>
        </div>
      </div>

      <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={libro === 'ventas' ? s.btnPrimario('#1e40af') : s.btnSecundario} onClick={() => setLibro('ventas')}>Libro IVA ventas</button>
          <button style={libro === 'compras' ? s.btnPrimario('#1e40af') : s.btnSecundario} onClick={() => setLibro('compras')}>Libro IVA compras</button>
          <button style={{ ...s.btnSecundario, marginLeft: 'auto' }} onClick={exportar}><Download size={13} /> Exportar</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['Fecha', 'Comprobante', libro === 'ventas' ? 'Cliente' : 'Proveedor', 'CUIT', 'Neto', 'IVA', 'Total'].map((h, i) => <th key={h} style={{ ...th, textAlign: i > 3 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.id} style={{ borderTop: `1px solid ${paleta.line}` }}>
                <td style={{ padding: '5px 10px' }}>{fmt(f.fecha)}</td><td style={{ padding: '5px 10px' }}>{f.comp}</td><td style={{ padding: '5px 10px' }}>{f.tercero}</td><td style={{ padding: '5px 10px' }}>{f.cuit}</td>
                <td style={num}>{arsC(f.neto)}</td><td style={num}>{arsC(f.total - f.neto)}</td><td style={num}>{arsC(f.total)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: `2px solid ${paleta.lineStrong}`, fontWeight: 700 }}><td colSpan={4} style={{ padding: '8px 10px' }}>TOTALES ({filas.length})</td><td style={num}>{arsC(tot.neto)}</td><td style={num}>{arsC(tot.iva)}</td><td style={num}>{arsC(tot.total)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
