import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { RefreshCw, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const corto = n => { const v = Number(n || 0); return Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1).replace('.', ',')}M` : Math.abs(v) >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}` }
const iso = d => d.toLocaleDateString('en-CA')
const sumar = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const AZUL = '#2563eb', AZUL_CLARO = '#93c5fd', TINTA = '#0f172a', GRIS = '#64748b'
const vidrio = {
  background: 'rgba(255,255,255,0.58)', backdropFilter: 'blur(18px) saturate(160%)', WebkitBackdropFilter: 'blur(18px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.85)', borderRadius: 24, boxShadow: '0 10px 30px -12px rgba(37,99,235,0.25)', padding: 18
}
const oscuro = {
  background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', color: '#f8fafc',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, boxShadow: '0 14px 34px -14px rgba(15,23,42,0.6)', padding: 18
}
const pill = activo => ({
  border: 0, cursor: 'pointer', borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
  background: activo ? TINTA : 'transparent', color: activo ? '#fff' : GRIS
})

function Anillo({ valor, texto, sub }) {
  const r = 52, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, valor))
  return (
    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(37,99,235,0.12)" strokeWidth="12" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={AZUL} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: TINTA }}>{texto}</div>
        <div style={{ fontSize: 11, color: GRIS }}>{sub}</div>
      </div>
    </div>
  )
}

