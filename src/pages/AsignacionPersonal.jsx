import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s } from '../estilos.js'
import { Plus, Trash2 } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const hoy = () => new Date().toLocaleDateString('en-CA')
const nombreCli = c => c?.razon_social || c?.nombre_contacto || 'Sin nombre'

// Qué porcentaje del costo de cada empleado se imputa a cada cliente (el resto queda como gasto general)
export default function AsignacionPersonal() {
  const [emp, setEmp] = useState([])
  const [cli, setCli] = useState([])
  const [asig, setAsig] = useState([])
  const [cargas, setCargas] = useState('0')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState(null) // { empleado_id, cliente_id, porcentaje, desde, hasta }

  async function cargar() {
    const res = await Promise.all([
      supabase.from('empleados').select('id, nombre, apellido, puesto, salario_base').eq('activo', true).order('apellido'),
      supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true),
      supabase.from('asignaciones_empleado').select('*').order('desde', { ascending: false }),
      supabase.from('parametros').select('valor').eq('clave', 'cargas_sociales_pct').maybeSingle()
    ])
    const err = res.find(r => r.error); setError(err ? err.error.message : '')
    setEmp(res[0].data || []); setCli(res[1].data || []); setAsig(res[2].data || [])
    setCargas(String(res[3].data?.valor ?? 0)); setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const vigentes = a => a.desde <= hoy() && (!a.hasta || a.hasta >= hoy())
  const pctVigente = id => asig.filter(a => a.empleado_id === id && vigentes(a)).reduce((a, x) => a + Number(x.porcentaje), 0)
  const costoMensual = e => Number(e.salario_base || 0) * (1 + (parseFloat(cargas) || 0) / 100)
  const resumen = useMemo(() => emp.reduce((a, e) => {
    const p = pctVigente(e.id); return { total: a.total + costoMensual(e), asignado: a.asignado + costoMensual(e) * p / 100 }
  }, { total: 0, asignado: 0 }), [emp, asig, cargas]) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardarCargas() {
    const v = parseFloat(cargas) || 0
    const { error } = await supabase.from('parametros').upsert({ clave: 'cargas_sociales_pct', valor: v })
    if (error) alert('No se pudo guardar: ' + error.message)
  }
  async function guardarNuevo(e) {
    e.preventDefault()
    const p = parseFloat(nuevo.porcentaje)
    if (!nuevo.cliente_id) { alert('Elegí el cliente'); return }
    if (!(p > 0 && p <= 100)) { alert('El porcentaje debe estar entre 1 y 100'); return }
    if (nuevo.hasta && nuevo.hasta < nuevo.desde) { alert('"Hasta" no puede ser anterior a "Desde"'); return }
    // Evitar pasar de 100% entre asignaciones que se superponen
    const solapa = asig.filter(a => a.empleado_id === nuevo.empleado_id && a.desde <= (nuevo.hasta || '9999-12-31') && (!a.hasta || a.hasta >= nuevo.desde))
    if (solapa.reduce((a, x) => a + Number(x.porcentaje), 0) + p > 100.001) { alert('Con esta asignación el empleado superaría el 100% en esas fechas'); return }
    const { error } = await supabase.from('asignaciones_empleado').insert([{ empleado_id: nuevo.empleado_id, cliente_id: nuevo.cliente_id, porcentaje: p, desde: nuevo.desde, hasta: nuevo.hasta || null }])
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setNuevo(null); cargar()
  }
  async function quitar(id) {
    if (!window.confirm('¿Quitar esta asignación?')) return
    await supabase.from('asignaciones_empleado').delete().eq('id', id); cargar()
  }

  if (cargando) return <p style={{ color: '#64748b', padding: 16 }}>Cargando…</p>
  return (
    <div>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 8, marginBottom: 10 }}>Error: {error}</div>}
      <div style={{ ...s.card, padding: 14, marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '0 0 190px' }}>
          <label style={s.label}>Cargas sociales sobre sueldo (%)</label>
          <input type="number" step="0.1" style={s.input} value={cargas} onChange={e => setCargas(e.target.value)} onBlur={guardarCargas} />
        </div>
        <div style={{ fontSize: 13, color: '#475569', flex: 1, minWidth: 220 }}>
          Costo mensual del personal: <strong>{ars(resumen.total)}</strong> · Imputado a clientes: <strong>{ars(resumen.asignado)}</strong> · General: <strong>{ars(resumen.total - resumen.asignado)}</strong>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Se usa el sueldo liquidado del mes si existe; si no, el sueldo base más estas cargas.</div>
        </div>
      </div>

      {emp.map(e => {
        const lista = asig.filter(a => a.empleado_id === e.id)
        const p = pctVigente(e.id)
        return (
          <div key={e.id} style={{ ...s.card, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong>{e.apellido} {e.nombre}</strong><span style={{ color: '#64748b', fontSize: 13 }}>{e.puesto || ''}</span>
              <span style={{ fontSize: 13 }}>Costo mensual: {ars(costoMensual(e))}</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: p > 100 ? '#dc2626' : '#475569' }}>Hoy: {p}% a clientes · {100 - p}% general</span>
              <button style={s.btnSecundario} onClick={() => setNuevo({ empleado_id: e.id, cliente_id: '', porcentaje: String(Math.max(0, 100 - p) || ''), desde: hoy(), hasta: '' })}><Plus size={13} style={{ verticalAlign: '-2px' }} /> Asignar</button>
            </div>
            {lista.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '5px 0', borderTop: '1px solid #f1f5f9', marginTop: 6, alignItems: 'center' }}>
                <span style={{ flex: 1 }}>{nombreCli(cli.find(c => c.id === a.cliente_id))}</span>
                <span style={{ width: 60, textAlign: 'right' }}>{Number(a.porcentaje)}%</span>
                <span style={{ width: 70, textAlign: 'right' }}>{ars(costoMensual(e) * Number(a.porcentaje) / 100)}</span>
                <span style={{ width: 190, color: '#64748b' }}>{a.desde.split('-').reverse().join('/')} → {a.hasta ? a.hasta.split('-').reverse().join('/') : 'vigente'}</span>
                <button onClick={() => quitar(a.id)} style={{ border: 0, background: 'none', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )
      })}
      {emp.length === 0 && <p style={{ color: '#64748b' }}>No hay empleados activos.</p>}

      {nuevo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <form onSubmit={guardarNuevo} style={{ background: '#fff', borderRadius: 14, padding: 20, width: 'min(440px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 12px' }}>Asignar a un cliente</h4>
            <div style={s.grid2}>
              <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Cliente</label>
                <select style={s.input} value={nuevo.cliente_id} onChange={e => setNuevo({ ...nuevo, cliente_id: e.target.value })}>
                  <option value="">Seleccionar…</option>{cli.map(c => <option key={c.id} value={c.id}>{nombreCli(c)}</option>)}
                </select></div>
              <div><label style={s.label}>% del costo</label><input type="number" step="0.01" style={s.input} value={nuevo.porcentaje} onChange={e => setNuevo({ ...nuevo, porcentaje: e.target.value })} /></div>
              <div />
              <div><label style={s.label}>Desde</label><input type="date" style={s.input} value={nuevo.desde} onChange={e => setNuevo({ ...nuevo, desde: e.target.value })} required /></div>
              <div><label style={s.label}>Hasta (opcional)</label><input type="date" style={s.input} value={nuevo.hasta} onChange={e => setNuevo({ ...nuevo, hasta: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" style={s.btnSecundario} onClick={() => setNuevo(null)}>Cancelar</button>
              <button type="submit" style={s.btnPrimario('#1e40af')}>Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
