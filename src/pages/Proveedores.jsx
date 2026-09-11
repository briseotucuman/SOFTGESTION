import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { Factory, Pencil, Plus, X } from 'lucide-react'

const c = colores.proveedores

function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({
    razon_social: '', cuit: '', nombre_contacto: '', email: '',
    telefono: '', direccion: '', localidad: '', rubro: '', observaciones: ''
  })

  useEffect(() => { cargarProveedores() }, [])

  async function cargarProveedores() {
    setLoading(true)
    const { data } = await supabase.from('proveedores').select('*').eq('activo', true).order('razon_social')
    if (data) setProveedores(data)
    setLoading(false)
  }

  function abrirEdicion(p) {
    setEditando(p)
    setForm({
      razon_social: p.razon_social || '',
      cuit: p.cuit || '',
      nombre_contacto: p.nombre_contacto || '',
      email: p.email || '',
      telefono: p.telefono || '',
      direccion: p.direccion || '',
      localidad: p.localidad || '',
      rubro: p.rubro || '',
      observaciones: p.observaciones || ''
    })
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function guardarProveedor(e) {
    e.preventDefault()
    if (editando) {
      const { error } = await supabase.from('proveedores').update(form).eq('id', editando.id)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const { error } = await supabase.from('proveedores').insert([{ ...form }])
      if (error) { alert('Error: ' + error.message); return }
    }
    setMostrarForm(false)
    setEditando(null)
    setForm({ razon_social:'', cuit:'', nombre_contacto:'', email:'', telefono:'', direccion:'', localidad:'', rubro:'', observaciones:'' })
    cargarProveedores()
  }

  async function darDeBaja(id) {
    if (!confirm('¿Dar de baja este proveedor?')) return
    await supabase.from('proveedores').update({ activo: false }).eq('id', id)
    cargarProveedores()
  }

  const filtrados = proveedores.filter(p =>
    (p.razon_social||'').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.rubro||'').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.cuit||'').includes(busqueda)
  )

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><Factory size={19} /> Proveedores</h3>
          <p style={s.cabeceraSubtexto}>{proveedores.length} proveedores activos</p>
        </div>
        <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => { setMostrarForm(!mostrarForm); setEditando(null); setForm({ razon_social:'', cuit:'', nombre_contacto:'', email:'', telefono:'', direccion:'', localidad:'', rubro:'', observaciones:'' }) }}>
          {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nuevo proveedor</>}
        </button>
      </div>

      {mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>{editando ? <><Pencil size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Editando — {editando.razon_social}</> : 'Nuevo proveedor'}</h4>
          <form onSubmit={guardarProveedor}>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Razón social</label>
                <input style={s.input} value={form.razon_social} onChange={e => setForm({...form, razon_social: e.target.value})} required
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>CUIT</label>
                <input style={s.input} value={form.cuit} onChange={e => setForm({...form, cuit: e.target.value})}
                  placeholder="30-12345678-9"
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Rubro</label>
                <input style={s.input} value={form.rubro} onChange={e => setForm({...form, rubro: e.target.value})}
                  placeholder="Ej: Insumos de limpieza, Equipamiento..."
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Nombre de contacto</label>
                <input style={s.input} value={form.nombre_contacto} onChange={e => setForm({...form, nombre_contacto: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Email</label>
                <input type="email" style={s.input} value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Teléfono</label>
                <input style={s.input} value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Localidad</label>
                <input style={s.input} value={form.localidad} onChange={e => setForm({...form, localidad: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Dirección</label>
                <input style={s.input} value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Observaciones</label>
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={form.observaciones}
                  onChange={e => setForm({...form, observaciones: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={() => { setMostrarForm(false); setEditando(null) }}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>{editando ? 'Guardar cambios' : '+ Crear proveedor'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <input style={s.buscador} placeholder=" Buscar por nombre, rubro o CUIT..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
      </div>

      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : filtrados.length === 0 ? <div style={s.empty}>{busqueda ? 'Sin resultados' : 'No hay proveedores registrados'}</div>
        : (
          <table style={s.tabla}>
            <thead>
              <tr>{['Proveedor','CUIT','Rubro','Contacto','Teléfono','Email','Localidad',''].map(h => (
                <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => (
                <tr key={p.id} style={s.tablaFila(i)}>
                  <td style={s.tablaCellBold}>{p.razon_social}</td>
                  <td style={{ ...s.tablaCell, fontSize: '12px', color: '#94a3b8' }}>{p.cuit || '—'}</td>
                  <td style={s.tablaCell}>
                    {p.rubro ? <span style={s.badge(c.light, c.main)}>{p.rubro}</span> : '—'}
                  </td>
                  <td style={s.tablaCell}>{p.nombre_contacto || '—'}</td>
                  <td style={s.tablaCell}>{p.telefono || '—'}</td>
                  <td style={s.tablaCell}>{p.email || '—'}</td>
                  <td style={s.tablaCell}>{p.localidad || '—'}</td>
                  <td style={s.tablaCell}>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button style={{ ...s.btnPrimario(c.main), padding:'5px 12px', fontSize:'12px' }} onClick={() => abrirEdicion(p)}><Pencil size={13} style={{ marginRight: 4, verticalAlign: "-2px" }} />Editar</button>
                      <button style={s.btnPeligro} onClick={() => darDeBaja(p.id)}>Baja</button>
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

export default Proveedores
