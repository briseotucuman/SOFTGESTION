import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import FichaCliente from './FichaCliente.jsx'
import {
  Radar, Plus, X, Target, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, Users, Mail, MessageSquare,
  Edit, Search, UserPlus
} from 'lucide-react'

const ETAPAS = [
  { id: 'nuevo', label: 'Nuevo Lead', color: '#64748B', bg: '#F1F5F9' },
  { id: 'contactado', label: 'Contactado', color: '#2563EB', bg: '#EFF6FF' },
  { id: 'propuesta', label: 'Propuesta enviada', color: '#0F766E', bg: '#F0FDFA' },
  { id: 'negociacion', label: 'En Negociación', color: '#B45309', bg: '#FEF3C7' },
  { id: 'ganado', label: 'Ganado / Cerrado', color: '#15803D', bg: '#DCFCE7' },
  { id: 'perdido', label: 'No Concretado', color: '#BE123C', bg: '#FFE4E6' },
]

function diasDesde(fechaStr) {
  if (!fechaStr) return null
  return Math.floor((new Date() - new Date(fechaStr)) / (1000 * 60 * 60 * 24))
}

function limpiarTelefonoWhatsApp(tel) {
  if (!tel) return ''
  let limpio = tel.replace(/[^0-9]/g, '')
  if (limpio.startsWith('0')) limpio = limpio.slice(1)
  if (!limpio.startsWith('54')) {
    limpio = '549' + limpio
  } else if (limpio.startsWith('54') && !limpio.startsWith('549') && limpio.length === 12) {
    limpio = '549' + limpio.slice(2)
  }
  return limpio
}