// Tablero inicial con estilo "glass": tarjetas translúcidas, tema blanco y azul
export default function InicioGlass({ kpis, metrica, alertas, esAdmin, nombre, filtroPeriodo, setFiltroPeriodo, onIr, grupos, actualizando, onActualizar }) {
  const [f, setF] = useState(null)
  const [verModulos, setVerModulos] = useState(false)

  useEffect(() => {
    if (!esAdmin) return
    let vivo = true
    const hoy = new Date()
    const desde6 = iso(new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1))
    const ini = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    const en7 = iso(sumar(hoy, 6))
    Promise.all([
      supabase.from('facturas').select('subtotal, total, fecha_emision, fecha_vencimiento, estado, numero_factura').neq('estado', 'anulada').gte('fecha_emision', desde6),
      supabase.from('movimientos_financieros').select('tipo, monto').gte('fecha', ini),
      supabase.from('cuentas_bancarias').select('saldo').eq('activa', true),
      supabase.from('facturas').select('total, fecha_vencimiento, estado').in('estado', ['emitida', 'pendiente', 'parcial', 'vencida']),
      supabase.from('facturas_compra').select('total, fecha_vencimiento, estado').neq('estado', 'pagada').neq('estado', 'anulada'),
      supabase.from('cheques').select('importe, fecha_pago, tipo, estado').in('estado', ['cartera', 'emitido']).lte('fecha_pago', en7)
    ]).then(([ve, mv, cu, pc, pp, ch]) => {
      if (!vivo) return
      setF({ ventas: ve.data || [], mov: mv.data || [], cuentas: cu.data || [], porCobrar: pc.data || [], porPagar: pp.data || [], cheques: ch.data || [] })
    })
    return () => { vivo = false }
  }, [esAdmin, kpis.ingresosMes])

  const d = useMemo(() => {
    if (!f) return null
    const hoy = new Date()
    const meses = Array.from({ length: 6 }, (_, i) => { const x = new Date(hoy.getFullYear(), hoy.getMonth() - 5 + i, 1); return { k: iso(x).slice(0, 7), n: MES[x.getMonth()], v: 0 } })
    f.ventas.forEach(v => { const m = meses.find(x => x.k === String(v.fecha_emision).slice(0, 7)); if (m) m.v += Number(v.subtotal ?? v.total) })
    const max = Math.max(...meses.map(m => m.v), 1)
    const ing = f.mov.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0)
    const egr = f.mov.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0)
    const porCobrar = f.porCobrar.reduce((a, x) => a + Number(x.total), 0)
    const porPagar = f.porPagar.reduce((a, x) => a + Number(x.total), 0)
    const saldo = f.cuentas.reduce((a, c) => a + Number(c.saldo), 0)
    const hoyS = iso(hoy)
    const semana = Array.from({ length: 7 }, (_, i) => {
      const dt = sumar(hoy, i), k = iso(dt)
      return {
        k, dia: DIA[dt.getDay()], num: dt.getDate(), hoy: i === 0,
        cobros: f.porCobrar.filter(x => (i === 0 ? x.fecha_vencimiento <= k : x.fecha_vencimiento === k)).length,
        pagos: f.porPagar.filter(x => (i === 0 ? x.fecha_vencimiento <= k : x.fecha_vencimiento === k)).length,
        cheques: f.cheques.filter(x => (i === 0 ? x.fecha_pago <= k : x.fecha_pago === k)).length
      }
    })
    return { meses, max, ing, egr, porCobrar, porPagar, saldo, semana, vencidasCobro: f.porCobrar.filter(x => x.fecha_vencimiento < hoyS).reduce((a, x) => a + Number(x.total), 0) }
  }, [f])

  const fechaTxt = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const cobradoPct = d && (d.ing + d.porCobrar) > 0 ? d.ing / (d.ing + d.porCobrar) : 0
  const colorAlerta = { danger: '#f87171', warning: '#fbbf24', info: '#60a5fa' }
  const grid = (cols, extra = {}) => ({ display: 'grid', gridTemplateColumns: cols, gap: 16, ...extra })

  return (
    <div style={{
      borderRadius: 32, padding: 'clamp(12px, 2.4vw, 26px)', minHeight: '80vh',
      background: 'radial-gradient(900px 500px at 8% -10%, rgba(147,197,253,0.65), transparent 60%), radial-gradient(800px 500px at 100% 10%, rgba(191,219,254,0.8), transparent 55%), linear-gradient(160deg, #f8fbff 0%, #e8f0fe 100%)'
    }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 13, color: GRIS, textTransform: 'capitalize' }}>{fechaTxt}</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 600, color: TINTA, letterSpacing: '-0.02em' }}>Hola, {nombre} <span style={{ color: AZUL }}>·</span> Briseo SRL</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ ...vidrio, padding: 4, borderRadius: 999, display: 'flex' }}>
            {[['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes']].map(([id, l]) => <button key={id} style={pill(filtroPeriodo === id)} onClick={() => setFiltroPeriodo(id)}>{l}</button>)}
          </div>
          <button onClick={onActualizar} disabled={actualizando} title="Actualizar" style={{ ...vidrio, padding: '9px 14px', borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: TINTA, fontSize: 12.5, fontWeight: 600 }}>
            <RefreshCw size={14} className={actualizando ? 'sg-girar' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {/* Banda de indicadores */}
      <div style={grid('repeat(auto-fit, minmax(210px, 1fr))', { marginBottom: 16 })}>
        {esAdmin && (
          <div style={vidrio}>
            <div style={{ fontSize: 12, color: GRIS }}>Ingresos cobrados · {metrica.etiquetaPeriodo}</div>
            <div style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 700, color: TINTA, letterSpacing: '-0.02em' }}>{ars(metrica.ingresos)}</div>
            <div style={{ fontSize: 12, color: GRIS }}>{metrica.cantIngresos} cobranzas registradas</div>
            <div style={{ height: 8, borderRadius: 99, background: 'rgba(37,99,235,0.12)', marginTop: 12 }}><div style={{ width: `${Math.round(cobradoPct * 100)}%`, height: 8, borderRadius: 99, background: AZUL }} /></div>
            <div style={{ fontSize: 11, color: GRIS, marginTop: 4 }}>{Math.round(cobradoPct * 100)}% cobrado vs. pendiente</div>
          </div>
        )}
        {esAdmin && (
          <div style={vidrio}>
            <div style={{ fontSize: 12, color: GRIS }}>Por cobrar</div>
            <div style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 700, color: TINTA, letterSpacing: '-0.02em' }}>{d ? corto(d.porCobrar) : '—'}</div>
            <div style={{ fontSize: 12, color: d?.vencidasCobro > 0 ? '#dc2626' : GRIS }}>{d ? `${ars(d.vencidasCobro)} vencido` : ''} · {kpis.facturasPendientes} facturas</div>
            <div style={{ height: 8, borderRadius: 99, background: 'rgba(37,99,235,0.12)', marginTop: 12 }}><div style={{ width: `${d && d.porCobrar ? Math.min(100, (d.vencidasCobro / d.porCobrar) * 100) : 0}%`, height: 8, borderRadius: 99, background: '#f87171' }} /></div>
            <div style={{ fontSize: 11, color: GRIS, marginTop: 4 }}>parte vencida</div>
          </div>
        )}
        <div style={vidrio}>
          <div style={{ fontSize: 12, color: GRIS }}>Operación</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            {[[kpis.clientes, 'Clientes'], [kpis.contratos, 'Contratos'], [kpis.empleados, 'Personal']].map(([n, l]) => (
              <div key={l}><div style={{ fontSize: 'clamp(24px, 3.4vw, 32px)', fontWeight: 700, color: TINTA }}>{n}</div><div style={{ fontSize: 11, color: GRIS }}>{l}</div></div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: GRIS, marginTop: 10 }}>{metrica.servicios} servicios · {metrica.etiquetaPeriodo.toLowerCase()}</div>
        </div>
      </div>

      {/* Tarjetas principales */}
      <div style={grid('repeat(auto-fit, minmax(290px, 1fr))', { marginBottom: 16 })}>
        {esAdmin && (
          <div style={vidrio}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: TINTA }}>Ventas netas</strong><span style={{ fontSize: 12, color: GRIS }}>últimos 6 meses</span></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150, marginTop: 14 }}>
              {(d?.meses || []).map((m, i, arr) => (
                <div key={m.k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 10, color: GRIS }}>{corto(m.v)}</span>
                  <div style={{ width: '100%', maxWidth: 34, height: `${Math.max(4, (m.v / d.max) * 100)}%`, borderRadius: 99, background: i === arr.length - 1 ? `linear-gradient(180deg, ${AZUL}, #1d4ed8)` : `linear-gradient(180deg, ${AZUL_CLARO}, #bfdbfe)` }} />
                  <span style={{ fontSize: 11, color: GRIS }}>{m.n}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {esAdmin && (
          <div style={vidrio}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: TINTA }}>Caja del mes</strong><button onClick={() => onIr('finanzas')} style={{ border: 0, background: 'rgba(255,255,255,.8)', borderRadius: 99, width: 30, height: 30, cursor: 'pointer' }}><ArrowUpRight size={15} /></button></div>
            <Anillo valor={d && (d.ing + d.egr) > 0 ? d.ing / (d.ing + d.egr) : 0} texto={d ? corto(d.ing - d.egr) : '—'} sub="neto del mes" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginTop: 8 }}>
              <span style={{ color: '#059669' }}>▲ {d ? ars(d.ing) : ''}</span><span style={{ color: '#dc2626' }}>▼ {d ? ars(d.egr) : ''}</span>
            </div>
            <div style={{ fontSize: 12, color: GRIS, marginTop: 6, textAlign: 'center' }}>Saldo en cuentas: <strong style={{ color: TINTA }}>{d ? ars(d.saldo) : '—'}</strong> · Por pagar: <strong style={{ color: TINTA }}>{d ? corto(d.porPagar) : '—'}</strong></div>
          </div>
        )}
        <div style={oscuro}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>Alertas y tareas</strong>
            <span style={{ fontSize: 12, background: alertas.length ? '#facc15' : 'rgba(255,255,255,.15)', color: alertas.length ? '#0f172a' : '#cbd5e1', borderRadius: 99, padding: '2px 10px', fontWeight: 700 }}>{alertas.length}</span>
          </div>
          <div style={{ maxHeight: 290, overflowY: 'auto' }}>
            {alertas.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>Sin alertas operativas. Todo en orden.</p>}
            {alertas.map((a, i) => (
              <div key={i} onClick={() => a.modulo && onIr(a.modulo)} style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: i ? '1px solid rgba(255,255,255,.08)' : 0, cursor: a.modulo ? 'pointer' : 'default' }}>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: colorAlerta[a.tipo] || '#60a5fa', marginTop: 5, flex: '0 0 10px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.titulo}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detalle}</div>
                </div>
                {a.monto > 0 && <span style={{ fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{ars(a.monto)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Semana: vencimientos */}
      {esAdmin && d && (
        <div style={{ ...vidrio, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><strong style={{ color: TINTA }}>Esta semana</strong><span style={{ fontSize: 12, color: GRIS }}>vencimientos de cobros, pagos y cheques</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
            {d.semana.map(x => (
              <div key={x.k} style={{ borderRadius: 18, padding: '10px 4px', textAlign: 'center', background: x.hoy ? TINTA : 'rgba(255,255,255,0.6)', color: x.hoy ? '#fff' : TINTA, border: '1px solid rgba(255,255,255,.8)' }}>
                <div style={{ fontSize: 11, opacity: .7 }}>{x.dia}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{x.num}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap', minHeight: 14 }}>
                  {x.cobros > 0 && <span title="Cobros" style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8', borderRadius: 99, padding: '0 6px' }}>{x.cobros}</span>}
                  {x.pagos > 0 && <span title="Pagos" style={{ fontSize: 10, background: '#fee2e2', color: '#b91c1c', borderRadius: 99, padding: '0 6px' }}>{x.pagos}</span>}
                  {x.cheques > 0 && <span title="Cheques" style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', borderRadius: 99, padding: '0 6px' }}>{x.cheques}</span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: GRIS, marginTop: 8 }}>
            <span style={{ color: '#1d4ed8' }}>● cobros</span> · <span style={{ color: '#b91c1c' }}>● pagos</span> · <span style={{ color: '#b45309' }}>● cheques</span> · el día de hoy incluye lo vencido
          </div>
        </div>
      )}

      {/* Accesos */}
      <div style={vidrio}>
        <button onClick={() => setVerModulos(!verModulos)} style={{ border: 0, background: 'none', cursor: 'pointer', display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', color: TINTA, fontWeight: 700, fontSize: 14, padding: 0 }}>
          Accesos a módulos {verModulos ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {verModulos && grupos.map(g => (
          <div key={g.label} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: GRIS, marginBottom: 8 }}>{g.label}</div>
            <div style={grid('repeat(auto-fill, minmax(180px, 1fr))', { gap: 10 })}>
              {g.items.map(it => { const I = it.icon; return (
                <button key={it.id} onClick={() => onIr(it.id)} style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.65)', borderRadius: 18, padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ background: '#dbeafe', borderRadius: 12, padding: 8, display: 'flex' }}><I size={16} color={AZUL} /></span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TINTA }}>{it.label}</span>
                </button>) })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
