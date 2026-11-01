import { useMemo, useState } from 'react'
import { s, paleta } from '../estilos.js'
import { arsC, r2 } from '../contabilidadUtils.js'
import { Download } from 'lucide-react'

const th = { ...s.tablaCabecera(), padding: '8px 10px' }
const num = { padding: '5px 10px', textAlign: 'right', fontFamily: paleta.fontMono, whiteSpace: 'nowrap' }
const fmt = f => String(f).split('-').reverse().join('/')

function csv(nombre, filas) {
  const txt = filas.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }))
  a.download = nombre; a.click()
}

// Saldos por cuenta: inicial (antes de "desde"), movimientos del período y acumulado a "hasta"
export function calcularSaldos(cuentas, lineas, desde, hasta) {
  const m = {}
  cuentas.forEach(c => { m[c.id] = { ...c, ini: 0, debe: 0, haber: 0 } })
  lineas.forEach(l => {
    const x = m[l.cuenta_id]; if (!x) return
    const f = l.asientos.fecha
    if (f < desde) x.ini += Number(l.debe) - Number(l.haber)
    else if (f <= hasta) { x.debe += Number(l.debe); x.haber += Number(l.haber) }
  })
  return Object.values(m).map(x => ({ ...x, fin: r2(x.ini + x.debe - x.haber) }))
}

export default function ContabilidadInformes({ vista, cuentas, lineas, desde, hasta }) {
  if (vista === 'mayor') return <Mayor cuentas={cuentas} lineas={lineas} desde={desde} hasta={hasta} />
  if (vista === 'sumas') return <Sumas cuentas={cuentas} lineas={lineas} desde={desde} hasta={hasta} />
  return <Balance cuentas={cuentas} lineas={lineas} desde={desde} hasta={hasta} />
}

