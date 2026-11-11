import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { construirItems, isoLocal, diasEntre, sumarMesesYM } from '../proyeccionCaja.js'
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const corto = n => { const a = Math.abs(n); const t = a >= 1e6 ? (a / 1e6).toFixed(1).replace('.', ',') + ' M' : a >= 1e3 ? Math.round(a / 1e3) + ' mil' : String(Math.round(a)); return (n < 0 ? '-' : '') + '$' + t }
const nomCli = c => c?.razon_social || c?.nombre_contacto || 'Sin nombre'
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const etiquetaMes = ym => { const [y, m] = ym.split('-').map(Number); return `${MES[m - 1]} ${String(y).slice(2)}` }
const nombreMesLargo = ym => { const [y, m] = ym.split('-').map(Number); const n = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long' }); return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + y }
const neto = f => Number(f.subtotal ?? f.total ?? 0)

// Tablero para decidir: caja a 90 días, comparativos, tendencia, deuda de clientes y concentración
export default function TableroDecision() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [cobrosVencidos, setCobrosVencidos] = useState(true)
  const [cargando, setCargando] = useState(true)
  const hoy = isoLocal(new Date())
  const mesHoy = hoy.slice(0, 7)

  async function cargar() {
    setCargando(true)
    const desde = sumarMesesYM(mesHoy, -13) + '-01'
    const r = await Promise.all([
      supabase.from('facturas').select('id, cliente_id, subtotal, total, estado, fecha_emision, fecha_vencimiento').neq('estado', 'anulada'),
      supabase.from('pagos').select('factura_id, monto'),
      supabase.from('facturas_compra').select('id, subtotal, total, estado, fecha_emision, fecha_vencimiento').neq('estado', 'anulada'),
      supabase.from('pagos_compra').select('factura_compra_id, monto'),
      supabase.from('compromisos_pago').select('tipo, monto, fecha_vencimiento, estado').eq('estado', 'pendiente'),
      supabase.from('costos_fijos').select('nombre, monto, frecuencia, mes').eq('activo', true),
      supabase.from('liquidaciones_sueldo').select('total_neto, total_bruto, costo_empleador, estado, fecha_pago, periodo'),
      supabase.from('cuentas_bancarias').select('saldo').eq('activa', true),
      supabase.from('movimientos_financieros').select('tipo, monto, fecha').gte('fecha', desde),
      supabase.from('clientes').select('id, razon_social, nombre_contacto')
    ])
    const err = r.find(x => x.error); setError(err ? err.error.message : '')
    const [fa, pv, fc, pc, co, cf, li, cu, mv, cl] = r.map(x => x.data || [])
    setDatos({ fa, pv, fc, pc, co, cf, li, saldo: cu.reduce((a, c) => a + Number(c.saldo || 0), 0), mv, cl })
    setCargando(false)
  }
  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const calc = useMemo(() => {
    if (!datos) return null
    const { fa, pv, fc, pc, co, cf, li, saldo, mv, cl } = datos

    // ---------- Series mensuales (últimos 13 meses) ----------
    const meses = Array.from({ length: 13 }, (_, i) => sumarMesesYM(mesHoy, i - 12))
    const serie = Object.fromEntries(meses.map(m => [m, { ventas: 0, compras: 0, personal: 0, fijos: 0, entradas: 0, salidas: 0 }]))
    fa.forEach(f => { const m = String(f.fecha_emision).slice(0, 7); if (serie[m]) serie[m].ventas += neto(f) })
    fc.forEach(f => { const m = String(f.fecha_emision).slice(0, 7); if (serie[m]) serie[m].compras += neto(f) })
    li.forEach(l => { const m = String(l.periodo).slice(0, 7); if (serie[m]) serie[m].personal += Number(l.costo_empleador ?? l.total_bruto ?? 0) })
    cf.forEach(c => { const m = String(c.mes).slice(0, 7); if (serie[m]) serie[m].fijos += c.frecuencia === 'anual' ? Number(c.monto) / 12 : Number(c.monto) })
    mv.forEach(x => { const m = String(x.fecha).slice(0, 7); if (!serie[m]) return; if (x.tipo === 'ingreso') serie[m].entradas += Number(x.monto); else serie[m].salidas += Number(x.monto) })
    meses.forEach(m => { const x = serie[m]; x.resultado = x.ventas - x.compras - x.personal - x.fijos })

    // ---------- Proyección de caja a 90 días (semanal) ----------
    let items = construirItems({ facturas: fa.filter(f => ['emitida', 'pendiente', 'parcial', 'vencida'].includes(f.estado)), pagosVenta: pv, facturasCompra: fc.filter(f => f.estado !== 'pagada'), pagosCompra: pc, compromisos: co, costosFijos: cf, liquidaciones: li.filter(l => l.estado === 'pendiente'), hoyISO: hoy, meses: 4, incluirCostosMesActual: true })
    items = items.filter(i => i.fecha && (cobrosVencidos || i.rubro !== 'cobrar' || i.fecha >= hoy))
    const semanas = []
    let acum = saldo
    for (let w = 0; w < 13; w++) {
      const dIni = w * 7, dFin = w * 7 + 6
      let cobra = 0, paga = 0
      items.forEach(i => {
        const d = Math.max(0, diasEntre(hoy, i.fecha)) // lo vencido cae en la primera semana
        if (d >= dIni && d <= dFin) { if (i.rubro === 'cobrar') cobra += i.monto; else paga += i.monto }
      })
      acum += cobra - paga
      const f = new Date(); f.setDate(f.getDate() + dFin)
      semanas.push({ w, cobra, paga, saldo: acum, fin: f })
    }
    const minimo = semanas.reduce((a, x) => (x.saldo < a.saldo ? x : a), semanas[0])
    const primeraNeg = semanas.find(x => x.saldo < 0)

    // ---------- Deuda de clientes por antigüedad ----------
    const pagado = {}; pv.forEach(p => { pagado[p.factura_id] = (pagado[p.factura_id] || 0) + Number(p.monto) })
    const tramos = [['Al día', 0], ['1-30 días', 0], ['31-60 días', 0], ['61-90 días', 0], ['+90 días', 0]]
    const deudaCli = {}
    fa.filter(f => ['emitida', 'pendiente', 'parcial', 'vencida'].includes(f.estado)).forEach(f => {
      const saldoF = Number(f.total) - (pagado[f.id] || 0); if (saldoF <= 0.5) return
      const atraso = f.fecha_vencimiento ? diasEntre(f.fecha_vencimiento, hoy) : 0
      const i = atraso <= 0 ? 0 : atraso <= 30 ? 1 : atraso <= 60 ? 2 : atraso <= 90 ? 3 : 4
      tramos[i][1] += saldoF
      const o = (deudaCli[f.cliente_id] ||= { total: 0, vencido: 0 }); o.total += saldoF; if (atraso > 0) o.vencido += saldoF
    })
    const deudaTop = Object.entries(deudaCli).map(([id, v]) => ({ nombre: nomCli(cl.find(c => c.id === id)), ...v })).sort((a, b) => b.total - a.total).slice(0, 5)
    const deudaTotal = tramos.reduce((a, t) => a + t[1], 0)

    // ---------- Concentración de ventas (12 meses) ----------
    const ini12 = sumarMesesYM(mesHoy, -11)
    const porCli = {}; let tot12 = 0
    fa.filter(f => String(f.fecha_emision).slice(0, 7) >= ini12).forEach(f => { porCli[f.cliente_id] = (porCli[f.cliente_id] || 0) + neto(f); tot12 += neto(f) })
    const top = Object.entries(porCli).map(([id, v]) => ({ nombre: nomCli(cl.find(c => c.id === id)), v, pct: tot12 ? (v / tot12) * 100 : 0 })).sort((a, b) => b.v - a.v)
    return { meses, serie, semanas, minimo, primeraNeg, saldo, tramos, deudaTop, deudaTotal, top: top.slice(0, 5), conc: top.slice(0, 3).reduce((a, x) => a + x.pct, 0), tot12, nClientes: top.length }
  }, [datos, cobrosVencidos]) // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando && !datos) return <p style={{ color: paleta.muted, padding: 16 }}>Calculando…</p>
  if (!calc) return error ? <div style={{ ...s.card, color: paleta.danger }}>{error}</div> : null

  const { meses, serie, semanas, minimo, primeraNeg } = calc
  const mesAnt = sumarMesesYM(mesHoy, -1), mesAnio = sumarMesesYM(mesHoy, -12)
  const diaHoy = new Date().getDate()
  const diasMesHoy = new Date(Number(mesHoy.slice(0, 4)), Number(mesHoy.slice(5, 7)), 0).getDate()

  // Comparativos
  const filasComp = [
    ['Ventas netas', 'ventas', true], ['Compras', 'compras', false], ['Costo de personal', 'personal', false], ['Resultado operativo', 'resultado', true]
  ]
  const variacion = (a, b, subeBien) => {
    if (!b) return null
    const v = ((a - b) / Math.abs(b)) * 100
    return { v, bueno: subeBien ? v >= 0 : v <= 0 }
  }

  return (
    <div>
      {error && <div style={{ ...s.card, color: paleta.danger, background: paleta.dangerSoft, padding: 12 }}>No se pudo cargar parte de los datos: {error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button style={s.btnSecundario} onClick={cargar}><RefreshCw size={13} className={cargando ? 'sg-girar' : ''} /> Actualizar</button>
      </div>

      {/* 1. CAJA A 90 DÍAS */}
      <div style={{ ...s.card, borderLeft: `5px solid ${primeraNeg ? paleta.danger : minimo.saldo < calc.saldo * 0.3 ? paleta.warn : paleta.success}` }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 340px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15, color: primeraNeg ? paleta.danger : paleta.success }}>
              {primeraNeg ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              {primeraNeg ? `La caja se queda sin fondos hacia el ${primeraNeg.fin.toLocaleDateString('es-AR', { day: '2-digit', month: 'long' })}` : 'La caja se mantiene positiva los próximos 90 días'}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: paleta.inkSoft }}>
              Hoy tenés {ars(calc.saldo)} en cuentas. El punto más bajo proyectado es <strong style={{ color: minimo.saldo < 0 ? paleta.danger : paleta.ink }}>{ars(minimo.saldo)}</strong> (semana que termina el {minimo.fin.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}).
              {primeraNeg && <> Necesitás cobrar o conseguir al menos <strong>{ars(-minimo.saldo)}</strong> antes de esa fecha.</>}
            </p>
          </div>
          <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center', color: paleta.inkSoft, cursor: 'pointer' }}>
            <input type="checkbox" checked={cobrosVencidos} onChange={e => setCobrosVencidos(e.target.checked)} />
            Contar como cobrables las facturas ya vencidas
          </label>
        </div>
        <GraficoSaldo semanas={semanas} saldoInicial={calc.saldo} />
        <p style={{ fontSize: 11.5, color: paleta.muted, margin: '6px 0 0' }}>Parte del saldo actual, suma lo que se espera cobrar y resta facturas de proveedores, cuotas, impuestos, sueldos y costos fijos según su vencimiento. Lo ya vencido se cuenta en la primera semana. Detalle por rubro en Finanzas → Proyección de caja.</p>
      </div>

      {/* 2. COMPARATIVO */}
      <div style={s.card}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Cómo venís respecto a otros períodos</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ ...s.tabla, minWidth: 640 }}>
            <thead><tr>
              <th style={s.tablaCabecera()}>Concepto</th>
              <th style={{ ...s.tablaCabecera(), textAlign: 'right' }}>{nombreMesLargo(mesHoy)}<br /><span style={{ fontWeight: 400, textTransform: 'none' }}>(hasta hoy, día {diaHoy} de {diasMesHoy})</span></th>
              <th style={{ ...s.tablaCabecera(), textAlign: 'right' }}>{nombreMesLargo(mesAnt)}</th><th style={{ ...s.tablaCabecera(), textAlign: 'right' }}>vs mes anterior</th>
              <th style={{ ...s.tablaCabecera(), textAlign: 'right' }}>{nombreMesLargo(mesAnio)}</th><th style={{ ...s.tablaCabecera(), textAlign: 'right' }}>vs año anterior</th>
            </tr></thead>
            <tbody>
              {filasComp.map(([t, k, sube], i) => {
                const a = serie[mesHoy][k], b = serie[mesAnt][k], c = serie[mesAnio][k]
                const v1 = variacion(a, b, sube), v2 = variacion(a, c, sube)
                const chip = v => v ? <span style={{ ...s.badge(v.bueno ? paleta.successSoft : paleta.dangerSoft, v.bueno ? paleta.success : paleta.danger) }}>{v.v >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{v.v >= 0 ? '+' : ''}{v.v.toFixed(0)}%</span> : <span style={{ color: paleta.muted }}>—</span>
                return (
                  <tr key={k} style={s.tablaFila(i)}>
                    <td style={s.tablaCellBold}>{t}</td>
                    <td style={{ ...s.tablaCellBold, textAlign: 'right' }}>{ars(a)}</td>
                    <td style={{ ...s.tablaCell, textAlign: 'right' }}>{ars(b)}</td><td style={{ ...s.tablaCell, textAlign: 'right' }}>{chip(v1)}</td>
                    <td style={{ ...s.tablaCell, textAlign: 'right' }}>{ars(c)}</td><td style={{ ...s.tablaCell, textAlign: 'right' }}>{chip(v2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11.5, color: paleta.muted, margin: '8px 0 0' }}>El mes en curso está incompleto (facturas y sueldos se cargan a lo largo del mes), por eso compará con cuidado hasta que cierre. El resultado operativo es estimado: ventas netas menos compras, personal y costos fijos cargados.</p>
      </div>

      {/* 3. TENDENCIA 12 MESES */}
      <div style={s.card}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Tendencia de los últimos 12 meses</h3>
        <GraficoBarras meses={meses.slice(1)} serie={serie} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
        {/* 4. DEUDA DE CLIENTES */}
        <div style={s.card}>
          <h3 style={{ margin: '0 0 2px', fontSize: 15 }}>Lo que te deben los clientes</h3>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>{ars(calc.deudaTotal)}</div>
          {calc.tramos.map(([t, v], i) => {
            const p = calc.deudaTotal ? (v / calc.deudaTotal) * 100 : 0
            const col = ['#16A34A', '#CA8A04', '#EA580C', '#DC2626', '#991B1B'][i]
            return (
              <div key={t} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span>{t}</span><span style={{ fontWeight: 600 }}>{ars(v)}</span></div>
                <div style={{ height: 7, background: paleta.surfaceMuted, borderRadius: 4 }}><div style={{ width: `${p}%`, height: '100%', background: col, borderRadius: 4 }} /></div>
              </div>
            )
          })}
          {calc.deudaTop.length > 0 && <>
            <div style={{ fontSize: 12, fontWeight: 700, color: paleta.muted, margin: '12px 0 4px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Mayores deudores</div>
            {calc.deudaTop.map(d => (
              <div key={d.nombre} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderBottom: `1px solid ${paleta.line}` }}>
                <span>{d.nombre}</span><span><strong>{ars(d.total)}</strong>{d.vencido > 0 && <span style={{ color: paleta.danger, fontSize: 11.5 }}> · {ars(d.vencido)} vencido</span>}</span>
              </div>
            ))}
          </>}
        </div>

        {/* 5. CONCENTRACIÓN */}
        <div style={s.card}>
          <h3 style={{ margin: '0 0 2px', fontSize: 15 }}>De quién depende tu facturación</h3>
          <div style={{ fontSize: 13, color: paleta.inkSoft, marginBottom: 10 }}>
            Los 3 principales clientes concentran el <strong style={{ color: calc.conc > 70 ? paleta.danger : calc.conc > 50 ? paleta.warn : paleta.success }}>{calc.conc.toFixed(0)}%</strong> de las ventas netas de los últimos 12 meses ({ars(calc.tot12)} en {calc.nClientes} clientes).
            {calc.conc > 60 && ' Perder uno de ellos te afectaría mucho: conviene diversificar.'}
          </div>
          {calc.top.map(t => (
            <div key={t.nombre} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span>{t.nombre}</span><span><strong>{t.pct.toFixed(1).replace('.', ',')}%</strong> · {ars(t.v)}</span></div>
              <div style={{ height: 7, background: paleta.surfaceMuted, borderRadius: 4 }}><div style={{ width: `${t.pct}%`, height: '100%', background: paleta.brand, borderRadius: 4 }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GraficoSaldo({ semanas, saldoInicial }) {
  const W = 760, H = 190, pl = 56, pr = 12, pt = 14, pb = 26
  const vals = [saldoInicial, ...semanas.map(x => x.saldo)]
  const max = Math.max(...vals, 1), min = Math.min(...vals, 0)
  const rango = max - min || 1
  const x = i => pl + (i * (W - pl - pr)) / (vals.length - 1)
  const y = v => pt + ((max - v) * (H - pt - pb)) / rango
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const cero = y(0)
  const marcas = [max, (max + min) / 2, min]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 10 }} role="img" aria-label="Saldo proyectado de caja por semana">
      {marcas.map((m, i) => <g key={i}><line x1={pl} x2={W - pr} y1={y(m)} y2={y(m)} stroke="#E2E8F0" /><text x={pl - 6} y={y(m) + 4} fontSize="10" textAnchor="end" fill="#64748B">{corto(m)}</text></g>)}
      {min < 0 && <><rect x={pl} y={cero} width={W - pl - pr} height={Math.max(0, H - pb - cero)} fill="#FFE4E6" opacity=".55" /><line x1={pl} x2={W - pr} y1={cero} y2={cero} stroke="#BE123C" strokeDasharray="4 3" /></>}
      <polyline points={pts} fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinejoin="round" />
      {vals.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={v < 0 ? '#BE123C' : '#0F766E'}><title>{i === 0 ? 'Hoy' : `Semana ${i}`}: {ars(v)}</title></circle>)}
      {[0, 4, 8, 13].map(i => <text key={i} x={x(i)} y={H - 8} fontSize="10" textAnchor={i === 13 ? 'end' : i === 0 ? 'start' : 'middle'} fill="#64748B">{i === 0 ? 'Hoy' : `Sem. ${i}`}</text>)}
    </svg>
  )
}

function GraficoBarras({ meses, serie }) {
  const W = 760, H = 230, pl = 56, pr = 12, pt = 14, pb = 28
  const egr = m => serie[m].compras + serie[m].personal + serie[m].fijos
  const max = Math.max(...meses.map(m => Math.max(serie[m].ventas, egr(m))), 1)
  const paso = (W - pl - pr) / meses.length
  const y = v => pt + ((max - v) * (H - pt - pb)) / max
  const marcas = [max, max / 2, 0]
  const linea = meses.map((m, i) => `${pl + paso * i + paso / 2},${y(Math.max(serie[m].resultado, 0))}`).join(' ')
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Ventas y costos por mes">
        {marcas.map((m, i) => <g key={i}><line x1={pl} x2={W - pr} y1={y(m)} y2={y(m)} stroke="#E2E8F0" /><text x={pl - 6} y={y(m) + 4} fontSize="10" textAnchor="end" fill="#64748B">{corto(m)}</text></g>)}
        {meses.map((m, i) => {
          const x0 = pl + paso * i + paso * 0.14, bw = paso * 0.34
          return (
            <g key={m}>
              <rect x={x0} y={y(serie[m].ventas)} width={bw} height={Math.max(0, H - pb - y(serie[m].ventas))} rx="2" fill="#0F766E"><title>{etiquetaMes(m)} · Ventas netas: {ars(serie[m].ventas)}</title></rect>
              <rect x={x0 + bw + 2} y={y(egr(m))} width={bw} height={Math.max(0, H - pb - y(egr(m)))} rx="2" fill="#F59E0B"><title>{etiquetaMes(m)} · Costos (compras, personal y fijos): {ars(egr(m))}</title></rect>
              <text x={pl + paso * i + paso / 2} y={H - 10} fontSize="10" textAnchor="middle" fill="#64748B">{etiquetaMes(m)}</text>
            </g>
          )
        })}
        <polyline points={linea} fill="none" stroke="#1E293B" strokeWidth="1.8" strokeDasharray="5 3" />
      </svg>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: paleta.inkSoft, flexWrap: 'wrap' }}>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#0F766E', borderRadius: 2, marginRight: 5 }} />Ventas netas</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#F59E0B', borderRadius: 2, marginRight: 5 }} />Costos (compras + personal + fijos)</span>
        <span><i style={{ display: 'inline-block', width: 16, borderTop: '2px dashed #1E293B', marginRight: 5, verticalAlign: 'middle' }} />Resultado operativo (si es positivo)</span>
      </div>
    </>
  )
}