function CRM() {
  const [vista, setVista] = useState('pipeline') // 'pipeline' | 'clientes' | 'tareas' | 'panel'
  const [subVistaPipeline, setSubVistaPipeline] = useState('kanban') // 'kanban' | 'tabla'
  const [oportunidades, setOportunidades] = useState([])
  const [tareas, setTareas] = useState([])
  const [clientes, setClientes] = useState([])
  const [tiposServicio, setTiposServicio] = useState([])
  const [interacciones, setInteracciones] = useState([])
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)

  // Búsqueda y Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('todas')

  // Modales
  const [mostrarFormOp, setMostrarFormOp] = useState(false)
  const [opEditando, setOpEditando] = useState(null)
  const [esProspectoNuevo, setEsProspectoNuevo] = useState(true)
  const [formOp, setFormOp] = useState({
    cliente_id: '', nombre_prospecto: '', contacto_prospecto: '', telefono_prospecto: '', email_prospecto: '',
    tipo_servicio_id: '', valor_estimado: '', probabilidad: '50', fecha_estimada_cierre: '', notas: '', etapa: 'nuevo'
  })

  // Modal Recordatorio
  const [mostrarModalRecordatorio, setMostrarModalRecordatorio] = useState(false)
  const [formRecordatorio, setFormRecordatorio] = useState({
    cliente_id: '',
    oportunidad_id: '',
    titulo: '',
    fecha_vencimiento: new Date().toISOString().split('T')[0],
    prioridad: 'media',
    notas: ''
  })

  // Modal Enviar Mensaje (WhatsApp / Correo)
  const [mostrarModalMensaje, setMostrarModalMensaje] = useState(false)
  const [datosMensaje, setDatosMensaje] = useState({
    destinatario: '',
    contacto: '',
    telefono: '',
    email: '',
    cliente_id: null,
    oportunidad_id: null,
    plantilla: 'propuesta',
    textoMensaje: '',
    asuntoEmail: 'Seguimiento de propuesta de servicios · Briseo',
    registrarBitacora: true
  })

  // Ficha Cliente Modal
  const [clienteFichaSeleccionado, setClienteFichaSeleccionado] = useState(null)

  // Filtro de Tareas
  const [filtroTareas, setFiltroTareas] = useState('pendiente')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    const [
      { data: ops },
      { data: tar },
      { data: clis },
      { data: tipos },
      { data: inter },
      { data: fact }
    ] = await Promise.all([
      supabase.from('oportunidades').select(`*, clientes(id, razon_social, nombre_contacto, telefono, email, cuit, localidad, direccion), tipos_servicio(id, nombre)`).order('creado_en', { ascending: false }),
      supabase.from('tareas_seguimiento').select(`*, clientes(id, razon_social, nombre_contacto, telefono, email)`).order('fecha_vencimiento', { ascending: true }),
      supabase.from('clientes').select('*').eq('activo', true).order('razon_social', { ascending: true }),
      supabase.from('tipos_servicio').select('*').eq('activo', true),
      supabase.from('interacciones').select('*').order('fecha', { ascending: false }),
      supabase.from('facturas').select('cliente_id, estado, total').eq('estado', 'vencida'),
    ])

    if (ops) setOportunidades(ops)
    if (tar) setTareas(tar)
    if (clis) setClientes(clis)
    if (tipos) setTiposServicio(tipos)
    if (inter) setInteracciones(inter)
    if (fact) setFacturas(fact)
    setLoading(false)
  }

  // Métricas del CRM
  const ultimoContactoPorCliente = useMemo(() => {
    const mapa = {}
    interacciones.forEach(it => {
      if (!mapa[it.cliente_id]) mapa[it.cliente_id] = it.fecha
    })
    return mapa
  }, [interacciones])

  const clientesConFacturaVencida = useMemo(() => new Set(facturas.map(f => f.cliente_id)), [facturas])

  const clientesEnRiesgo = useMemo(() => {
    return clientes.filter(cl => {
      const dias = diasDesde(ultimoContactoPorCliente[cl.id])
      return clientesConFacturaVencida.has(cl.id) || dias == null || dias > 45
    })
  }, [clientes, ultimoContactoPorCliente, clientesConFacturaVencida])

  const tareasVencidas = useMemo(() => {
    const hoy = new Date().toISOString().split('T')[0]
    return tareas.filter(t => t.estado === 'pendiente' && t.fecha_vencimiento && t.fecha_vencimiento < hoy)
  }, [tareas])

  const tareasHoy = useMemo(() => {
    const hoy = new Date().toISOString().split('T')[0]
    return tareas.filter(t => t.estado === 'pendiente' && t.fecha_vencimiento === hoy)
  }, [tareas])

  const opsAbiertas = useMemo(() => oportunidades.filter(o => o.etapa !== 'ganado' && o.etapa !== 'perdido'), [oportunidades])
  const valorPipeline = useMemo(() => opsAbiertas.reduce((a, o) => a + Number(o.valor_estimado || 0), 0), [opsAbiertas])
  const ganadas = useMemo(() => oportunidades.filter(o => o.etapa === 'ganado').length, [oportunidades])
  const perdidas = useMemo(() => oportunidades.filter(o => o.etapa === 'perdido').length, [oportunidades])
  const tasaConversion = (ganadas + perdidas) > 0 ? (ganadas / (ganadas + perdidas)) * 100 : null

  // Helpers para obtener contacto unificado de una oportunidad
  function getDatosContactoOp(op) {
    const esCliente = !!op.clientes
    const nombreEntidad = esCliente ? (op.clientes?.razon_social || op.clientes?.nombre_contacto) : (op.nombre_prospecto || 'Prospecto sin nombre')
    const personaContacto = op.contacto_prospecto || op.clientes?.nombre_contacto || ''
    const telefono = op.telefono_prospecto || op.clientes?.telefono || ''
    const email = op.email_prospecto || op.clientes?.email || ''
    const direccion = op.clientes?.direccion ? `${op.clientes.direccion}${op.clientes.localidad ? ', ' + op.clientes.localidad : ''}` : ''
    return {
      nombreEntidad,
      personaContacto,
      telefono,
      email,
      direccion,
      esCliente
    }
  }

  // Filtrado de oportunidades
  const oportunidadesFiltradas = useMemo(() => {
    return oportunidades.filter(op => {
      const { nombreEntidad, personaContacto, telefono, email } = getDatosContactoOp(op)
      const q = busqueda.toLowerCase().trim()
      const matchBusqueda = !q ||
        nombreEntidad.toLowerCase().includes(q) ||
        personaContacto.toLowerCase().includes(q) ||
        telefono.includes(q) ||
        email.toLowerCase().includes(q) ||
        (op.notas && op.notas.toLowerCase().includes(q))
      const matchEtapa = filtroEtapa === 'todas' || op.etapa === filtroEtapa
      return matchBusqueda && matchEtapa
    })
  }, [oportunidades, busqueda, filtroEtapa])

  // Guardar nueva oportunidad
  async function guardarOportunidad(e) {
    e.preventDefault()
    const datos = {
      cliente_id: esProspectoNuevo ? null : (formOp.cliente_id || null),
      nombre_prospecto: esProspectoNuevo ? formOp.nombre_prospecto : null,
      contacto_prospecto: formOp.contacto_prospecto || null,
      telefono_prospecto: formOp.telefono_prospecto || null,
      email_prospecto: formOp.email_prospecto || null,
      tipo_servicio_id: formOp.tipo_servicio_id || null,
      valor_estimado: parseFloat(formOp.valor_estimado) || null,
      probabilidad: parseInt(formOp.probabilidad, 10) || 50,
      fecha_estimada_cierre: formOp.fecha_estimada_cierre || null,
      notas: formOp.notas || '',
      etapa: formOp.etapa || 'nuevo'
    }

    if (opEditando) {
      if (datos.cliente_id && (datos.telefono_prospecto || datos.email_prospecto || datos.contacto_prospecto)) {
        await supabase.from('clientes').update({
          telefono: datos.telefono_prospecto || undefined,
          email: datos.email_prospecto || undefined,
          nombre_contacto: datos.contacto_prospecto || undefined
        }).eq('id', datos.cliente_id)
      }
      const { error } = await supabase.from('oportunidades').update(datos).eq('id', opEditando.id)
      if (error) { alert('Error al actualizar: ' + error.message); return }
    } else {
      const { error } = await supabase.from('oportunidades').insert([datos])
      if (error) { alert('Error al registrar: ' + error.message); return }
    }

    cerrarFormOp()
    cargarDatos()
  }

  function abrirEdicionOp(op) {
    setOpEditando(op)
    const { personaContacto, telefono, email } = getDatosContactoOp(op)
    setEsProspectoNuevo(!op.cliente_id)
    setFormOp({
      cliente_id: op.cliente_id || '',
      nombre_prospecto: op.nombre_prospecto || '',
      contacto_prospecto: personaContacto,
      telefono_prospecto: telefono,
      email_prospecto: email,
      tipo_servicio_id: op.tipo_servicio_id || '',
      valor_estimado: op.valor_estimado ? String(op.valor_estimado) : '',
      probabilidad: String(op.probabilidad || 50),
      fecha_estimada_cierre: op.fecha_estimada_cierre || '',
      notas: op.notas || '',
      etapa: op.etapa || 'nuevo'
    })
    setMostrarFormOp(true)
  }

  function cerrarFormOp() {
    setMostrarFormOp(false)
    setOpEditando(null)
    setFormOp({
      cliente_id: '', nombre_prospecto: '', contacto_prospecto: '', telefono_prospecto: '', email_prospecto: '',
      tipo_servicio_id: '', valor_estimado: '', probabilidad: '50', fecha_estimada_cierre: '', notas: '', etapa: 'nuevo'
    })
  }

  async function cambiarEtapa(id, etapa) {
    await supabase.from('oportunidades').update({ etapa }).eq('id', id)
    cargarDatos()
  }

  // Convertir prospecto ganado a Cliente Oficial
  async function convertirEnCliente(op) {
    if (!confirm(`¿Convertir al prospecto "${op.nombre_prospecto}" en un Cliente activo de Briseo?`)) return
    const { data: nuevoCliente, error } = await supabase.from('clientes').insert([{
      razon_social: op.nombre_prospecto,
      nombre_contacto: op.contacto_prospecto || '',
      telefono: op.telefono_prospecto || '',
      email: op.email_prospecto || '',
      activo: true,
      observaciones: `Convertido desde CRM Oportunidad. Notas: ${op.notas || ''}`
    }]).select().single()

    if (error) {
      alert('Error al crear cliente: ' + error.message)
      return
    }

    await supabase.from('oportunidades').update({
      cliente_id: nuevoCliente.id,
      etapa: 'ganado'
    }).eq('id', op.id)

    alert(`¡Éxito! "${op.nombre_prospecto}" ahora es un cliente activo registrado.`)
    cargarDatos()
  }

  // Modal Recordatorio
  function abrirNuevoRecordatorio(clienteId = '', opId = '', tituloSugerido = '') {
    setFormRecordatorio({
      cliente_id: clienteId,
      oportunidad_id: opId,
      titulo: tituloSugerido || 'Llamada de seguimiento',
      fecha_vencimiento: new Date().toISOString().split('T')[0],
      prioridad: 'media',
      notas: ''
    })
    setMostrarModalRecordatorio(true)
  }

  async function guardarRecordatorio(e) {
    e.preventDefault()
    const { error } = await supabase.from('tareas_seguimiento').insert([{
      cliente_id: formRecordatorio.cliente_id || null,
      titulo: formRecordatorio.titulo,
      fecha_vencimiento: formRecordatorio.fecha_vencimiento || null,
      prioridad: formRecordatorio.prioridad,
      estado: 'pendiente'
    }])
    if (error) { alert('Error: ' + error.message); return }
    setMostrarModalRecordatorio(false)
    cargarDatos()
  }

  async function completarTarea(t) {
    await supabase.from('tareas_seguimiento').update({
      estado: t.estado === 'pendiente' ? 'completada' : 'pendiente'
    }).eq('id', t.id)
    cargarDatos()
  }

  // Modal Mensaje / WhatsApp
  function abrirModalMensajePara(opOCliente, esOp = true) {
    let destinatario = ''
    let contacto = ''
    let telefono = ''
    let email = ''
    let clienteId = null
    let opId = null

    if (esOp) {
      const ctc = getDatosContactoOp(opOCliente)
      destinatario = ctc.nombreEntidad
      contacto = ctc.personaContacto
      telefono = ctc.telefono
      email = ctc.email
      clienteId = opOCliente.cliente_id || null
      opId = opOCliente.id
    } else {
      destinatario = opOCliente.razon_social || opOCliente.nombre_contacto
      contacto = opOCliente.nombre_contacto || ''
      telefono = opOCliente.telefono || ''
      email = opOCliente.email || ''
      clienteId = opOCliente.id
    }

    const nombreSaludo = contacto ? contacto.split(' ')[0] : destinatario
    const textoInicial = `Hola ${nombreSaludo}, te escribo desde Briseo Servicios respecto a la propuesta de limpieza y mantenimiento. ¿Pudiste evaluarla o tenés alguna duda que podamos despejar? Saludos cordiales.`

    setDatosMensaje({
      destinatario,
      contacto,
      telefono,
      email,
      cliente_id: clienteId,
      oportunidad_id: opId,
      plantilla: 'propuesta',
      textoMensaje: textoInicial,
      asuntoEmail: `Seguimiento de servicios · Briseo para ${destinatario}`,
      registrarBitacora: true
    })
    setMostrarModalMensaje(true)
  }

  function aplicarPlantillaMensaje(tipo) {
    const nombreSaludo = datosMensaje.contacto ? datosMensaje.contacto.split(' ')[0] : datosMensaje.destinatario
    let texto = ''
    if (tipo === 'propuesta') {
      texto = `Hola ${nombreSaludo}, te contacto desde Briseo respecto a la cotización enviada. Quedamos a tu entera disposición ante cualquier ajuste o consulta sobre el alcance del servicio.`
    } else if (tipo === 'visita') {
      texto = `Hola ${nombreSaludo}, nos comunicamos de Briseo para coordinar la visita técnica y relevamiento operativo en sus instalaciones. ¿Qué día y horario te resultaría conveniente esta semana?`
    } else if (tipo === 'recordatorio') {
      texto = `Hola ${nombreSaludo}, buen día. Te recuerdo que estamos atentos a tus comentarios para avanzar con el inicio del servicio acordado. Quedamos en contacto. Saludos!`
    } else if (tipo === 'factura') {
      texto = `Estimado/a ${nombreSaludo}, nos contactamos desde la administración de Briseo para acercarle el estado de cuenta y recordar el próximo vencimiento de facturación. Muchas gracias.`
    }
    setDatosMensaje(prev => ({ ...prev, plantilla: tipo, textoMensaje: texto }))
  }

  async function ejecutarEnvioWhatsApp() {
    if (!datosMensaje.telefono) {
      alert('Por favor ingresá un número de teléfono de contacto.')
      return
    }
    const telLimpio = limpiarTelefonoWhatsApp(datosMensaje.telefono)
    const url = `https://wa.me/${telLimpio}?text=${encodeURIComponent(datosMensaje.textoMensaje)}`

    if (datosMensaje.registrarBitacora && datosMensaje.cliente_id) {
      await supabase.from('interacciones').insert([{
        cliente_id: datosMensaje.cliente_id,
        tipo: 'whatsapp',
        fecha: new Date().toISOString().split('T')[0],
        asunto: 'Envío de WhatsApp desde CRM',
        detalle: datosMensaje.textoMensaje
      }])
    }

    window.open(url, '_blank')
    setMostrarModalMensaje(false)
    cargarDatos()
  }

  async function ejecutarEnvioEmail() {
    if (!datosMensaje.email) {
      alert('Por favor ingresá un correo electrónico válido.')
      return
    }
    const mailto = `mailto:${datosMensaje.email}?subject=${encodeURIComponent(datosMensaje.asuntoEmail)}&body=${encodeURIComponent(datosMensaje.textoMensaje)}`

    if (datosMensaje.registrarBitacora && datosMensaje.cliente_id) {
      await supabase.from('interacciones').insert([{
        cliente_id: datosMensaje.cliente_id,
        tipo: 'email',
        fecha: new Date().toISOString().split('T')[0],
        asunto: datosMensaje.asuntoEmail,
        detalle: datosMensaje.textoMensaje
      }])
    }

    window.location.href = mailto
    setMostrarModalMensaje(false)
    cargarDatos()
  }

  return (
    <div style={{ fontFamily: paleta.font, color: paleta.ink }}>

      {/* HEADER PRINCIPAL */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        borderRadius: '10px',
        padding: '20px 24px',
        marginBottom: '20px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid #334155',
        boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.08)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Radar size={18} color="#38BDF8" />
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              GESTIÓN DE RELACIONES COMERCIALES & CLIENTES
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', letterSpacing: '-0.02em', color: '#F8FAFC' }}>
            CRM & Pipeline Comercial
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94A3B8' }}>
            Control de prospectos, datos de contacto, seguimiento por WhatsApp y tareas programadas.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              setOpEditando(null)
              setEsProspectoNuevo(true)
              setFormOp({
                cliente_id: '', nombre_prospecto: '', contacto_prospecto: '', telefono_prospecto: '', email_prospecto: '',
                tipo_servicio_id: '', valor_estimado: '', probabilidad: '50', fecha_estimada_cierre: '', notas: '', etapa: 'nuevo'
              })
              setMostrarFormOp(true)
            }}
            style={{
              background: '#2563EB',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              padding: '8px 16px',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
          >
            <Plus size={15} />
            <span>Nueva Oportunidad</span>
          </button>

          <button
            onClick={() => abrirNuevoRecordatorio()}
            style={{
              background: '#1E293B',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '8px 14px',
              color: '#F8FAFC',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Clock size={15} color="#38BDF8" />
            <span>Crear Recordatorio</span>
          </button>
        </div>
      </div>

      {/* TABS DE VISTA CRM */}
      <div style={{
        background: '#F1F5F9',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        padding: '4px',
        display: 'inline-flex',
        gap: '4px',
        marginBottom: '20px'
      }}>
        {[
          { id: 'pipeline', label: 'Pipeline Comercial', icon: Target, badge: opsAbiertas.length },
          { id: 'clientes', label: 'Gestión de Clientes', icon: Users, badge: clientes.length },
          { id: 'tareas', label: 'Recordatorios & Tareas', icon: CheckCircle2, badge: tareasVencidas.length ? `${tareasVencidas.length} Venc.` : (tareasHoy.length ? `${tareasHoy.length} Hoy` : null), alert: !!tareasVencidas.length },
          { id: 'panel', label: 'Métricas & Cartera', icon: TrendingUp }
        ].map(tab => {
          const activa = vista === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setVista(tab.id)}
              style={{
                background: activa ? '#FFFFFF' : 'transparent',
                color: activa ? '#0F172A' : '#64748B',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12.5px',
                fontWeight: activa ? '700' : '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                boxShadow: activa ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
                transition: 'all 0.12s ease'
              }}
            >
              <Icon size={14} color={activa ? '#2563EB' : '#64748B'} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span style={{
                  background: tab.alert ? '#BE123C' : (activa ? '#EFF6FF' : '#E2E8F0'),
                  color: tab.alert ? '#FFFFFF' : (activa ? '#1D4ED8' : '#475569'),
                  fontSize: '10.5px',
                  fontWeight: '700',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '60px 20px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
          <p style={{ color: '#0F172A', fontSize: '14px', fontWeight: '600', margin: 0 }}>Cargando datos comerciales y contactos…</p>
        </div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* 1. PIPELINE DE OPORTUNIDADES CON DATOS DE CONTACTO */}
          {/* ============================================================ */}
          {vista === 'pipeline' && (
            <div>
              {/* BARRA DE BÚSQUEDA Y FILTRO */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '8px',
                padding: '12px 16px',
                border: '1px solid #E2E8F0',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                  <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
                    <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                    <input
                      type="text"
                      placeholder="Buscar por cliente, contacto, teléfono, email..."
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px 7px 32px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '12.5px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <select
                    value={filtroEtapa}
                    onChange={e => setFiltroEtapa(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12.5px',
                      background: '#FFFFFF',
                      color: '#0F172A',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="todas">Todas las etapas ({oportunidades.length})</option>
                    {ETAPAS.map(et => (
                      <option key={et.id} value={et.id}>{et.label}</option>
                    ))}
                  </select>
                </div>

                {/* CONMUTADOR KANBAN / LISTA */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F1F5F9', padding: '3px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <button
                    onClick={() => setSubVistaPipeline('kanban')}
                    style={{
                      background: subVistaPipeline === 'kanban' ? '#FFFFFF' : 'transparent',
                      color: subVistaPipeline === 'kanban' ? '#0F172A' : '#64748B',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '5px 10px',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Tablero Kanban
                  </button>
                  <button
                    onClick={() => setSubVistaPipeline('tabla')}
                    style={{
                      background: subVistaPipeline === 'tabla' ? '#FFFFFF' : 'transparent',
                      color: subVistaPipeline === 'tabla' ? '#0F172A' : '#64748B',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '5px 10px',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Vista Detallada (Contactos)
                  </button>
                </div>
              </div>

              {/* KANBAN BOARD */}
              {subVistaPipeline === 'kanban' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(230px, 1fr))', gap: '12px', alignItems: 'start', overflowX: 'auto', paddingBottom: '16px' }}>
                  {ETAPAS.map(etapa => {
                    const opsColumna = oportunidadesFiltradas.filter(o => o.etapa === etapa.id)
                    const totalValorColumna = opsColumna.reduce((a, o) => a + Number(o.valor_estimado || 0), 0)

                    return (
                      <div
                        key={etapa.id}
                        style={{
                          background: '#F8FAFC',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          padding: '12px',
                          minHeight: '400px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ borderBottom: `2px solid ${etapa.color}`, paddingBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                              {etapa.label}
                            </span>
                            <span style={{
                              background: etapa.bg,
                              color: etapa.color,
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}>
                              {opsColumna.length}
                            </span>
                          </div>
                          {totalValorColumna > 0 && (
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748B', fontFamily: paleta.fontMono }}>
                              {totalValorColumna.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                            </p>
                          )}
                        </div>

                        {/* Tarjetas de Oportunidades */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {opsColumna.map(op => {
                            const { nombreEntidad, personaContacto, telefono, email, esCliente } = getDatosContactoOp(op)
                            return (
                              <div
                                key={op.id}
                                style={{
                                  background: '#FFFFFF',
                                  borderRadius: '6px',
                                  padding: '12px',
                                  border: '1px solid #CBD5E1',
                                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px'
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#0F172A', lineHeight: '1.3' }}>
                                      {nombreEntidad}
                                    </h4>
                                    <span style={{
                                      fontSize: '9.5px',
                                      fontWeight: '700',
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      background: esCliente ? '#EFF6FF' : '#F1F5F9',
                                      color: esCliente ? '#1D4ED8' : '#475569',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {esCliente ? 'CLIENTE' : 'PROSPECTO'}
                                    </span>
                                  </div>

                                  {op.tipos_servicio?.nombre && (
                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#0F766E', fontWeight: '600' }}>
                                      {op.tipos_servicio.nombre}
                                    </p>
                                  )}
                                </div>

                                {/* DATOS DE CONTACTO VISIBLES */}
                                <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '4px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#334155' }}>
                                    <span style={{ color: '#64748B', fontWeight: '600' }}>Contacto:</span>
                                    <span style={{ fontWeight: '500' }}>{personaContacto || 'No asignado'}</span>
                                  </div>

                                  {telefono && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                                      <span style={{ color: '#0F172A', fontFamily: paleta.fontMono }}>{telefono}</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); abrirModalMensajePara(op, true) }}
                                        title="Enviar WhatsApp"
                                        style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '4px', padding: '1px 5px', color: '#15803D', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                                      >
                                        WhatsApp
                                      </button>
                                    </div>
                                  )}

                                  {email && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      <Mail size={11} /> {email}
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                                  <span style={{ fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                                    {op.valor_estimado ? Number(op.valor_estimado).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }) : '—'}
                                  </span>
                                  <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                                    {op.probabilidad}% prob.
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #F1F5F9' }}>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                      onClick={() => abrirModalMensajePara(op, true)}
                                      title="Enviar Mensaje o WhatsApp"
                                      style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#0F172A' }}
                                    >
                                      <MessageSquare size={13} />
                                    </button>

                                    <button
                                      onClick={() => abrirNuevoRecordatorio(op.cliente_id || '', op.id, `Seguimiento de ${nombreEntidad}`)}
                                      title="Crear Recordatorio"
                                      style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#0F172A' }}
                                    >
                                      <Clock size={13} />
                                    </button>

                                    <button
                                      onClick={() => abrirEdicionOp(op)}
                                      title="Editar Oportunidad / Contacto"
                                      style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#0F172A' }}
                                    >
                                      <Edit size={13} />
                                    </button>

                                    {!esCliente && etapa.id === 'ganado' && (
                                      <button
                                        onClick={() => convertirEnCliente(op)}
                                        title="Dar de alta como Cliente Oficial"
                                        style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#15803D' }}
                                      >
                                        <UserPlus size={13} />
                                      </button>
                                    )}
                                  </div>

                                  <select
                                    value={op.etapa}
                                    onChange={e => cambiarEtapa(op.id, e.target.value)}
                                    style={{
                                      fontSize: '11px',
                                      padding: '3px 4px',
                                      borderRadius: '4px',
                                      border: '1px solid #CBD5E1',
                                      background: '#FFFFFF',
                                      outline: 'none',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {ETAPAS.map(et => (
                                      <option key={et.id} value={et.id}>{et.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* TABLA DETALLADA DE OPORTUNIDADES */
                <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <table style={s.tabla}>
                    <thead>
                      <tr>
                        <th style={s.tablaCabecera('#0F172A')}>Cuenta / Prospecto</th>
                        <th style={s.tablaCabecera('#0F172A')}>Contacto</th>
                        <th style={s.tablaCabecera('#0F172A')}>Teléfono / WhatsApp</th>
                        <th style={s.tablaCabecera('#0F172A')}>Correo Electrónico</th>
                        <th style={s.tablaCabecera('#0F172A')}>Servicio</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>Valor Estimado</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'center' }}>Etapa</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oportunidadesFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                            No se encontraron oportunidades con los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        oportunidadesFiltradas.map((op, i) => {
                          const { nombreEntidad, personaContacto, telefono, email, esCliente } = getDatosContactoOp(op)
                          const etapaObj = ETAPAS.find(e => e.id === op.etapa) || ETAPAS[0]

                          return (
                            <tr key={op.id} style={s.tablaFila(i)}>
                              <td style={s.tablaCellBold}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{nombreEntidad}</span>
                                  <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '3px', background: esCliente ? '#EFF6FF' : '#F1F5F9', color: esCliente ? '#1D4ED8' : '#475569' }}>
                                    {esCliente ? 'CLIENTE' : 'PROSPECTO'}
                                  </span>
                                </div>
                              </td>
                              <td style={s.tablaCell}>
                                {personaContacto || <span style={{ color: '#94A3B8' }}>—</span>}
                              </td>
                              <td style={{ ...s.tablaCell, fontFamily: paleta.fontMono }}>
                                {telefono ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{telefono}</span>
                                    <button
                                      onClick={() => abrirModalMensajePara(op, true)}
                                      title="Enviar WhatsApp"
                                      style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '4px', padding: '2px 6px', color: '#15803D', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                                    >
                                      WhatsApp
                                    </button>
                                  </div>
                                ) : <span style={{ color: '#94A3B8' }}>—</span>}
                              </td>
                              <td style={s.tablaCell}>
                                {email ? (
                                  <a href={`mailto:${email}`} style={{ color: '#2563EB', textDecoration: 'none', fontSize: '12px' }}>
                                    {email}
                                  </a>
                                ) : <span style={{ color: '#94A3B8' }}>—</span>}
                              </td>
                              <td style={s.tablaCell}>
                                {op.tipos_servicio?.nombre || '—'}
                              </td>
                              <td style={{ ...s.tablaCell, textAlign: 'right', fontFamily: paleta.fontMono, fontWeight: '700' }}>
                                {op.valor_estimado ? Number(op.valor_estimado).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }) : '—'}
                              </td>
                              <td style={{ ...s.tablaCell, textAlign: 'center' }}>
                                <span style={{
                                  background: etapaObj.bg,
                                  color: etapaObj.color,
                                  border: `1px solid ${etapaObj.color}40`,
                                  borderRadius: '4px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: '600'
                                }}>
                                  {etapaObj.label}
                                </span>
                              </td>
                              <td style={{ ...s.tablaCell, textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                  <button
                                    onClick={() => abrirModalMensajePara(op, true)}
                                    title="Enviar mensaje"
                                    style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '5px 7px', cursor: 'pointer' }}
                                  >
                                    <MessageSquare size={13} color="#2563EB" />
                                  </button>
                                  <button
                                    onClick={() => abrirNuevoRecordatorio(op.cliente_id || '', op.id, `Seguimiento de ${nombreEntidad}`)}
                                    title="Programar recordatorio"
                                    style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '5px 7px', cursor: 'pointer' }}
                                  >
                                    <Clock size={13} color="#D97706" />
                                  </button>
                                  <button
                                    onClick={() => abrirEdicionOp(op)}
                                    title="Editar datos"
                                    style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '5px 7px', cursor: 'pointer' }}
                                  >
                                    <Edit size={13} color="#475569" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* 2. GESTIÓN DE CLIENTES & ACCIONES DE CONTACTO */}
          {/* ============================================================ */}
          {vista === 'clientes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '14px 18px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
                  <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                  <input
                    type="text"
                    placeholder="Buscar clientes por nombre, CUIT, contacto, teléfono..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px', outline: 'none' }}
                  />
                </div>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  {clientes.length} cuentas registradas en cartera
                </span>
              </div>

              <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <table style={s.tabla}>
                  <thead>
                    <tr>
                      <th style={s.tablaCabecera('#0F172A')}>Empresa / Razón Social</th>
                      <th style={s.tablaCabecera('#0F172A')}>Contacto Principal</th>
                      <th style={s.tablaCabecera('#0F172A')}>Teléfono / WhatsApp</th>
                      <th style={s.tablaCabecera('#0F172A')}>Correo Electrónico</th>
                      <th style={s.tablaCabecera('#0F172A')}>Último Contacto</th>
                      <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'center' }}>Estado de Cuenta</th>
                      <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'center' }}>Acciones Rápidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.filter(cl => {
                      const q = busqueda.toLowerCase().trim()
                      return !q ||
                        (cl.razon_social && cl.razon_social.toLowerCase().includes(q)) ||
                        (cl.nombre_contacto && cl.nombre_contacto.toLowerCase().includes(q)) ||
                        (cl.telefono && cl.telefono.includes(q)) ||
                        (cl.email && cl.email.toLowerCase().includes(q)) ||
                        (cl.cuit && cl.cuit.includes(q))
                    }).map((cl, i) => {
                      const dias = diasDesde(ultimoContactoPorCliente[cl.id])
                      const tieneFacturaVencida = clientesConFacturaVencida.has(cl.id)

                      return (
                        <tr key={cl.id} style={s.tablaFila(i)}>
                          <td style={s.tablaCellBold}>
                            <div>
                              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                                {cl.razon_social || cl.nombre_contacto}
                              </p>
                              {cl.cuit && <span style={{ fontSize: '11px', color: '#64748B', fontFamily: paleta.fontMono }}>CUIT: {cl.cuit}</span>}
                            </div>
                          </td>
                          <td style={s.tablaCell}>
                            {cl.nombre_contacto || <span style={{ color: '#94A3B8' }}>Sin contacto</span>}
                          </td>
                          <td style={{ ...s.tablaCell, fontFamily: paleta.fontMono }}>
                            {cl.telefono ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{cl.telefono}</span>
                                <button
                                  onClick={() => abrirModalMensajePara(cl, false)}
                                  title="Enviar WhatsApp"
                                  style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '4px', padding: '2px 6px', color: '#15803D', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                                >
                                  WhatsApp
                                </button>
                              </div>
                            ) : <span style={{ color: '#94A3B8' }}>—</span>}
                          </td>
                          <td style={s.tablaCell}>
                            {cl.email ? (
                              <a href={`mailto:${cl.email}`} style={{ color: '#2563EB', textDecoration: 'none', fontSize: '12px' }}>
                                {cl.email}
                              </a>
                            ) : <span style={{ color: '#94A3B8' }}>—</span>}
                          </td>
                          <td style={s.tablaCell}>
                            {dias != null ? (
                              <span style={{ fontSize: '12px', color: dias > 45 ? '#BE123C' : '#334155', fontWeight: dias > 45 ? '600' : '400' }}>
                                Hace {dias} días
                              </span>
                            ) : (
                              <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>Sin registro</span>
                            )}
                          </td>
                          <td style={{ ...s.tablaCell, textAlign: 'center' }}>
                            {tieneFacturaVencida ? (
                              <span style={{ background: '#FFE4E6', color: '#BE123C', border: '1px solid #FECDD3', borderRadius: '4px', padding: '2px 7px', fontSize: '11px', fontWeight: '700' }}>
                                Factura Vencida
                              </span>
                            ) : dias != null && dias > 45 ? (
                              <span style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', borderRadius: '4px', padding: '2px 7px', fontSize: '11px', fontWeight: '600' }}>
                                Sin Contacto
                              </span>
                            ) : (
                              <span style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', borderRadius: '4px', padding: '2px 7px', fontSize: '11px', fontWeight: '600' }}>
                                Al Día
                              </span>
                            )}
                          </td>
                          <td style={{ ...s.tablaCell, textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                onClick={() => abrirModalMensajePara(cl, false)}
                                title="Enviar mensaje"
                                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: '600', color: '#0F172A' }}
                              >
                                <MessageSquare size={13} color="#2563EB" /> Mensaje
                              </button>

                              <button
                                onClick={() => abrirNuevoRecordatorio(cl.id, '', `Seguimiento de ${cl.razon_social || cl.nombre_contacto}`)}
                                title="Programar recordatorio"
                                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: '600', color: '#0F172A' }}
                              >
                                <Clock size={13} color="#B45309" /> Recordar
                              </button>

                              <button
                                onClick={() => setClienteFichaSeleccionado(cl)}
                                title="Ver Ficha Integral"
                                style={{ background: '#0F766E', color: '#FFFFFF', border: 'none', borderRadius: '5px', padding: '5px 8px', fontSize: '11.5px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                Ficha
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 3. RECORDATORIOS & TAREAS DE SEGUIMIENTO */}
          {/* ============================================================ */}
          {vista === 'tareas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Alerta si hay recordatorios programados para hoy */}
              {tareasHoy.length > 0 && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="#B45309" />
                  <span style={{ fontSize: '12.5px', color: '#92400E', fontWeight: '600' }}>
                    Tenés {tareasHoy.length} recordatorio(s) programado(s) para gestionar hoy.
                  </span>
                </div>
              )}

              {/* Selector de filtro de tareas */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { id: 'pendiente', label: 'Pendientes' },
                    { id: 'completada', label: 'Completadas' },
                    { id: 'todas', label: 'Todas las tareas' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFiltroTareas(f.id)}
                      style={{
                        background: filtroTareas === f.id ? '#0F172A' : '#FFFFFF',
                        color: filtroTareas === f.id ? '#FFFFFF' : '#64748B',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => abrirNuevoRecordatorio()}
                  style={{
                    background: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '7px 14px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={14} /> Nuevo Recordatorio
                </button>
              </div>

              {/* Lista de Tareas */}
              <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                {tareas.filter(t => filtroTareas === 'todas' || t.estado === filtroTareas).length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                    No hay recordatorios registrados para este filtro.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {tareas.filter(t => filtroTareas === 'todas' || t.estado === filtroTareas).map((t, i) => {
                      const hoy = new Date().toISOString().split('T')[0]
                      const vencida = t.estado === 'pendiente' && t.fecha_vencimiento && t.fecha_vencimiento < hoy
                      const esHoy = t.estado === 'pendiente' && t.fecha_vencimiento === hoy

                      return (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 20px',
                            borderBottom: i < tareas.length - 1 ? '1px solid #F1F5F9' : 'none',
                            background: vencida ? '#FFF1F2' : (esHoy ? '#FFFBEB' : '#FFFFFF'),
                            opacity: t.estado === 'completada' ? 0.6 : 1
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                            <button
                              onClick={() => completarTarea(t)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              <CheckCircle2
                                size={20}
                                color={t.estado === 'completada' ? '#15803D' : '#CBD5E1'}
                                fill={t.estado === 'completada' ? '#DCFCE7' : 'none'}
                              />
                            </button>

                            <div>
                              <p style={{
                                margin: 0,
                                fontSize: '13.5px',
                                fontWeight: '600',
                                color: '#0F172A',
                                textDecoration: t.estado === 'completada' ? 'line-through' : 'none'
                              }}>
                                {t.titulo}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px', fontSize: '12px' }}>
                                <span style={{ color: '#475569', fontWeight: '500' }}>
                                  {t.clientes?.razon_social || t.clientes?.nombre_contacto || 'Recordatorio General'}
                                </span>
                                {t.fecha_vencimiento && (
                                  <span style={{
                                    fontFamily: paleta.fontMono,
                                    color: vencida ? '#BE123C' : (esHoy ? '#B45309' : '#64748B'),
                                    fontWeight: vencida || esHoy ? '700' : '400'
                                  }}>
                                    {vencida ? `⚠️ Venció el ${t.fecha_vencimiento}` : (esHoy ? `⏰ VENCE HOY` : `Vence ${t.fecha_vencimiento}`)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              background: t.prioridad === 'alta' ? '#FEE2E2' : (t.prioridad === 'media' ? '#FEF3C7' : '#F1F5F9'),
                              color: t.prioridad === 'alta' ? '#BE123C' : (t.prioridad === 'media' ? '#B45309' : '#475569')
                            }}>
                              Prioridad {t.prioridad}
                            </span>

                            {t.clientes?.telefono && (
                              <button
                                onClick={() => abrirModalMensajePara(t.clientes, false)}
                                title="Enviar mensaje de seguimiento"
                                style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '5px', padding: '5px 8px', fontSize: '11.5px', fontWeight: '600', color: '#15803D', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <MessageSquare size={12} /> Contactar
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 4. PANEL DE MÉTRICAS & SALUD DE CARTERA */}
          {/* ============================================================ */}
          {vista === 'panel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '16px', border: '1px solid #E2E8F0', borderTop: '3px solid #BE123C' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Clientes en Riesgo</span>
                  <p style={{ margin: '6px 0 0', fontSize: '24px', fontWeight: '700', color: '#BE123C', fontFamily: paleta.fontMono }}>{clientesEnRiesgo.length}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748B' }}>Con facturas vencidas o sin contacto reciente</p>
                </div>

                <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '16px', border: '1px solid #E2E8F0', borderTop: '3px solid #B45309' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Tareas Vencidas</span>
                  <p style={{ margin: '6px 0 0', fontSize: '24px', fontWeight: '700', color: '#B45309', fontFamily: paleta.fontMono }}>{tareasVencidas.length}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748B' }}>Requieren resolución inmediata</p>
                </div>

                <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '16px', border: '1px solid #E2E8F0', borderTop: '3px solid #2563EB' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Valor en Pipeline</span>
                  <p style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                    {valorPipeline.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748B' }}>{opsAbiertas.length} propuestas abiertas</p>
                </div>

                <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '16px', border: '1px solid #E2E8F0', borderTop: '3px solid #15803D' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Tasa de Conversión</span>
                  <p style={{ margin: '6px 0 0', fontSize: '24px', fontWeight: '700', color: '#15803D', fontFamily: paleta.fontMono }}>
                    {tasaConversion != null ? `${tasaConversion.toFixed(0)}%` : '—'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748B' }}>{ganadas} ganadas vs {perdidas} perdidas</p>
                </div>
              </div>

              {/* LISTA DE CLIENTES EN RIESGO CON BOTÓN DE CONTACTO RÁPIDO */}
              <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '20px', border: '1px solid #E2E8F0' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: '14.5px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} color="#BE123C" /> Cuentas que requieren contacto de seguimiento
                </h4>

                {clientesEnRiesgo.length === 0 ? (
                  <p style={{ margin: 0, color: '#15803D', fontSize: '13px' }}>Excelente: todas las cuentas han tenido contacto reciente y no presentan mora.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                    {clientesEnRiesgo.map(cl => {
                      const dias = diasDesde(ultimoContactoPorCliente[cl.id])
                      const moroso = clientesConFacturaVencida.has(cl.id)
                      return (
                        <div key={cl.id} style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '14px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: '#0F172A' }}>{cl.razon_social || cl.nombre_contacto}</p>
                              {moroso && <span style={{ background: '#FFE4E6', color: '#BE123C', fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '3px' }}>Factura Vencida</span>}
                            </div>
                            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748B' }}>
                              {cl.nombre_contacto ? `Contacto: ${cl.nombre_contacto}` : 'Sin contacto'}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#334155' }}>
                              {dias != null ? `Última interacción: hace ${dias} días` : 'Sin interacciones previas registradas'}
                            </p>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                            <button
                              onClick={() => abrirModalMensajePara(cl, false)}
                              style={{ flex: 1, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '5px', padding: '5px 8px', fontSize: '11.5px', fontWeight: '600', color: '#0F172A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <MessageSquare size={12} color="#2563EB" /> Contactar
                            </button>
                            <button
                              onClick={() => abrirNuevoRecordatorio(cl.id, '', `Seguimiento de ${cl.razon_social || cl.nombre_contacto}`)}
                              style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '5px', padding: '5px 8px', fontSize: '11.5px', fontWeight: '600', color: '#0F172A', cursor: 'pointer' }}
                            >
                              Recordar
                            </button>
                            <button
                              onClick={() => setClienteFichaSeleccionado(cl)}
                              style={{ background: '#0F766E', color: '#FFFFFF', border: 'none', borderRadius: '5px', padding: '5px 8px', fontSize: '11.5px', fontWeight: '600', cursor: 'pointer' }}
                            >
                              Ficha
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* MODAL: NUEVA / EDITAR OPORTUNIDAD CON DATOS DE CONTACTO */}
      {/* ============================================================ */}
      {mostrarFormOp && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '10px', padding: '26px', width: '100%', maxWidth: '680px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', border: '1px solid #CBD5E1', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563EB', textTransform: 'uppercase' }}>
                  {opEditando ? 'Editar Oportunidad Comercial' : 'Nueva Oportunidad Comercial'}
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '17px', fontWeight: '700', color: '#0F172A' }}>
                  {opEditando ? 'Actualizar Datos y Contacto' : 'Registrar Prospecto o Proyecto'}
                </h3>
              </div>
              <button onClick={cerrarFormOp} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={guardarOportunidad}>
              {!opEditando && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', background: '#F1F5F9', padding: '4px', borderRadius: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setEsProspectoNuevo(true)}
                    style={{
                      flex: 1, padding: '6px', borderRadius: '4px', border: 'none',
                      background: esProspectoNuevo ? '#FFFFFF' : 'transparent',
                      color: esProspectoNuevo ? '#0F172A' : '#64748B', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer'
                    }}
                  >
                    Nuevo Prospecto (Lead)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEsProspectoNuevo(false)}
                    style={{
                      flex: 1, padding: '6px', borderRadius: '4px', border: 'none',
                      background: !esProspectoNuevo ? '#FFFFFF' : 'transparent',
                      color: !esProspectoNuevo ? '#0F172A' : '#64748B', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer'
                    }}
                  >
                    Cliente Existente de Cartera
                  </button>
                </div>
              )}

              <div style={s.grid2}>
                {esProspectoNuevo ? (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={s.label}>Nombre de la Empresa o Prospecto *</label>
                    <input
                      style={s.input}
                      required
                      placeholder="Ej. Clínica San Lucas, Edificio Torre Belgrano..."
                      value={formOp.nombre_prospecto}
                      onChange={e => setFormOp({ ...formOp, nombre_prospecto: e.target.value })}
                    />
                  </div>
                ) : (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={s.label}>Seleccionar Cliente de Cartera *</label>
                    <select
                      style={s.input}
                      required
                      value={formOp.cliente_id}
                      onChange={e => {
                        const cid = e.target.value
                        const cl = clientes.find(c => c.id === cid)
                        setFormOp({
                          ...formOp,
                          cliente_id: cid,
                          contacto_prospecto: cl?.nombre_contacto || formOp.contacto_prospecto,
                          telefono_prospecto: cl?.telefono || formOp.telefono_prospecto,
                          email_prospecto: cl?.email || formOp.email_prospecto
                        })
                      }}
                    >
                      <option value="">Seleccionar cliente…</option>
                      {clientes.map(cl => (
                        <option key={cl.id} value={cl.id}>{cl.razon_social || cl.nombre_contacto}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* DATOS DE CONTACTO */}
                <div>
                  <label style={s.label}>Persona de Contacto / Responsable</label>
                  <input
                    style={s.input}
                    placeholder="Ej. Lic. Laura Rodríguez"
                    value={formOp.contacto_prospecto}
                    onChange={e => setFormOp({ ...formOp, contacto_prospecto: e.target.value })}
                  />
                </div>

                <div>
                  <label style={s.label}>Teléfono / Celular (WhatsApp)</label>
                  <input
                    style={s.input}
                    placeholder="Ej. 3814123456"
                    value={formOp.telefono_prospecto}
                    onChange={e => setFormOp({ ...formOp, telefono_prospecto: e.target.value })}
                  />
                </div>

                <div>
                  <label style={s.label}>Correo Electrónico</label>
                  <input
                    type="email"
                    style={s.input}
                    placeholder="ejemplo@empresa.com"
                    value={formOp.email_prospecto}
                    onChange={e => setFormOp({ ...formOp, email_prospecto: e.target.value })}
                  />
                </div>

                <div>
                  <label style={s.label}>Tipo de Servicio</label>
                  <select
                    style={s.input}
                    value={formOp.tipo_servicio_id}
                    onChange={e => setFormOp({ ...formOp, tipo_servicio_id: e.target.value })}
                  >
                    <option value="">Sin especificar…</option>
                    {tiposServicio.map(ts => (
                      <option key={ts.id} value={ts.id}>{ts.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={s.label}>Valor Estimado Mensual ($)</label>
                  <input
                    type="number"
                    style={s.input}
                    placeholder="Ej. 350000"
                    value={formOp.valor_estimado}
                    onChange={e => setFormOp({ ...formOp, valor_estimado: e.target.value })}
                  />
                </div>

                <div>
                  <label style={s.label}>Probabilidad de Cierre (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    style={s.input}
                    value={formOp.probabilidad}
                    onChange={e => setFormOp({ ...formOp, probabilidad: e.target.value })}
                  />
                </div>

                <div>
                  <label style={s.label}>Fecha Estimada de Cierre</label>
                  <input
                    type="date"
                    style={s.input}
                    value={formOp.fecha_estimada_cierre}
                    onChange={e => setFormOp({ ...formOp, fecha_estimada_cierre: e.target.value })}
                  />
                </div>

                <div>
                  <label style={s.label}>Etapa Comercial</label>
                  <select
                    style={s.input}
                    value={formOp.etapa}
                    onChange={e => setFormOp({ ...formOp, etapa: e.target.value })}
                  >
                    {ETAPAS.map(et => (
                      <option key={et.id} value={et.id}>{et.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Notas y Requerimientos del Cliente</label>
                  <textarea
                    rows={3}
                    style={{ ...s.input, resize: 'vertical' }}
                    placeholder="Detalles sobre frecuencia, m2, turnos o requerimientos especiales..."
                    value={formOp.notas}
                    onChange={e => setFormOp({ ...formOp, notas: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px', paddingTop: '14px', borderTop: '1px solid #E2E8F0' }}>
                <button type="button" onClick={cerrarFormOp} style={s.btnSecundario}>
                  Cancelar
                </button>
                <button type="submit" style={s.btnPrimario('#2563EB')}>
                  {opEditando ? 'Actualizar Oportunidad' : 'Guardar Oportunidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ENVIAR MENSAJE / WHATSAPP DIRECTO */}
      {/* ============================================================ */}
      {mostrarModalMensaje && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '10px', padding: '24px', width: '100%', maxWidth: '560px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', border: '1px solid #CBD5E1'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#16A34A', textTransform: 'uppercase' }}>Comunicaciones Comerciales</span>
                <h3 style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
                  Enviar Mensaje a {datosMensaje.destinatario}
                </h3>
              </div>
              <button onClick={() => setMostrarModalMensaje(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={s.label}>Teléfono / WhatsApp</label>
                  <input
                    style={s.input}
                    placeholder="Ej. 3814123456"
                    value={datosMensaje.telefono}
                    onChange={e => setDatosMensaje({ ...datosMensaje, telefono: e.target.value })}
                  />
                </div>
                <div>
                  <label style={s.label}>Correo Electrónico</label>
                  <input
                    type="email"
                    style={s.input}
                    placeholder="correo@empresa.com"
                    value={datosMensaje.email}
                    onChange={e => setDatosMensaje({ ...datosMensaje, email: e.target.value })}
                  />
                </div>
              </div>

              {/* Plantillas predefinidas de mensaje */}
              <div>
                <label style={s.label}>Plantillas Rápidas</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'propuesta', label: 'Seguimiento Propuesta' },
                    { id: 'visita', label: 'Coordinar Visita' },
                    { id: 'recordatorio', label: 'Recordatorio Amable' },
                    { id: 'factura', label: 'Estado de Cuenta' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => aplicarPlantillaMensaje(p.id)}
                      style={{
                        background: datosMensaje.plantilla === p.id ? '#EFF6FF' : '#F1F5F9',
                        color: datosMensaje.plantilla === p.id ? '#1D4ED8' : '#475569',
                        border: `1px solid ${datosMensaje.plantilla === p.id ? '#BFDBFE' : '#E2E8F0'}`,
                        borderRadius: '4px',
                        padding: '4px 9px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Texto del Mensaje */}
              <div>
                <label style={s.label}>Cuerpo del Mensaje</label>
                <textarea
                  rows={4}
                  style={{ ...s.input, resize: 'vertical' }}
                  value={datosMensaje.textoMensaje}
                  onChange={e => setDatosMensaje({ ...datosMensaje, textoMensaje: e.target.value })}
                />
              </div>

              {/* Checkbox registrar en bitácora */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={datosMensaje.registrarBitacora}
                  onChange={e => setDatosMensaje({ ...datosMensaje, registrarBitacora: e.target.checked })}
                />
                <span>Registrar automáticamente en el historial de interacciones del cliente</span>
              </label>

              {/* Botones de Envío */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', paddingTop: '14px', borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  onClick={ejecutarEnvioWhatsApp}
                  style={{
                    flex: 1,
                    background: '#16A34A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <MessageSquare size={15} />
                  <span>Abrir en WhatsApp</span>
                </button>

                {datosMensaje.email && (
                  <button
                    type="button"
                    onClick={ejecutarEnvioEmail}
                    style={{
                      flex: 1,
                      background: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '9px 14px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Mail size={15} />
                    <span>Enviar por Correo</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: NUEVO RECORDATORIO / TAREA DE SEGUIMIENTO */}
      {/* ============================================================ */}
      {mostrarModalRecordatorio && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '10px', padding: '24px', width: '100%', maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', border: '1px solid #CBD5E1'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#B45309', textTransform: 'uppercase' }}>Gestión de Tareas</span>
                <h3 style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
                  Programar Recordatorio de Seguimiento
                </h3>
              </div>
              <button onClick={() => setMostrarModalRecordatorio(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={guardarRecordatorio}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={s.label}>Asunto / Título del Recordatorio *</label>
                  <input
                    style={s.input}
                    required
                    placeholder="Ej. Llamar para confirmar recepción de propuesta..."
                    value={formRecordatorio.titulo}
                    onChange={e => setFormRecordatorio({ ...formRecordatorio, titulo: e.target.value })}
                  />
                </div>

                {/* Accesos rápidos de títulos */}
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {['Llamar por cotización', 'Enviar presupuesto', 'Reunión de avance', 'Coordinar visita técnica', 'Consultar estado'].map(sug => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setFormRecordatorio({ ...formRecordatorio, titulo: sug })}
                      style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', color: '#475569', cursor: 'pointer' }}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>

                <div>
                  <label style={s.label}>Cliente Asignado (Opcional)</label>
                  <select
                    style={s.input}
                    value={formRecordatorio.cliente_id}
                    onChange={e => setFormRecordatorio({ ...formRecordatorio, cliente_id: e.target.value })}
                  >
                    <option value="">Sin cliente asignado…</option>
                    {clientes.map(cl => (
                      <option key={cl.id} value={cl.id}>{cl.razon_social || cl.nombre_contacto}</option>
                    ))}
                  </select>
                </div>

                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Fecha de Vencimiento</label>
                    <input
                      type="date"
                      required
                      style={s.input}
                      value={formRecordatorio.fecha_vencimiento}
                      onChange={e => setFormRecordatorio({ ...formRecordatorio, fecha_vencimiento: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={s.label}>Nivel de Prioridad</label>
                    <select
                      style={s.input}
                      value={formRecordatorio.prioridad}
                      onChange={e => setFormRecordatorio({ ...formRecordatorio, prioridad: e.target.value })}
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta (Urgente)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #E2E8F0' }}>
                  <button type="button" onClick={() => setMostrarModalRecordatorio(false)} style={s.btnSecundario}>
                    Cancelar
                  </button>
                  <button type="submit" style={s.btnPrimario('#B45309')}>
                    Guardar Recordatorio
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: FICHA INTEGRAL DE CLIENTE */}
      {/* ============================================================ */}
      {clienteFichaSeleccionado && (
        <FichaCliente
          cliente={clienteFichaSeleccionado}
          onClose={() => setClienteFichaSeleccionado(null)}
        />
      )}

    </div>
  )
}

export default CRM
