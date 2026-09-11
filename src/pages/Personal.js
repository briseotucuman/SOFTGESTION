import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { HardHat, Pencil, Plus, X } from 'lucide-react'

const c = colores.personal

function Personal() {
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({
    nombre: '', apellido: '', dni: '', cuil: '',
    fecha_nacimiento: '', fecha_ingreso: '', puesto: '',
    salario_base: '', costo_hora: '', email: '',
    telefono: '', direccion: '', tipo_contrato: 'relacion_dependencia', observaciones: ''
  })

  useEffect(() => { cargarEmpleados() }, [])

  async function cargarEmpleados() {
    setLoading(true)
    const { data } = await supabase.from('empleados').select('*').eq('activo', true).order('apellido')
    if (data) setEmpleados(data)
    setLoading(false)
  }

  function abrirEdicion(emp) {
    setEditando(emp)
    setForm({
      nombre: emp.nombre || '',
      apellido: emp.apellido || '',
      dni: emp.dni || '',
      cuil: emp.cuil || '',
      fecha_nacimiento: emp.fecha_nacimiento || '',
      fecha_ingreso: emp.fecha_ingreso || '',
      puesto: emp.puesto || '',
      salario_base: emp.salario_base || '',
      costo_hora: emp.costo_hora || '',
      email: emp.email || '',
      telefono: emp.telefono || '',
      direccion: emp.direccion || '',
      tipo_contrato: emp.tipo_contrato || 'relacion_dependencia',
      observaciones: emp.observaciones || ''
    })
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setMostrarForm(false)
    setEditando(null)
    setForm({ nombre: '', apellido: '', dni: '', cuil: '', fecha_nacimiento: '', fecha_ingreso: '', puesto: '', salario_base: '', costo_hora: '', email: '', telefono: '', direccion: '', tipo_contrato: 'relacion_dependencia', observaciones: '' })
  }

  function abrirEdicion(emp) {
    setEditando(emp)
    setForm({
      nombre: emp.nombre || '',
      apellido: emp.apellido || '',
      dni: emp.dni || '',
      cuil: emp.cuil || '',
      fecha_nacimiento: emp.fecha_nacimiento || '',
      fecha_ingreso: emp.fecha_ingreso || '',
      puesto: emp.puesto || '',
      salario_base: emp.salario_base || '',
      costo_hora: emp.costo_hora || '',
      email: emp.email || '',
      telefono: emp.telefono || '',
      direccion: emp.direccion || '',
      tipo_contrato: emp.tipo_contrato || 'relacion_dependencia',
      observaciones: emp.observaciones || ''
    })
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setMostrarForm(false)
    setEditando(null)
    setForm({ nombre: '', apellido: '', dni: '', cuil: '', fecha_nacimiento: '', fecha_ingreso: '', puesto: '', salario_base: '', costo_hora: '', email: '', telefono: '', direccion: '', tipo_contrato: 'relacion_dependencia', observaciones: '' })
  }

    async function guardarEmpleado(e) {
    e.preventDefault()
    const datos = {
      ...form,
      fecha_nacimiento: form.fecha_nacimiento || null,
      fecha_ingreso: form.fecha_ingreso || null,
      salario_base: form.salario_base ? parseFloat(form.salario_base) : null,
      costo_hora: form.costo_hora ? parseFloat(form.costo_hora) : null,
    }
    if (editando) {
      const { error } = await supabase.from('empleados').update(datos).eq('id', editando.id)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const { error } = await supabase.from('empleados').insert([datos])
      if (error) { alert('Error: ' + error.message); return }
    }
    cancelar()
    cargarEmpleados()
  }

  async function darDeBaja(id) {
    if (!confirm('¿Dar de baja este empleado?')) return
    await supabase.from('empleados').update({ activo: false }).eq('id', id)
    cargarEmpleados()
  }

  const filtrados = empleados.filter(e =>
    (e.nombre + ' ' + e.apellido).toLowerCase().includes(busqueda.toLowerCase()) ||
    (e.dni || '').includes(busqueda)
  )

  const tipoLabel = { relacion_dependencia: 'Relación dependencia', monotributo: 'Monotributo', eventual: 'Eventual' }

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><HardHat size={19} /> Personal</h3>
          <p style={s.cabeceraSubtexto}>{empleados.length} empleados activos</p>
        </div>
        <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => { if (mostrarForm) { cancelar() } else { setMostrarForm(true) } }}>
          {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nuevo empleado</>}
        </button>
      </div>

      {mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>
            {editando ? <><Pencil size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Editando — {editando.apellido}, {editando.nombre}</> : 'Nuevo empleado'}
          </h4>
          <form onSubmit={guardarEmpleado}>
            <div style={s.grid2}>
              {[['Nombre','nombre','text',true],['Apellido','apellido','text',true],['DNI','dni','text',true],['CUIL','cuil','text',false]].map(([lbl,key,type,req]) => (
                <div key={key}>
                  <label style={s.label}>{lbl}</label>
                  <input type={type} style={s.input} value={form[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    onFocus={e => e.target.style.borderColor = c.main}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    required={req} />
                </div>
              ))}
              <div>
                <label style={s.label}>Fecha de nacimiento</label>
                <input type="date" style={s.input} value={form.fecha_nacimiento}
                  onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })}
                  onFocus={e => e.target.style.borderColor = c.main}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Fecha de ingreso</label>
                <input type="date" style={s.input} value={form.fecha_ingreso}
                  onChange={e => setForm({ ...form, fecha_ingreso: e.target.value })}
                  onFocus={e => e.target.style.borderColor = c.main}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} required />
              </div>
              <div>
                <label style={s.label}>Puesto</label>
                <input style={s.input} value={form.puesto}
                  onChange={e => setForm({ ...form, puesto: e.target.value })}
                  placeholder="Ej: Operario de limpieza"
                  onFocus={e => e.target.style.borderColor = c.main}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Tipo de contrato</label>
                <select style={s.input} value={form.tipo_contrato}
                  onChange={e => setForm({ ...form, tipo_contrato: e.target.value })}>
                  <option value="relacion_dependencia">Relación de dependencia</option>
                  <option value="monotributo">Monotributo</option>
                  <option value="eventual">Eventual</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Salario base ($)</label>
                <input type="number" style={s.input} value={form.salario_base}
                  onChange={e => setForm({ ...form, salario_base: e.target.value })}
                  onFocus={e => e.target.style.borderColor = c.main}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Costo por hora ($)</label>
                <input type="number" style={s.input} value={form.costo_hora}
                  onChange={e => setForm({ ...form, costo_hora: e.target.value })}
                  onFocus={e => e.target.style.borderColor = c.main}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Teléfono</label>
                <input style={s.input} value={form.telefono}
                  onChange={e => setForm({ ...form, telefono: e.target.value })}
                  onFocus={e => e.target.style.borderColor = c.main}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Email</label>
                <input type="email" style={s.input} value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  onFocus={e => e.target.style.borderColor = c.main}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Dirección</label>
                <input style={s.input} value={form.direccion}
                  onChange={e => setForm({ ...form, direccion: e.target.value })}
                  onFocus={e => e.target.style.borderColor = c.main}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Observaciones</label>
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={form.observaciones}
                  onChange={e => setForm({ ...form, observaciones: e.target.value })}
                  onFocus={e => e.target.style.borderColor = c.main}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={cancelar}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>
                {editando ? 'Guardar cambios' : 'Guardar empleado'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <input style={s.buscador} placeholder=" Buscar por nombre o DNI..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          onFocus={e => e.target.style.borderColor = c.main}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
      </div>

      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : filtrados.length === 0 ? <div style={s.empty}>No hay empleados registrados</div>
        : (
          <table style={s.tabla}>
            <thead>
              <tr>
                {['Empleado', 'DNI', 'Puesto', 'Contrato', 'Salario', 'Costo/hora', 'Teléfono', ''].map(h => (
                  <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e, i) => (
                <tr key={e.id} style={s.tablaFila(i)}>
                  <td style={s.tablaCellBold}>{e.apellido}, {e.nombre}</td>
                  <td style={s.tablaCell}>{e.dni}</td>
                  <td style={s.tablaCell}>{e.puesto || '—'}</td>
                  <td style={s.tablaCell}><span style={s.badge('#f0fdf4', '#16a34a')}>{tipoLabel[e.tipo_contrato] || e.tipo_contrato}</span></td>
                  <td style={{ ...s.tablaCell, color: c.main, fontWeight: '600' }}>
                    {e.salario_base ? Number(e.salario_base).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }) : '—'}
                  </td>
                  <td style={s.tablaCell}>
                    {e.costo_hora ? Number(e.costo_hora).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }) : '—'}
                  </td>
                  <td style={s.tablaCell}>{e.telefono || '—'}</td>
                  <td style={s.tablaCell}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button style={{ ...s.btnPrimario(c.main), padding: '5px 12px', fontSize: '12px' }} onClick={() => abrirEdicion(e)}><Pencil size={13} style={{ marginRight: 4, verticalAlign: "-2px" }} />Editar</button>
                      <button style={s.btnPeligro} onClick={() => darDeBaja(e.id)}>Baja</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Personal