function Mayor({ cuentas, lineas, desde, hasta }) {
  const imputables = cuentas.filter(c => c.imputable)
  const [id, setId] = useState('')
  const cuenta = imputables.find(c => c.id === id)
  const { ini, filas } = useMemo(() => {
    if (!id) return { ini: 0, filas: [] }
    const ls = lineas.filter(l => l.cuenta_id === id).sort((a, b) => a.asientos.fecha.localeCompare(b.asientos.fecha) || a.asientos.numero - b.asientos.numero)
    let saldo = ls.filter(l => l.asientos.fecha < desde).reduce((a, l) => a + Number(l.debe) - Number(l.haber), 0)
    const ini = saldo
    const filas = ls.filter(l => l.asientos.fecha >= desde).map(l => { saldo = r2(saldo + Number(l.debe) - Number(l.haber)); return { ...l, saldo } })
    return { ini, filas }
  }, [id, lineas, desde])
  const exportar = () => csv(`mayor_${cuenta.codigo}.csv`, [['Fecha', 'Asiento', 'Descripción', 'Debe', 'Haber', 'Saldo'], ...filas.map(l => [l.asientos.fecha, l.asientos.numero, l.asientos.descripcion, l.debe, l.haber, l.saldo])])
  return (
    <div>
      <div style={{ ...s.card, padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={{ ...s.input, flex: 1, minWidth: 260 }} value={id} onChange={e => setId(e.target.value)}>
          <option value="">Elegí una cuenta para ver su mayor…</option>
          {imputables.map(c => <option key={c.id} value={c.id}>{c.codigo} {c.nombre}</option>)}
        </select>
        {cuenta && <button style={s.btnSecundario} onClick={exportar}><Download size={13} /> Exportar</button>}
      </div>
      {cuenta && (
        <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['Fecha', 'Asiento', 'Descripción', 'Debe', 'Haber', 'Saldo'].map((h, i) => <th key={h} style={{ ...th, textAlign: i > 2 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
            <tbody>
              <tr style={{ background: 'rgba(37,99,235,0.04)' }}><td colSpan={5} style={{ padding: '5px 10px' }}><i>Saldo inicial al {fmt(desde)}</i></td><td style={num}>{arsC(ini)}</td></tr>
              {filas.map(l => (
                <tr key={l.id} style={{ borderTop: `1px solid ${paleta.line}` }}>
                  <td style={{ padding: '5px 10px' }}>{fmt(l.asientos.fecha)}</td><td style={{ padding: '5px 10px' }}>{l.asientos.numero}</td>
                  <td style={{ padding: '5px 10px' }}>{l.asientos.descripcion}</td>
                  <td style={num}>{l.debe > 0 ? arsC(l.debe) : ''}</td><td style={num}>{l.haber > 0 ? arsC(l.haber) : ''}</td><td style={{ ...num, fontWeight: 600 }}>{arsC(l.saldo)}</td>
                </tr>
              ))}
              {filas.length === 0 && <tr><td colSpan={6} style={{ padding: 14, color: paleta.muted }}>Sin movimientos en el período.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Sumas({ cuentas, lineas, desde, hasta }) {
  const filas = useMemo(() => calcularSaldos(cuentas, lineas, desde, hasta).filter(c => c.imputable && (c.ini || c.debe || c.haber)), [cuentas, lineas, desde, hasta])
  const tot = filas.reduce((a, c) => ({ debe: a.debe + c.debe, haber: a.haber + c.haber, deu: a.deu + Math.max(c.fin, 0), acr: a.acr + Math.max(-c.fin, 0) }), { debe: 0, haber: 0, deu: 0, acr: 0 })
  const ok = Math.abs(tot.deu - tot.acr) < 0.01
  const exportar = () => csv('sumas_y_saldos.csv', [['Código', 'Cuenta', 'Debe', 'Haber', 'Saldo deudor', 'Saldo acreedor'], ...filas.map(c => [c.codigo, c.nombre, c.debe, c.haber, Math.max(c.fin, 0), Math.max(-c.fin, 0)])])
  return (
    <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
      <div style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b>Balance de sumas y saldos</b><span style={{ color: paleta.muted, fontSize: 12 }}>Movimientos del {fmt(desde)} al {fmt(hasta)}; saldos acumulados</span>
        <span style={{ fontWeight: 600, color: ok ? paleta.success : paleta.danger }}>{ok ? '✓ Cuadra' : `Diferencia ${arsC(tot.deu - tot.acr)}`}</span>
        <button style={{ ...s.btnSecundario, marginLeft: 'auto' }} onClick={exportar}><Download size={13} /> Exportar</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>{['Código', 'Cuenta', 'Debe', 'Haber', 'Saldo deudor', 'Saldo acreedor'].map((h, i) => <th key={h} style={{ ...th, textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>
          {filas.map(c => (
            <tr key={c.id} style={{ borderTop: `1px solid ${paleta.line}` }}>
              <td style={{ padding: '5px 10px', fontFamily: paleta.fontMono }}>{c.codigo}</td><td style={{ padding: '5px 10px' }}>{c.nombre}</td>
              <td style={num}>{arsC(c.debe)}</td><td style={num}>{arsC(c.haber)}</td>
              <td style={num}>{c.fin > 0 ? arsC(c.fin) : ''}</td><td style={num}>{c.fin < 0 ? arsC(-c.fin) : ''}</td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${paleta.lineStrong}`, fontWeight: 700 }}>
            <td colSpan={2} style={{ padding: '8px 10px' }}>TOTALES</td><td style={num}>{arsC(tot.debe)}</td><td style={num}>{arsC(tot.haber)}</td><td style={num}>{arsC(tot.deu)}</td><td style={num}>{arsC(tot.acr)}</td>
          </tr>
        </tbody>
      </table>
      {filas.length === 0 && <div style={{ padding: 14, color: paleta.muted }}>Todavía no hay movimientos contables.</div>}
    </div>
  )
}

function Bloque({ titulo, rubros, total, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, color, marginBottom: 4 }}>{titulo}</div>
      {rubros.map(([rubro, cs]) => (
        <div key={rubro}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, padding: '3px 0', fontSize: 13 }}><span>{rubro}</span><span style={{ fontFamily: paleta.fontMono }}>{arsC(cs.reduce((a, c) => a + c.v, 0))}</span></div>
          {cs.map(c => <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0 1px 16px', fontSize: 12.5, color: paleta.inkSoft }}><span>{c.nombre}</span><span style={{ fontFamily: paleta.fontMono }}>{arsC(c.v)}</span></div>)}
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: `1px solid ${paleta.lineStrong}`, marginTop: 4, paddingTop: 4 }}><span>Total {titulo.toLowerCase()}</span><span style={{ fontFamily: paleta.fontMono }}>{arsC(total)}</span></div>
    </div>
  )
}

function Balance({ cuentas, lineas, desde, hasta }) {
  const saldos = useMemo(() => calcularSaldos(cuentas, lineas, desde, hasta).filter(c => c.imputable), [cuentas, lineas, desde, hasta])
  const agrupar = (tipo, valor, soloPeriodo) => {
    const g = {}
    saldos.filter(c => c.tipo === tipo).forEach(c => {
      const v = r2(valor(c, soloPeriodo)); if (!v) return
      ;(g[c.rubro || 'Otros'] ||= []).push({ id: c.id, nombre: c.nombre, v })
    })
    return Object.entries(g)
  }
  const sumaR = r => r.reduce((a, [, cs]) => a + cs.reduce((x, c) => x + c.v, 0), 0)
  const deudor = c => c.fin
  const acreedor = c => -c.fin
  const activo = agrupar('activo', deudor), pasivo = agrupar('pasivo', acreedor), patr = agrupar('patrimonio', acreedor)
  // Resultados del período (movimientos entre desde y hasta)
  const ing = agrupar('ingreso', c => c.haber - c.debe), egr = agrupar('egreso', c => c.debe - c.haber)
  const tIng = sumaR(ing), tEgr = sumaR(egr), resPeriodo = r2(tIng - tEgr)
  // Resultado acumulado de ejercicios previos al período (pasa a patrimonio)
  const resAnterior = r2(saldos.filter(c => c.tipo === 'ingreso' || c.tipo === 'egreso').reduce((a, c) => a - c.ini, 0))
  const tA = sumaR(activo), tP = sumaR(pasivo), tPN = sumaR(patr) + resAnterior + resPeriodo
  const ok = Math.abs(tA - (tP + tPN)) < 0.01
  const exportar = () => csv('balance.csv', [['Sección', 'Rubro', 'Cuenta', 'Importe'], ...[['Activo', activo], ['Pasivo', pasivo], ['Patrimonio', patr], ['Ingresos', ing], ['Egresos', egr]].flatMap(([sec, r]) => r.flatMap(([rub, cs]) => cs.map(c => [sec, rub, c.nombre, c.v])))])
  const caja = { ...s.card, flex: '1 1 340px' }
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: ok ? paleta.success : paleta.danger }}>{ok ? '✓ Activo = Pasivo + Patrimonio' : `Descuadre ${arsC(tA - tP - tPN)}`}</span>
        <button style={{ ...s.btnSecundario, marginLeft: 'auto' }} onClick={exportar}><Download size={13} /> Exportar</button>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={caja}>
          <h3 style={{ margin: '0 0 10px' }}>Estado de situación patrimonial al {fmt(hasta)}</h3>
          <Bloque titulo="ACTIVO" rubros={activo} total={tA} color={paleta.info} />
          <Bloque titulo="PASIVO" rubros={pasivo} total={tP} color={paleta.warn} />
          <Bloque titulo="PATRIMONIO NETO" rubros={[...patr, ...(resAnterior ? [['Resultados de períodos anteriores', [{ id: 'ra', nombre: 'Acumulado', v: resAnterior }]]] : []), ['Resultado del período', [{ id: 'rp', nombre: resPeriodo >= 0 ? 'Ganancia' : 'Pérdida', v: resPeriodo }]]]} total={tPN} color={paleta.success} />
        </div>
        <div style={caja}>
          <h3 style={{ margin: '0 0 10px' }}>Estado de resultados {fmt(desde)} – {fmt(hasta)}</h3>
          <Bloque titulo="INGRESOS" rubros={ing} total={tIng} color={paleta.success} />
          <Bloque titulo="EGRESOS" rubros={egr} total={tEgr} color={paleta.danger} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, color: resPeriodo >= 0 ? paleta.success : paleta.danger }}>
            <span>Resultado del período</span><span style={{ fontFamily: paleta.fontMono }}>{arsC(resPeriodo)}</span>
          </div>
          {tIng > 0 && <div style={{ color: paleta.muted, fontSize: 12, marginTop: 4 }}>Margen: {(resPeriodo / tIng * 100).toFixed(1).replace('.', ',')}%</div>}
        </div>
      </div>
    </div>
  )
}
