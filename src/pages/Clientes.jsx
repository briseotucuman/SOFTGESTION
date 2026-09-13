import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { Pencil, Plus, Users, X } from 'lucide-react'

const c = colores.clientes

function Clientes() {
  const [clientes, setClientes] = useState([])
  const [tiposCliente, setTiposCliente] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [verSucursales, setVerSucursales] = useState(null)
  const [sucursales, setSucursales] = useState([])
  const [mostrarFormSucursal, setMostrarFormSucursal] = useState(false)
  const [editandoSucursal, setEditandoSucursal] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({
    razon_social: '', nombre_contacto: '', email: '', telefono: '',
    direccion: '', localidad: '', cuit: '', tipo_cliente_id: '', observaciones: ''
  })
  const [formSucursal, setFormSucursal] = useState({
    nombre: '', direccion: '', localidad: '', provincia: '',
    contacto_nombre: '', contacto_telefono: '', contacto_email: '', observaciones: '', latitud: '', longitud: ''
  })
  const [buscandoCoords, setBuscandoCoords] = useState(false)

  useEffect(() => { cargarClientes() }, [])

  async function cargarClientes() {
    setLoading(true)
    const [{ data }, { data: tc }] = await Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('razon_social'),
      supabase.from('tipos_cliente').select('*').eq('activo', true).order('nombre')
    ])
    if (data) setClientes(data)
    if (tc) setTiposCliente(tc)
    setLoading(false)
  }

  async function cargarSucursales(clienteId) {
    const { data } = await supabase.from('sucursales').select('*').eq('cliente_id', clienteId).eq('activa', true).order('nombre')
    if (data) setSucursales(data)
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ razon_social:'', nombre_contacto:'', email:'', telefono:'', direccion:'', localidad:'', cuit:'', tipo_cliente_id:'', observaciones:'' })
    setMostrarForm(true)
  }

  function abrirEdicion(cliente) {
    setEditando(cliente)
    setForm({
      razon_social: cliente.razon_social || '',
      nombre_contacto: cliente.nombre_contacto || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      localidad: cliente.localidad || '',
      cuit: cliente.cuit || '',
      tipo_cliente_id: cliente.tipo_cliente_id || '',
      observaciones: cliente.observaciones || ''
    })
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function guardarCliente(e) {
    e.preventDefault()
    if (editando) {
      const { error } = await supabase.from('clientes').update(form).eq('id', editando.id)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const { error } = await supabase.from('clientes').insert([form])
      if (error) { alert('Error: ' + error.message); return }
    }
    setMostrarForm(false)
    setEditando(null)
    cargarClientes()
  }

  async function darDeBaja(id) {
    if (!confirm('¿Dar de baja este cliente?')) return
    await supabase.from('clientes').update({ activo: false }).eq('id', id)
    cargarClientes()
  }

  async function abrirSucursales(cliente) {
    setVerSucursales(cliente)
    setMostrarFormSucursal(false)
    setEditandoSucursal(null)
    setFormSucursal({ nombre:'', direccion:'', localidad:'', provincia:'', contacto_nombre:'', contacto_telefono:'', contacto_email:'', observaciones:'', latitud:'', longitud:'' })
    await cargarSucursales(cliente.id)
  }

  function abrirEditarSucursal(suc) {
    setEditandoSucursal(suc)
    setFormSucursal({
      nombre: suc.nombre || '',
      direccion: suc.direccion || '',
      localidad: suc.localidad || '',
      provincia: suc.provincia || '',
      contacto_nombre: suc.contacto_nombre || '',
      contacto_telefono: suc.contacto_telefono || '',
      contacto_email: suc.contacto_email || '',
      observaciones: suc.observaciones || '',
      latitud: suc.latitud || '',
      longitud: suc.longitud || ''
    })
    setMostrarFormSucursal(true)
  }

  async function buscarCoordenadas() {
    const direccionCompleta = [formSucursal.direccion, formSucursal.localidad, formSucursal.provincia, 'Argentina'].filter(Boolean).join(', ')
    if (!direccionCompleta.trim()) { alert('Ingresá la dirección primero'); return }
    setBuscandoCoords(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(direccionCompleta)}&format=json&limit=1`
      const res = await fetch(url)
      const data = await res.json()
      if (data && data.length > 0) {
        setFormSucursal(f => ({ ...f, latitud: parseFloat(data[0].lat).toFixed(7), longitud: parseFloat(data[0].lon).toFixed(7) }))
      } else {
        alert('No se encontraron coordenadas para esa dirección. Ingresalas manualmente.')
      }
    } catch(e) {
      alert('Error al buscar coordenadas. Ingresalas manualmente.')
    }
    setBuscandoCoords(false)
  }

  async function guardarSucursal(e) {
    e.preventDefault()
    const datos = {
      ...formSucursal,
      latitud: formSucursal.latitud ? parseFloat(formSucursal.latitud) : null,
      longitud: formSucursal.longitud ? parseFloat(formSucursal.longitud) : null,
    }
    if (editandoSucursal) {
      const { error } = await supabase.from('sucursales').update(datos).eq('id', editandoSucursal.id)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const { error } = await supabase.from('sucursales').insert([{ ...datos, cliente_id: verSucursales.id }])
      if (error) { alert('Error: ' + error.message); return }
    }
    setMostrarFormSucursal(false)
    setEditandoSucursal(null)
    setFormSucursal({ nombre:'', direccion:'', localidad:'', provincia:'', contacto_nombre:'', contacto_telefono:'', contacto_email:'', observaciones:'', latitud:'', longitud:'' })
    cargarSucursales(verSucursales.id)
  }

  async function darDeBajaSucursal(id) {
    if (!confirm('¿Dar de baja esta sucursal?')) return
    await supabase.from('sucursales').update({ activa: false }).eq('id', id)
    cargarSucursales(verSucursales.id)
  }

  const filtrados = clientes.filter(cl =>
    (cl.razon_social||'').toLowerCase().includes(busqueda.toLowerCase()) ||
    (cl.nombre_contacto||'').toLowerCase().includes(busqueda.toLowerCase()) ||
    (cl.cuit||'').includes(busqueda)
  )


  const inp = (key) => ({
    onFocus: e => e.target.style.borderColor = c.main,
    onBlur: e => e.target.style.borderColor = '#e2e8f0',
    value: form[key],
    onChange: e => setForm({...form, [key]: e.target.value})
  })

  const inpS = (key) => ({
    onFocus: e => e.target.style.borderColor = c.main,
    onBlur: e => e.target.style.borderColor = '#e2e8f0',
    value: formSucursal[key],
    onChange: e => setFormSucursal({...formSucursal, [key]: e.target.value})
  })

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><Users size={19} /> Clientes</h3>
          <p style={s.cabeceraSubtexto}>{clientes.length} clientes activos</p>
        </div>
        <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={mostrarForm ? () => { setMostrarForm(false); setEditando(null) } : abrirNuevo}>
          {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nuevo cliente</>}
        </button>
      </div>

      {/* FORMULARIO CLIENTE */}
      {mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>
            {editando ? <><Pencil size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Editando — {editando.razon_social || editando.nombre_contacto}</> : 'Nuevo cliente'}
          </h4>
          <form onSubmit={guardarCliente}>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Razón social / Nombre</label>
                <input style={s.input} {...inp('razon_social')} required />
              </div>
              <div>
                <label style={s.label}>Tipo de cliente</label>
                <select style={s.input} value={form.tipo_cliente_id} onChange={e => setForm({...form, tipo_cliente_id: e.target.value})}>
                  <option value="">Sin clasificar</option>
                  {tiposCliente.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>CUIT</label>
                <input style={s.input} {...inp('cuit')} placeholder="30-12345678-9" />
              </div>
              <div>
                <label style={s.label}>Nombre de contacto</label>
                <input style={s.input} {...inp('nombre_contacto')} />
              </div>
              <div>
                <label style={s.label}>Email</label>
                <input type="email" style={s.input} {...inp('email')} />
              </div>
              <div>
                <label style={s.label}>Teléfono</label>
                <input style={s.input} {...inp('telefono')} />
              </div>
              <div>
                <label style={s.label}>Dirección principal</label>
                <input style={s.input} {...inp('direccion')} />
              </div>
              <div>
                <label style={s.label}>Localidad</label>
                <input style={s.input} {...inp('localidad')} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Observaciones</label>
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} {...inp('observaciones')} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={() => { setMostrarForm(false); setEditando(null) }}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>{editando ? 'Guardar cambios' : '+ Crear cliente'}</button>
            </div>
          </form>
        </div>
      )}

      {/* BUSCADOR */}
      <div style={{ marginBottom: '16px' }}>
        <input style={s.buscador} placeholder=" Buscar por nombre, razón social o CUIT..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {/* TABLA CLIENTES */}
      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : filtrados.length === 0 ? <div style={s.empty}>No hay clientes registrados</div>
        : (
          <table style={s.tabla}>
            <thead>
              <tr>{['Cliente','CUIT','Contacto','Teléfono','Localidad','Tipo','Sucursales',''].map(h => (
                <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtrados.map((cl, i) => {
                const nombreTipo = tiposCliente.find(t => t.id === cl.tipo_cliente_id)?.nombre
                return (
                  <tr key={cl.id} style={s.tablaFila(i)}>
                    <td style={s.tablaCellBold}>{cl.razon_social || cl.nombre_contacto}</td>
                    <td style={{ ...s.tablaCell, fontSize: '12px', color: '#94a3b8' }}>{cl.cuit || '—'}</td>
                    <td style={s.tablaCell}>{cl.nombre_contacto || '—'}</td>
                    <td style={s.tablaCell}>{cl.telefono || '—'}</td>
                    <td style={s.tablaCell}>{cl.localidad || '—'}</td>
                    <td style={s.tablaCell}>{nombreTipo ? <span style={s.badge(colores.clientes.light, colores.clientes.main)}>{nombreTipo}</span> : <span style={{color:"#94a3b8"}}>—</span>}</td>
                    <td style={s.tablaCell}>
                      <button style={{ ...s.btnPrimario('#0891b2'), padding: '5px 12px', fontSize: '12px' }}
                        onClick={() => abrirSucursales(cl)}>
                        Sucursales
                      </button>
                    </td>
                    <td style={s.tablaCell}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={{ ...s.btnPrimario(c.main), padding: '5px 10px', fontSize: '12px' }} onClick={() => abrirEdicion(cl)}><Pencil size={14} /></button>
                        <button style={s.btnPeligro} onClick={() => darDeBaja(cl.id)}>Baja</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL SUCURSALES */}
      {verSucursales && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'20px' }}>
          <div style={{ background:'#fff', borderRadius:'20px', padding:'28px', width:'100%', maxWidth:'680px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div>
                <h4 style={{ margin:0, fontWeight:'800', color:'#0f172a', fontSize:'16px' }}>
                  Sucursales — {verSucursales.razon_social || verSucursales.nombre_contacto}
                </h4>
                <p style={{ margin:'4px 0 0', fontSize:'13px', color:'#64748b' }}>{sucursales.length} sucursales activas</p>
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button style={s.btnPrimario('#0891b2')} onClick={() => { setMostrarFormSucursal(!mostrarFormSucursal); setEditandoSucursal(null); setFormSucursal({ nombre:'', direccion:'', localidad:'', provincia:'', contacto_nombre:'', contacto_telefono:'', contacto_email:'', observaciones:'', latitud:'', longitud:'' }) }}>
                  {mostrarFormSucursal ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nueva sucursal</>}
                </button>
                <button onClick={() => { setVerSucursales(null); setMostrarFormSucursal(false) }} style={{ background:'none', border:'none', fontSize:'22px', cursor:'pointer', color:'#94a3b8' }}><X size={16} /></button>
              </div>
            </div>

            {/* Formulario sucursal */}
            {mostrarFormSucursal && (
              <div style={{ background:'#f0f9ff', borderRadius:'14px', padding:'20px', marginBottom:'20px', border:'1px solid #bae6fd' }}>
                <h5 style={{ margin:'0 0 16px', color:'#0891b2', fontWeight:'700' }}>
                  {editandoSucursal ? <><Pencil size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Editando — {editandoSucursal.nombre}</> : 'Nueva sucursal'}
                </h5>
                <form onSubmit={guardarSucursal}>
                  <div style={s.grid2}>
                    <div style={{ gridColumn:'1/-1' }}>
                      <label style={s.label}>Nombre de la sucursal</label>
                      <input style={s.input} {...inpS('nombre')} required placeholder="Ej: Sucursal Centro, Planta Norte..." />
                    </div>
                    <div>
                      <label style={s.label}>Dirección</label>
                      <input style={s.input} {...inpS('direccion')} />
                    </div>
                    <div>
                      <label style={s.label}>Localidad</label>
                      <input style={s.input} {...inpS('localidad')} />
                    </div>
                    <div>
                      <label style={s.label}>Provincia</label>
                      <input style={s.input} {...inpS('provincia')} />
                    </div>
                    <div>
                      <label style={s.label}>Contacto en sucursal</label>
                      <input style={s.input} {...inpS('contacto_nombre')} placeholder="Nombre del encargado" />
                    </div>
                    <div>
                      <label style={s.label}>Teléfono contacto</label>
                      <input style={s.input} {...inpS('contacto_telefono')} />
                    </div>
                    <div>
                      <label style={s.label}>Email contacto</label>
                      <input type="email" style={s.input} {...inpS('contacto_email')} />
                    </div>
                    <div>
                      <label style={s.label}>Observaciones</label>
                      <input style={s.input} {...inpS('observaciones')} />
                    </div>
                  </div>

                  {/* COORDENADAS */}
                  <div style={{ background:'#f0fdf4', borderRadius:'12px', padding:'14px', margin:'14px 0', border:'1px solid #86efac' }}>
                    <p style={{ ...s.label, color:'#059669', marginBottom:'10px' }}>Ubicación en mapa</p>
                    <div style={{ display:'flex', gap:'10px', alignItems:'flex-end' }}>
                      <div style={{ flex:1 }}>
                        <label style={s.label}>Latitud</label>
                        <input style={s.input} value={formSucursal.latitud} onChange={e => setFormSucursal({...formSucursal, latitud: e.target.value})} placeholder="-26.8241" />
                      </div>
                      <div style={{ flex:1 }}>
                        <label style={s.label}>Longitud</label>
                        <input style={s.input} value={formSucursal.longitud} onChange={e => setFormSucursal({...formSucursal, longitud: e.target.value})} placeholder="-65.2226" />
                      </div>
                      <div>
                        <button type="button" style={{ ...s.btnPrimario('#059669'), whiteSpace:'nowrap' }} onClick={buscarCoordenadas} disabled={buscandoCoords}>
                          {buscandoCoords ? '⏳ Buscando...' : 'Buscar automático'}
                        </button>
                      </div>
                    </div>
                    {formSucursal.latitud && formSucursal.longitud && (
                      <p style={{ margin:'8px 0 0', fontSize:'12px', color:'#059669' }}>
                        Coordenadas cargadas — este punto aparecerá en el mapa de Reportes
                      </p>
                    )}
                  </div>

                  <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'16px' }}>
                    <button type="button" style={s.btnSecundario} onClick={() => { setMostrarFormSucursal(false); setEditandoSucursal(null) }}>Cancelar</button>
                    <button type="submit" style={s.btnPrimario('#0891b2')}>{editandoSucursal ? 'Guardar cambios' : '+ Crear sucursal'}</button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista de sucursales */}
            {sucursales.length === 0 ? (
              <div style={{ ...s.empty, background:'#f8fafc', borderRadius:'12px' }}>
                Este cliente no tiene sucursales cargadas
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {sucursales.map((suc, i) => (
                  <div key={suc.id} style={{ background: i%2===0 ? '#f8fafc' : '#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div style={{ flex:1 }}>
                        <p style={{ margin:'0 0 6px', fontWeight:'800', color:'#0f172a', fontSize:'14px' }}>
                          {suc.nombre}
                        </p>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px' }}>
                          {suc.direccion && <p style={{ margin:0, fontSize:'12px', color:'#64748b' }}>{suc.direccion}{suc.localidad ? ', ' + suc.localidad : ''}</p>}
                          {suc.contacto_nombre && <p style={{ margin:0, fontSize:'12px', color:'#64748b' }}>{suc.contacto_nombre}</p>}
                          {suc.contacto_telefono && <p style={{ margin:0, fontSize:'12px', color:'#64748b' }}>{suc.contacto_telefono}</p>}
                          {suc.contacto_email && <p style={{ margin:0, fontSize:'12px', color:'#64748b' }}>{suc.contacto_email}</p>}
                          {suc.latitud && suc.longitud && <p style={{ margin:0, fontSize:'12px', color:'#059669', fontWeight:'600' }}>{suc.latitud}, {suc.longitud}</p>}
                        </div>
                        {suc.observaciones && <p style={{ margin:'6px 0 0', fontSize:'12px', color:'#94a3b8', fontStyle:'italic' }}>{suc.observaciones}</p>}
                      </div>
                      <div style={{ display:'flex', gap:'6px', marginLeft:'12px' }}>
                        <button style={{ ...s.btnPrimario('#0891b2'), padding:'5px 10px', fontSize:'12px' }} onClick={() => abrirEditarSucursal(suc)}><Pencil size={13} style={{ marginRight: 4, verticalAlign: "-2px" }} />Editar</button>
                        <button style={s.btnPeligro} onClick={() => darDeBajaSucursal(suc.id)}>Baja</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'20px' }}>
              <button style={s.btnSecundario} onClick={() => { setVerSucursales(null); setMostrarFormSucursal(false) }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Clientes
