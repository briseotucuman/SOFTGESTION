import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s } from '../estilos.js'
import { Plus, Trash2 } from 'lucide-react'

const DIAS = ['L', 'M', 'Mi', 'J', 'V', 'S', 'D']
const nombreCli = c => c?.razon_social || c?.nombre_contacto || 'Sin nombre'
const hh = t => String(t).slice(0, 5)
export const duracion = h => { const [a, b] = [h.hora_desde, h.hora_hasta].map(t => { const [x, y] = String(t).split(':'); return Number(x) + Number(y) / 60 }); return b - a }
const horasSemana = h => duracion(h) * (h.dias || []).length
const textoDias = d => {
  const x = [...d].sort()
  if (x.join() === '1,2,3,4,5') return 'L a V'
  return x.map(n => DIAS[n - 1]).join(' - ')
}
const fmtH = n => (Math.round(n * 10) / 10).toString().replace('.', ',')
const VACIO = { empleado_id: '', empleado_nombre: '', cliente_id: '', sucursal_id: '', lugar: '', dias: [1, 2, 3, 4, 5], hora_desde: '07:00', hora_hasta: '12:00' }

// Horarios fijos de servicio: quién trabaja dónde, qué días y en qué franja. Base para repartir el costo del personal por horas.
export default function HorariosServicio() {
  const [filas, setFilas] = useState([])
  const [emp, setEmp] = useState([])
  const [cli, setCli] = useState([])
  const [suc, setSuc] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)

  async function cargar() {
    const res = await Promise.all([
      supabase.from('horarios_servicio').select('*').eq('activo', true).order('lugar'),
      supabase.from('empleados').select('id, nombre, apellido').eq('activo', true).order('apellido'),
      supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true),
      supabase.from('sucursales').select('id, nombre, cliente_id').eq('activa', true)
    ])
    const err = res.find(r => r.error); setError(err ? err.error.message : '')
    setFilas(res[0].data || []); setEmp(res[1].data || []); setCli(res[2].data || []); setSuc(res[3].data || []); setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const grupos = useMemo(() => {
    const m = {}
    filas.forEach(f => { const k = f.cliente_id || 'sin'; (m[k] ||= []).push(f) })
    return Object.entries(m).map(([k, lista]) => ({ k, nombre: k === 'sin' ? 'Sin cliente asignado' : nombreCli(cli.find(c => c.id === k)), lista, horas: lista.reduce((a, f) => a + horasSemana(f), 0) }))
      .sort((a, b) => (a.k === 'sin') - (b.k === 'sin') || b.horas - a.horas)
  }, [filas, cli])

  async function actualizar(id, cambios) {
    const { error } = await supabase.from('horarios_servicio').update(cambios).eq('id', id)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    cargar()
  }
  async function quitar(id) { if (window.confirm('¿Quitar este horario?')) { await supabase.from('horarios_servicio').delete().eq('id', id); cargar() } }
  async function guardarNuevo(e) {
    e.preventDefault()
    if (!form.dias.length) { alert('Elegí al menos un día'); return }
    if (form.hora_hasta <= form.hora_desde) { alert('La hora de fin debe ser posterior a la de inicio'); return }
    if (!form.lugar.trim()) { alert('Indicá el lugar o dirección'); return }
    const e1 = emp.find(x => x.id === form.empleado_id)
    const { error } = await supabase.from('horarios_servicio').insert([{
      empleado_id: form.empleado_id || null, empleado_nombre: e1 ? e1.nombre : form.empleado_nombre || null,
      cliente_id: form.cliente_id || null, sucursal_id: form.sucursal_id || null, lugar: form.lugar.trim(),
      dias: form.dias, hora_desde: form.hora_desde, hora_hasta: form.hora_hasta
    }])
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setForm(null); cargar()
  }

  if (cargando) return <p style={{ color: '#64748b', padding: 16 }}>Cargando…</p>
  const sinEmp = filas.filter(f => !f.empleado_id)
  const totSem = filas.reduce((a, f) => a + horasSemana(f), 0)

  return (
    <div>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 8, marginBottom: 10 }}>Error: {error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#475569' }}>{filas.length} horarios · <strong>{fmtH(totSem)} hs semanales</strong> en total</span>
        <button style={{ ...s.btnPrimario('#1e40af'), marginLeft: 'auto' }} onClick={() => setForm({ ...VACIO })}><Plus size={14} style={{ verticalAlign: '-2px' }} /> Nuevo horario</button>
      </div>
      {sinEmp.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 }}>
          {sinEmp.length} horarios tienen un empleado sin vincular ({[...new Set(sinEmp.map(f => f.empleado_nombre))].join(', ')}). Mientras no estén cargados en Personal y vinculados acá, sus horas se ven pero no suman costo a ningún cliente.
        </div>
      )}
      {grupos.map(g => (
        <div key={g.k} style={{ ...s.card, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}><strong>{g.nombre}</strong><span style={{ marginLeft: 'auto', fontSize: 13, color: '#475569' }}>{fmtH(g.horas)} hs/semana</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.tabla}>
              <tbody>
                {g.lista.map(f => (
                  <tr key={f.id}>
                    <td style={s.tablaCell}>{f.lugar}</td>
                    <td style={s.tablaCell}>{textoDias(f.dias)}</td>
                    <td style={s.tablaCell}>{hh(f.hora_desde)} a {hh(f.hora_hasta)}</td>
                    <td style={s.tablaCell}>
                      <select style={{ ...s.input, padding: '4px 6px', minWidth: 150, borderColor: f.empleado_id ? undefined : '#f59e0b' }} value={f.empleado_id || ''} onChange={e => { const x = emp.find(y => y.id === e.target.value); actualizar(f.id, { empleado_id: e.target.value || null, ...(x ? { empleado_nombre: x.nombre } : {}) }) }}>
                        <option value="">{f.empleado_nombre ? `${f.empleado_nombre} (sin vincular)` : 'Sin empleado'}</option>
                        {emp.map(x => <option key={x.id} value={x.id}>{x.apellido} {x.nombre}</option>)}
                      </select>
                    </td>
                    <td style={s.tablaCell}>
                      <select style={{ ...s.input, padding: '4px 6px', minWidth: 150 }} value={f.cliente_id || ''} onChange={e => actualizar(f.id, { cliente_id: e.target.value || null, sucursal_id: null })}>
                        <option value="">Sin cliente</option>
                        {cli.map(c => <option key={c.id} value={c.id}>{nombreCli(c)}</option>)}
                      </select>
                    </td>
                    <td style={{ ...s.tablaCell, textAlign: 'right' }}>{fmtH(horasSemana(f))} hs</td>
                    <td style={s.tablaCell}><button onClick={() => quitar(f.id)} style={{ border: 0, background: 'none', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>El costo de cada empleado se reparte entre los clientes según estas horas (días reales de cada mes). Si un empleado tiene además una asignación por porcentaje vigente, se usa el porcentaje.</p>

      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <form onSubmit={guardarNuevo} style={{ background: '#fff', borderRadius: 14, padding: 20, width: 'min(480px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 12px' }}>Nuevo horario</h4>
            <div style={s.grid2}>
              <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Lugar / dirección *</label><input style={s.input} value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} /></div>
              <div><label style={s.label}>Empleado</label>
                <select style={s.input} value={form.empleado_id} onChange={e => setForm({ ...form, empleado_id: e.target.value })}>
                  <option value="">Sin vincular</option>{emp.map(x => <option key={x.id} value={x.id}>{x.apellido} {x.nombre}</option>)}
                </select></div>
              <div><label style={s.label}>Cliente</label>
                <select style={s.input} value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value, sucursal_id: '' })}>
                  <option value="">Sin cliente</option>{cli.map(c => <option key={c.id} value={c.id}>{nombreCli(c)}</option>)}
                </select></div>
              {!form.empleado_id && <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Nombre del empleado (si no está cargado)</label><input style={s.input} value={form.empleado_nombre} onChange={e => setForm({ ...form, empleado_nombre: e.target.value })} /></div>}
              <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Días</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DIAS.map((d, i) => { const n = i + 1, on = form.dias.includes(n); return (
                    <button type="button" key={d} onClick={() => setForm({ ...form, dias: on ? form.dias.filter(x => x !== n) : [...form.dias, n] })}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid ' + (on ? '#1e40af' : '#cbd5e1'), background: on ? '#1e40af' : '#fff', color: on ? '#fff' : '#334155', cursor: 'pointer' }}>{d}</button>) })}
                </div></div>
              <div><label style={s.label}>Desde</label><input type="time" style={s.input} value={form.hora_desde} onChange={e => setForm({ ...form, hora_desde: e.target.value })} /></div>
              <div><label style={s.label}>Hasta</label><input type="time" style={s.input} value={form.hora_hasta} onChange={e => setForm({ ...form, hora_hasta: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" style={s.btnSecundario} onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" style={s.btnPrimario('#1e40af')}>Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
