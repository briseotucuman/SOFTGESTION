import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { CheckCircle2, AlertTriangle, Info, ArrowUpRight, RefreshCw } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const hoyISO = () => new Date().toLocaleDateString('en-CA')
const c = colores.reportes

// Control y cierre: controles automáticos de lo que falta o está inconsistente, para que los números sean confiables
export default function ControlDatos({ onIr }) {
  const [mes, setMes] = useState(hoyISO().slice(0, 7))
  const [checks, setChecks] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  async function cargar() {
    setCargando(true)
    const [anio, m] = mes.split('-').map(Number)
    const ini = `${mes}-01`, fin = `${mes}-${String(new Date(anio, m, 0).getDate()).padStart(2, '0')}`
    const hoy = hoyISO()
    const res = await Promise.all([
      supabase.from('facturas').select('id, total, fecha_vencimiento, fecha_emision, estado, cliente_id').neq('estado', 'anulada'),
      supabase.from('pagos').select('factura_id, monto'),
      supabase.from('cheques').select('importe, fecha_pago, estado').in('estado', ['cartera', 'emitido', 'depositado']).lt('fecha_pago', hoy),
      supabase.from('movimientos_financieros').select('id, monto').is('cuenta_id', null).gte('fecha', ini).lte('fecha', fin),
      supabase.from('facturas_compra').select('id, total, cliente_id, estado, fecha_vencimiento').neq('estado', 'anulada'),
      supabase.from('empleados').select('id, nombre, apellido, salario_base').eq('activo', true),
      supabase.from('parametros').select('valor').eq('clave', 'cargas_sociales_pct').maybeSingle(),
      supabase.from('horarios_servicio').select('empleado_id, empleado_nombre, cliente_id').eq('activo', true),
      supabase.from('liquidaciones_sueldo').select('empleado_id').eq('periodo', mes),
      supabase.from('clientes').select('id, razon_social, cuit').eq('activo', true),
      supabase.from('contratos').select('cliente_id').eq('estado', 'activo')
    ])
    const err = res.find(r => r.error); setError(err ? err.error.message : '')
    const [fa, pg, ch, mv, fc, em, par, ho, li, cl, co] = res.map(r => r.data || [])
    const cargas = Number(res[6].data?.valor || 0)
    const cobrado = {}; pg.forEach(p => { cobrado[p.factura_id] = (cobrado[p.factura_id] || 0) + Number(p.monto) })
    const abiertas = fa.filter(f => ['emitida', 'pendiente', 'parcial', 'vencida'].includes(f.estado))
    const vencidas = abiertas.filter(f => f.fecha_vencimiento && f.fecha_vencimiento < hoy)
    const incons = fa.filter(f => {
      const cb = cobrado[f.id] || 0
      return (['emitida', 'pendiente', 'parcial', 'vencida'].includes(f.estado) && cb >= Number(f.total) - 0.01 && Number(f.total) > 0) ||
             (['pagada', 'cobrada'].includes(f.estado) && cb < Number(f.total) - 0.01) || cb > Number(f.total) + 0.01
    })
    const sinCliente = fc.filter(f => !f.cliente_id)
    const comprasVenc = fc.filter(f => f.estado !== 'pagada' && f.fecha_vencimiento && f.fecha_vencimiento < hoy)
    const sinSueldo = em.filter(e => !(Number(e.salario_base) > 0))
    const horSinEmp = ho.filter(h => !h.empleado_id)
    const horSinCli = ho.filter(h => !h.cliente_id)
    const liquidados = new Set(li.map(l => l.empleado_id))
    const sinLiq = em.filter(e => !liquidados.has(e.id))
    const sinCuit = cl.filter(x => !x.cuit)
    const facMes = new Set(fa.filter(f => f.fecha_emision >= ini && f.fecha_emision <= fin).map(f => f.cliente_id))
    const sinFacturar = [...new Set(co.map(x => x.cliente_id))].filter(id => !facMes.has(id))
    const sum = (arr, k) => arr.reduce((a, x) => a + Number(x[k] || 0), 0)
    const saldo = f => Number(f.total) - (cobrado[f.id] || 0)

    setChecks([
      { grupo: 'Cierre del mes', sev: 'warn', n: sinFacturar.length, titulo: 'Clientes con contrato activo sin factura en el mes', det: sinFacturar.length ? `${sinFacturar.length} clientes: ${sinFacturar.map(id => cl.find(x => x.id === id)?.razon_social).filter(Boolean).slice(0, 4).join(', ')}${sinFacturar.length > 4 ? '…' : ''}` : 'Todos facturados', ir: 'facturacion' },
      { grupo: 'Cierre del mes', sev: 'warn', n: sinLiq.length, titulo: 'Liquidaciones de sueldo sin cargar', det: sinLiq.length ? sinLiq.map(e => `${e.apellido} ${e.nombre}`).slice(0, 4).join(', ') + (sinLiq.length > 4 ? '…' : '') : 'Todas cargadas', ir: 'sueldos' },
      { grupo: 'Cierre del mes', sev: 'warn', n: mv.length, titulo: 'Movimientos del mes sin cuenta bancaria', det: mv.length ? `${ars(sum(mv, 'monto'))} que no impactan ningún saldo` : 'Todos con cuenta', ir: 'finanzas' },
      { grupo: 'Cobros y pagos', sev: 'danger', n: vencidas.length, titulo: 'Facturas de venta vencidas sin cobrar', det: vencidas.length ? `${ars(vencidas.reduce((a, f) => a + saldo(f), 0))} por cobrar vencido` : 'Sin deuda vencida', ir: 'facturacion' },
      { grupo: 'Cobros y pagos', sev: 'danger', n: incons.length, titulo: 'Facturas con estado que no coincide con los cobros', det: incons.length ? 'Revisá el estado o los cobros cargados (cobradas de más o estado desactualizado)' : 'Todo coincide', ir: 'facturacion' },
      { grupo: 'Cobros y pagos', sev: 'warn', n: comprasVenc.length, titulo: 'Facturas de compra vencidas sin pagar', det: comprasVenc.length ? ars(sum(comprasVenc, 'total')) : 'Sin deuda vencida', ir: 'finanzas' },
      { grupo: 'Cobros y pagos', sev: 'danger', n: ch.length, titulo: 'Cheques vencidos sin depositar o debitar', det: ch.length ? `${ars(sum(ch, 'importe'))} pendientes de gestión` : 'Ninguno', ir: 'finanzas' },
      { grupo: 'Rentabilidad por cliente', sev: 'info', n: sinCliente.length, titulo: 'Compras sin cliente asignado', det: sinCliente.length ? `${ars(sum(sinCliente, 'total'))} que no restan a ningún cliente (las de uso general pueden quedar así)` : 'Todas asignadas', ir: 'finanzas' },
      { grupo: 'Rentabilidad por cliente', sev: 'warn', n: sinSueldo.length, titulo: 'Empleados sin sueldo base cargado', det: sinSueldo.length ? sinSueldo.map(e => `${e.apellido} ${e.nombre}`).slice(0, 4).join(', ') : 'Todos con sueldo', ir: 'personal' },
      { grupo: 'Rentabilidad por cliente', sev: 'warn', n: cargas > 0 ? 0 : 1, titulo: 'Cargas sociales sin definir (0%)', det: cargas > 0 ? `${cargas}% configurado` : 'El costo del personal está subestimado. Se carga en Finanzas > Personal por cliente', ir: 'finanzas' },
      { grupo: 'Rentabilidad por cliente', sev: 'warn', n: horSinEmp.length, titulo: 'Horarios con empleado sin vincular', det: horSinEmp.length ? [...new Set(horSinEmp.map(h => h.empleado_nombre))].join(', ') + ' (darlos de alta en Personal)' : 'Todos vinculados', ir: 'personal' },
      { grupo: 'Rentabilidad por cliente', sev: 'info', n: horSinCli.length, titulo: 'Horarios sin cliente asignado', det: horSinCli.length ? 'Esas horas cuentan como gasto general' : 'Todos con cliente', ir: 'finanzas' },
      { grupo: 'Datos maestros', sev: 'info', n: sinCuit.length, titulo: 'Clientes sin CUIT', det: sinCuit.length ? sinCuit.map(x => x.razon_social).slice(0, 4).join(', ') : 'Todos con CUIT', ir: 'clientes' }
    ])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [mes]) // eslint-disable-line react-hooks/exhaustive-deps

  const colorSev = { danger: '#dc2626', warn: '#d97706', info: '#2563eb' }
  const enOrden = checks ? checks.filter(x => x.n === 0).length : 0
  const grupos = checks ? [...new Set(checks.map(x => x.grupo))] : []

  return (
    <div>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={s.cabeceraTexto}>Control y cierre</h3>
          <p style={s.cabeceraSubtexto}>{checks ? `${enOrden} de ${checks.length} controles en orden` : 'Revisando…'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ ...s.input, width: 'auto' }} />
          <button style={s.btnSecundario} onClick={cargar}><RefreshCw size={14} /> Revisar</button>
        </div>
      </div>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 12, marginBottom: 10 }}>No se pudo revisar parte de los datos: {error}</div>}
      {cargando && <p style={{ color: '#64748b' }}>Revisando…</p>}
      {!cargando && grupos.map(g => (
        <div key={g} style={s.card}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b', marginBottom: 6 }}>{g}</div>
          {checks.filter(x => x.grupo === g).map(x => {
            const ok = x.n === 0, col = colorSev[x.sev]
            const I = ok ? CheckCircle2 : x.sev === 'info' ? Info : AlertTriangle
            return (
              <div key={x.titulo} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(148,163,184,.25)' }}>
                <I size={20} color={ok ? '#059669' : col} style={{ flex: '0 0 20px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{x.titulo}{!ok && x.n > 0 && <span style={{ marginLeft: 8, ...s.badge(col + '22', col) }}>{x.n}</span>}</div>
                  <div style={{ fontSize: 12.5, color: '#64748b' }}>{x.det}</div>
                </div>
                {!ok && <button style={s.btnSecundario} onClick={() => onIr(x.ir)}>Ir <ArrowUpRight size={13} /></button>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
