import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { UserCog, X } from 'lucide-react'

const c = colores.usuarios

function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('pendiente')

  useEffect(() => { cargarUsuarios() }, [])

  async function cargarUsuarios() {
    setLoading(true)
    const { data } = await supabase.from('usuarios_sistema').select('*').order('creado_en', { ascending: false })
    if (data) setUsuarios(data)
    setLoading(false)
  }

  async function aprobar(id) {
    await supabase.from('usuarios_sistema').update({ aprobado: true, rol: 'usuario' }).eq('id', id)
    cargarUsuarios()
  }

  async function rechazar(id) {
    if (!confirm('¿Rechazar este usuario? Se eliminará su registro.')) return
    await supabase.from('usuarios_sistema').delete().eq('id', id)
    cargarUsuarios()
  }

  async function cambiarRol(id, rol) {
    await supabase.from('usuarios_sistema').update({ rol }).eq('id', id)
    cargarUsuarios()
  }

  async function revocarAcceso(id) {
    if (!confirm('¿Revocar acceso a este usuario?')) return
    await supabase.from('usuarios_sistema').update({ aprobado: false, rol: 'suspendido' }).eq('id', id)
    cargarUsuarios()
  }

  const pendientes = usuarios.filter(u => !u.aprobado && u.rol === 'pendiente')
  const aprobados = usuarios.filter(u => u.aprobado)
  const filtrados = filtro === 'pendiente' ? pendientes : aprobados

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><UserCog size={19} /> Gestión de usuarios</h3>
          <p style={s.cabeceraSubtexto}>{pendientes.length} pendientes · {aprobados.length} aprobados</p>
        </div>
      </div>

      {/* ALERTA PENDIENTES */}
      {pendientes.length > 0 && (
        <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:'12px', padding:'14px 18px', marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ margin:0, color:'#d97706', fontWeight:'700', fontSize:'13px' }}>
            ⏳ {pendientes.length} usuario(s) esperando aprobación
          </p>
          <button style={s.btnPrimario('#d97706')} onClick={() => setFiltro('pendiente')}>Ver pendientes</button>
        </div>
      )}

      {/* TABS */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'20px' }}>
        {[['pendiente', `⏳ Pendientes (${pendientes.length})`], ['aprobado', `Aprobados (${aprobados.length})`]].map(([v, lbl]) => (
          <button key={v} onClick={() => setFiltro(v)} style={filtro === v ? s.btnPrimario(c.main) : s.btnSecundario}>{lbl}</button>
        ))}
      </div>

      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : filtrados.length === 0 ? (
          <div style={s.empty}>
            {filtro === 'pendiente' ? 'No hay solicitudes pendientes' : 'No hay usuarios aprobados'}
          </div>
        ) : (
          <table style={s.tabla}>
            <thead>
              <tr>{['Nombre','Email','Fecha solicitud','Rol','Acciones'].map(h => (
                <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtrados.map((u, i) => (
                <tr key={u.id} style={s.tablaFila(i)}>
                  <td style={s.tablaCellBold}>{u.nombre || '—'}</td>
                  <td style={s.tablaCell}>{u.email}</td>
                  <td style={s.tablaCell}>{new Date(u.creado_en).toLocaleDateString('es-AR')}</td>
                  <td style={s.tablaCell}>
                    {u.aprobado ? (
                      <select value={u.rol} onChange={e => cambiarRol(u.id, e.target.value)}
                        style={{ ...s.input, padding:'5px 10px', fontSize:'12px', maxWidth:'130px' }}>
                        <option value="usuario">Usuario</option>
                        <option value="admin">Admin</option>
                        <option value="solo_lectura">Solo lectura</option>
                      </select>
                    ) : (
                      <span style={s.badge('#fef3c7','#d97706')}>⏳ Pendiente</span>
                    )}
                  </td>
                  <td style={s.tablaCell}>
                    {!u.aprobado ? (
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button style={{ ...s.btnPrimario('#059669'), padding:'6px 14px', fontSize:'12px' }} onClick={() => aprobar(u.id)}>Aprobar</button>
                        <button style={s.btnPeligro} onClick={() => rechazar(u.id)}><X size={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />Rechazar</button>
                      </div>
                    ) : (
                      <button style={s.btnPeligro} onClick={() => revocarAcceso(u.id)}>Revocar acceso</button>
                    )}
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

export default Usuarios
