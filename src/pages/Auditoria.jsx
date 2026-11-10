import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { RefreshCw } from 'lucide-react'

const TABLAS = {
  facturas: 'Facturas de venta', pagos: 'Cobros', retenciones_cobro: 'Retenciones', facturas_compra: 'Facturas de compra', pagos_compra: 'Pagos a proveedores',
  movimientos_financieros: 'Movimientos de fondos', cuentas_bancarias: 'Cuentas bancarias', cheques: 'Cheques', compromisos_pago: 'Compromisos de pago', prestamos: 'Préstamos',
  costos_fijos: 'Costos fijos', costos_variables: 'Costos variables', liquidaciones_sueldo: 'Liquidaciones de sueldo', asignaciones_empleado: 'Asignación de personal',
  horarios_servicio: 'Horarios de servicio', documentos: 'Documentos', empleados: 'Empleados', clientes: 'Clientes', contratos: 'Contratos', proveedores: 'Proveedores', usuarios_sistema: 'Usuarios'
}
const OP = { INSERT: ['Alta', '#15803D', '#DCFCE7'], UPDATE: ['Modificación', '#B45309', '#FEF3C7'], DELETE: ['Baja', '#BE123C', '#FFE4E6'] }
const RUIDO = new Set(['creado_en', 'actualizado_en', 'updated_at', 'created_at'])
const CLAVES = ['razon_social', 'nombre', 'apellido', 'numero_factura', 'numero_contrato', 'numero', 'descripcion', 'concepto', 'entidad', 'banco', 'categoria', 'email', 'periodo', 'monto', 'total', 'importe', 'total_neto']
const corto = v => { const t = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '—'); return t.length > 40 ? t.slice(0, 40) + '…' : t }
const hora = f => new Date(f).toLocaleString('es-AR', { timeZone: 'America/Argentina/Tucuman', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

function resumen(a) {
  const d = a.datos || {}
  if (a.operacion === 'UPDATE') return Object.entries(d).filter(([k]) => !RUIDO.has(k)).map(([k, v]) => `${k}: ${corto(v?.antes)} → ${corto(v?.despues)}`)
  return CLAVES.filter(k => d[k] != null && d[k] !== '').slice(0, 5).map(k => `${k}: ${corto(d[k])}`)
}

// Auditoría: quién cambió qué y cuándo (solo administradores)
export default function Auditoria() {
  const [filas, setFilas] = useState([])
  const [tabla, setTabla] = useState('')
  const [op, setOp] = useState('')
  const [texto, setTexto] = useState('')
  const [desde, setDesde] = useState('')
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    let q = supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(500)
    if (tabla) q = q.eq('tabla', tabla)
    if (op) q = q.eq('operacion', op)
    if (desde) q = q.gte('fecha', desde)
    const { data, error: e } = await q
    if (e) setError(/auditoria|schema cache/i.test(e.message) ? 'La auditoría no está activada: ejecutá seguridad_softgestion.sql en Supabase.' : e.message); else { setError(''); setFilas(data || []) }
    setCargando(false)
  }, [tabla, op, desde])
  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase()
    return t ? filas.filter(a => `${a.usuario} ${a.tabla} ${JSON.stringify(a.datos)}`.toLowerCase().includes(t)) : filas
  }, [filas, texto])

  return (
    <div>
      <div style={{ ...s.card, padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><label style={s.label}>Qué</label><select style={s.input} value={tabla} onChange={e => setTabla(e.target.value)}><option value="">Todo</option>{Object.entries(TABLAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label style={s.label}>Acción</label><select style={s.input} value={op} onChange={e => setOp(e.target.value)}><option value="">Todas</option>{Object.entries(OP).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></div>
        <div><label style={s.label}>Desde</label><input type="date" style={s.input} value={desde} onChange={e => setDesde(e.target.value)} /></div>
        <div style={{ flex: 1, minWidth: 180 }}><label style={s.label}>Buscar (usuario, dato…)</label><input style={s.input} value={texto} onChange={e => setTexto(e.target.value)} /></div>
        <button style={s.btnSecundario} onClick={cargar}><RefreshCw size={13} /> Actualizar</button>
      </div>
      {error && <div style={{ ...s.card, padding: 12, color: paleta.danger, background: paleta.dangerSoft }}>{error}</div>}
      <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['Fecha y hora', 'Usuario', 'Acción', 'Qué', 'Detalle'].map(h => <th key={h} style={{ ...s.tablaCabecera(), padding: '8px 10px' }}>{h}</th>)}</tr></thead>
          <tbody>
            {visibles.map(a => { const [lbl, col, bg] = OP[a.operacion] || [a.operacion, paleta.muted, paleta.surfaceMuted]; const r = resumen(a); return (
              <tr key={a.id} style={{ borderTop: `1px solid ${paleta.line}`, cursor: 'pointer', verticalAlign: 'top' }} onClick={() => setAbierto(abierto === a.id ? null : a.id)}>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{hora(a.fecha)}</td>
                <td style={{ padding: '6px 10px' }}>{a.usuario}</td>
                <td style={{ padding: '6px 10px' }}><span style={{ background: bg, color: col, borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{lbl}</span></td>
                <td style={{ padding: '6px 10px' }}>{TABLAS[a.tabla] || a.tabla}</td>
                <td style={{ padding: '6px 10px', fontSize: 12.5, color: paleta.inkSoft }}>
                  {abierto === a.id ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11.5 }}>{JSON.stringify(a.datos, null, 2)}</pre> : (r.length ? r.map((x, i) => <div key={i}>{x}</div>) : <span style={{ color: paleta.muted }}>—</span>)}
                </td>
              </tr>) })}
          </tbody>
        </table>
        {!cargando && visibles.length === 0 && !error && <div style={{ padding: 14, color: paleta.muted }}>No hay movimientos para mostrar.</div>}
      </div>
      <p style={{ color: paleta.muted, fontSize: 12 }}>Se muestran los últimos 500 cambios. Tocá una fila para ver el detalle completo.</p>
    </div>
  )
}
