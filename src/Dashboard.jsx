import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import { colores, paleta } from './estilos.js'
import {
  Home, Users, FileText, HardHat, CalendarDays, Wallet, Receipt, Package,
  BarChart3, ClipboardList, Briefcase, Factory, TrendingUp, UserCog,
  Bell, CheckCircle2, LogOut, ChevronLeft, ChevronRight, RefreshCw, ArrowRight
} from 'lucide-react'
import Clientes from './pages/Clientes.jsx'
import Contratos from './pages/Contratos.jsx'
import Personal from './pages/Personal.jsx'
import Agenda from './pages/Agenda.jsx'
import Presupuestos from './pages/Presupuestos.jsx'
import Facturacion from './pages/Facturacion.jsx'
import Insumos from './pages/Insumos.jsx'
import Finanzas from './pages/Finanzas.jsx'
import Costos from './pages/Costos.jsx'
import Sueldos from './pages/Sueldos.jsx'
import Proveedores from './pages/Proveedores.jsx'
import Reportes from './pages/Reportes.jsx'
import Usuarios from './pages/Usuarios.jsx'

// Módulos restringidos a rol admin (coincide con las políticas RLS en Supabase)
const SOLO_ADMIN = ['facturacion', 'finanzas', 'costos', 'sueldos', 'usuarios']

const GRUPOS_MENU = [
  {
    label: 'Operación',
    items: [
      { id: 'clientes',    icon: Users,       label: 'Clientes' },
      { id: 'contratos',   icon: FileText,    label: 'Contratos' },
      { id: 'agenda',      icon: CalendarDays,label: 'Agenda' },
      { id: 'personal',    icon: HardHat,     label: 'Personal' },
      { id: 'insumos',     icon: Package,     label: 'Insumos' },
      { id: 'proveedores', icon: Factory,     label: 'Proveedores' },
    ]
  },
  {
    label: 'Administración',
    items: [
      { id: 'presupuestos', icon: Wallet,        label: 'Presupuestos' },
      { id: 'facturacion',  icon: Receipt,       label: 'Facturación' },
      { id: 'finanzas',     icon: BarChart3,     label: 'Finanzas' },
      { id: 'costos',       icon: ClipboardList, label: 'Costos' },
      { id: 'sueldos',      icon: Briefcase,     label: 'Sueldos' },
    ]
  },
  {
    label: 'Sistema',
    items: [
      { id: 'reportes', icon: TrendingUp, label: 'Reportes' },
      { id: 'usuarios', icon: UserCog,    label: 'Usuarios' },
    ]
  }
]

const TODOS_LOS_ITEMS = GRUPOS_MENU.flatMap(g => g.items)

const ACCESOS_RAPIDOS = [
  { id: 'clientes',     icon: Users,        label: 'Clientes' },
  { id: 'contratos',    icon: FileText,     label: 'Contratos' },
  { id: 'agenda',       icon: CalendarDays, label: 'Agenda' },
  { id: 'personal',     icon: HardHat,      label: 'Personal' },
  { id: 'insumos',      icon: Package,      label: 'Insumos' },
  { id: 'proveedores',  icon: Factory,      label: 'Proveedores' },
  { id: 'presupuestos', icon: Wallet,       label: 'Presupuestos' },
  { id: 'facturacion',  icon: Receipt,      label: 'Facturación' },
  { id: 'finanzas',     icon: BarChart3,    label: 'Finanzas' },
  { id: 'costos',       icon: ClipboardList,label: 'Costos' },
  { id: 'sueldos',      icon: Briefcase,    label: 'Sueldos' },
  { id: 'reportes',     icon: TrendingUp,   label: 'Reportes' },
]

const alertaEstilo = {
  danger:  { dot: paleta.danger, text: paleta.danger },
  warning: { dot: paleta.warn,   text: paleta.warn },
  info:    { dot: paleta.info,   text: paleta.info },
}

function Dashboard({ user }) {
  const [seccionActiva, setSeccionActiva] = useState('inicio')
  const [menuAbierto, setMenuAbierto] = useState(true)
  const [esAdmin, setEsAdmin] = useState(false)
  const [rolCargado, setRolCargado] = useState(false)
  const [kpis, setKpis] = useState({ clientes:0, contratos:0, empleados:0, serviciosHoy:0, ingresosMes:0, facturasPendientes:0 })
  const [alertas, setAlertas] = useState([])

  useEffect(() => { cargarRol() }, [])
  useEffect(() => { if (seccionActiva === 'inicio') { cargarKpis(); cargarAlertas() } }, [seccionActiva])

  async function cargarRol() {
    const { data } = await supabase.from('usuarios_sistema').select('rol').eq('user_id', user.id).maybeSingle()
    setEsAdmin(data?.rol === 'admin')
    setRolCargado(true)
  }

  async function cargarKpis() {
    const mes = new Date().toISOString().slice(0, 7)
    const hoy = new Date().toISOString().split('T')[0]
    const [{ count: clientes }, { count: contratos }, { count: empleados }, { count: serviciosHoy }, { data: ingresos }, { data: facturas }] = await Promise.all([
      supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('contratos').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
      supabase.from('empleados').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('ordenes_trabajo').select('*', { count: 'exact', head: true }).eq('fecha_programada', hoy),
      supabase.from('movimientos_financieros').select('monto').eq('tipo', 'ingreso').gte('fecha', mes+'-01').lte('fecha', mes+'-'+new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()),
      supabase.from('facturas').select('total').in('estado', ['pendiente','parcial','vencida']),
    ])
    setKpis({ clientes:clientes||0, contratos:contratos||0, empleados:empleados||0, serviciosHoy:serviciosHoy||0, ingresosMes:(ingresos||[]).reduce((a,m)=>a+Number(m.monto),0), facturasPendientes:(facturas||[]).reduce((a,f)=>a+Number(f.total),0) })
  }

  async function cargarAlertas() {
    const hoy = new Date()
    const en7dias = new Date(hoy); en7dias.setDate(hoy.getDate() + 7)
    const en30dias = new Date(hoy); en30dias.setDate(hoy.getDate() + 30)
    const mes = hoy.toISOString().slice(0, 7)
    const nuevasAlertas = []

    const { data: facVencidas } = await supabase.from('facturas').select('numero_factura, total, fecha_vencimiento, clientes(razon_social,nombre_contacto)').eq('estado','pendiente').lt('fecha_vencimiento', hoy.toISOString().split('T')[0])
    ;(facVencidas||[]).forEach(f => nuevasAlertas.push({ tipo:'danger', titulo:'Factura vencida', detalle:`${f.numero_factura} — ${f.clientes?.razon_social||f.clientes?.nombre_contacto}`, monto: Number(f.total), modulo:'facturacion' }))

    const { data: facPorVencer } = await supabase.from('facturas').select('numero_factura, total, fecha_vencimiento, clientes(razon_social,nombre_contacto)').eq('estado','pendiente').gte('fecha_vencimiento', hoy.toISOString().split('T')[0]).lte('fecha_vencimiento', en7dias.toISOString().split('T')[0])
    ;(facPorVencer||[]).forEach(f => nuevasAlertas.push({ tipo:'warning', titulo:'Factura vence en 7 días', detalle:`${f.numero_factura} — ${f.clientes?.razon_social||f.clientes?.nombre_contacto}`, monto: Number(f.total), modulo:'facturacion' }))

    const { data: empleadosActivos } = await supabase.from('empleados').select('id, nombre, apellido').eq('activo', true)
    const { data: liquidacionesMes } = await supabase.from('liquidaciones_sueldo').select('empleado_id').eq('periodo', mes)
    const liquidados = (liquidacionesMes||[]).map(l => l.empleado_id)
    const sinLiquidar = (empleadosActivos||[]).filter(e => !liquidados.includes(e.id))
    if (sinLiquidar.length > 0) nuevasAlertas.push({ tipo:'warning', titulo:`${sinLiquidar.length} sueldo(s) sin liquidar`, detalle: sinLiquidar.map(e => e.apellido + ' ' + e.nombre).join(', '), modulo:'sueldos' })

    const { data: stockBajo } = await supabase.from('insumos').select('nombre, stock_actual, stock_minimo').eq('activo', true)
    const stockBajoFiltrado = (stockBajo||[]).filter(i => Number(i.stock_actual) <= Number(i.stock_minimo)); if (stockBajoFiltrado.length > 0) nuevasAlertas.push({ tipo:'warning', titulo:`${stockBajoFiltrado.length} insumo(s) bajo stock mínimo`, detalle: stockBajoFiltrado.map(i => i.nombre).join(', '), modulo:'insumos' })

    const { data: contVencer } = await supabase.from('contratos').select('numero_contrato, fecha_fin, clientes(razon_social,nombre_contacto)').eq('estado','activo').not('fecha_fin','is',null).lte('fecha_fin', en30dias.toISOString().split('T')[0]).gte('fecha_fin', hoy.toISOString().split('T')[0])
    ;(contVencer||[]).forEach(ct => nuevasAlertas.push({ tipo:'info', titulo:'Contrato vence en 30 días', detalle:`${ct.numero_contrato} — ${ct.clientes?.razon_social||ct.clientes?.nombre_contacto}`, modulo:'contratos' }))

    setAlertas(nuevasAlertas.filter(a => esAdmin || !SOLO_ADMIN.includes(a.modulo)))
  }

  const menuVisible = GRUPOS_MENU.map(g => ({ ...g, items: g.items.filter(i => esAdmin || !SOLO_ADMIN.includes(i.id)) })).filter(g => g.items.length > 0)
  const accesosVisibles = ACCESOS_RAPIDOS.filter(a => esAdmin || !SOLO_ADMIN.includes(a.id))

  const tarjetasTodas = [
    { label:'Ingresos del mes',    valor:kpis.ingresosMes,        tipo:'dinero', modulo:'finanzas',    icon:BarChart3, destacada:true },
    { label:'Facturas pendientes', valor:kpis.facturasPendientes, tipo:'dinero', modulo:'facturacion', icon:Receipt },
    { label:'Clientes activos',    valor:kpis.clientes,           tipo:'numero', modulo:'clientes',    icon:Users },
    { label:'Contratos activos',   valor:kpis.contratos,          tipo:'numero', modulo:'contratos',   icon:FileText },
    { label:'Empleados activos',   valor:kpis.empleados,          tipo:'numero', modulo:'personal',    icon:HardHat },
    { label:'Servicios hoy',       valor:kpis.serviciosHoy,       tipo:'numero', modulo:'agenda',      icon:CalendarDays },
  ].filter(t => esAdmin || !SOLO_ADMIN.includes(t.modulo))

  const hero = tarjetasTodas.find(t => t.destacada) || tarjetasTodas[0]
  const secundarias = tarjetasTodas.filter(t => t !== hero)

  const itemActivo = TODOS_LOS_ITEMS.find(m => m.id === seccionActiva)
  const nombreUsuario = user.email.split('@')[0]

  if (!rolCargado) return (
    <div style={{ minHeight:'100vh', background:paleta.ink, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'14px' }}>Cargando…</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:paleta.paper, display:'flex', fontFamily:paleta.font }}>

      {/* ---------- SIDEBAR ---------- */}
      <div style={{ width:menuAbierto?'232px':'68px', background:paleta.ink, display:'flex', flexDirection:'column', transition:'width 0.2s ease', flexShrink:0 }}>
        <div style={{ padding:menuAbierto?'18px 16px':'18px 10px', display:'flex', alignItems:'center', justifyContent:'space-between', minHeight:'72px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          {menuAbierto ? (
            <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:0 }}>
              <div style={{ background:'#fff', borderRadius:'8px', padding:'3px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src="/logo.jpg" alt="Briseo" style={{ height:'30px', width:'30px', objectFit:'contain', borderRadius:'5px' }} />
              </div>
              <div style={{ minWidth:0 }}>
                <p style={{ margin:0, color:'#fff', fontWeight:'700', fontSize:'14px', whiteSpace:'nowrap' }}>Briseo</p>
                <p style={{ margin:0, color:'rgba(255,255,255,0.5)', fontSize:'11px', whiteSpace:'nowrap' }}>Gestión operativa</p>
              </div>
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:'8px', padding:'3px', margin:'0 auto' }}>
              <img src="/logo.jpg" alt="Briseo" style={{ height:'26px', width:'26px', objectFit:'contain', borderRadius:'4px' }} />
            </div>
          )}
        </div>

        <nav style={{ flex:1, padding:'14px 10px', overflowY:'auto' }}>
          <button onClick={() => setSeccionActiva('inicio')} style={{
            width:'100%', display:'flex', alignItems:'center', gap:'11px', padding:menuAbierto?'9px 12px':'9px',
            justifyContent:menuAbierto?'flex-start':'center', background:seccionActiva==='inicio'?'rgba(31,111,92,0.35)':'transparent',
            border:'none', borderLeft:seccionActiva==='inicio'?`3px solid ${paleta.brand}`:'3px solid transparent',
            borderRadius:'6px', cursor:'pointer', marginBottom:'14px'
          }}>
            <Home size={17} color={seccionActiva==='inicio' ? '#fff' : 'rgba(255,255,255,0.55)'} />
            {menuAbierto && <span style={{ color:seccionActiva==='inicio'?'#fff':'rgba(255,255,255,0.55)', fontSize:'13.5px', fontWeight:seccionActiva==='inicio'?'600':'400' }}>Inicio</span>}
          </button>

          {menuVisible.map(grupo => (
            <div key={grupo.label} style={{ marginBottom:'16px' }}>
              {menuAbierto && <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'11px', fontWeight:'600', margin:'0 0 6px 12px' }}>{grupo.label}</p>}
              {grupo.items.map(item => {
                const activo = seccionActiva === item.id
                const Icon = item.icon
                return (
                  <button key={item.id} onClick={() => setSeccionActiva(item.id)} style={{
                    width:'100%', display:'flex', alignItems:'center', gap:'11px', padding:menuAbierto?'9px 12px':'9px',
                    justifyContent:menuAbierto?'flex-start':'center', background:activo?'rgba(31,111,92,0.35)':'transparent',
                    border:'none', borderLeft:activo?`3px solid ${paleta.brand}`:'3px solid transparent',
                    borderRadius:'6px', cursor:'pointer', marginBottom:'2px'
                  }}>
                    <Icon size={17} color={activo ? '#fff' : 'rgba(255,255,255,0.55)'} />
                    {menuAbierto && <span style={{ color:activo?'#fff':'rgba(255,255,255,0.55)', fontSize:'13.5px', fontWeight:activo?'600':'400' }}>{item.label}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding:menuAbierto?'12px':'12px 8px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setMenuAbierto(!menuAbierto)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:menuAbierto?'flex-start':'center', gap:'8px', background:'transparent', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', padding:'6px', fontSize:'12px', marginBottom:'6px' }}>
            {menuAbierto ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
            {menuAbierto && <span>Contraer</span>}
          </button>
          {menuAbierto && <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'11px', margin:'0 0 8px 6px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</p>}
          <button onClick={() => supabase.auth.signOut()} style={{ width:'100%', display:'flex', alignItems:'center', gap:'8px', justifyContent:menuAbierto?'flex-start':'center', background:'rgba(172,59,42,0.15)', border:'1px solid rgba(172,59,42,0.3)', borderRadius:'7px', padding:'8px 10px', color:'#E8998C', cursor:'pointer', fontSize:'12.5px', fontWeight:'500' }}>
            <LogOut size={14} />{menuAbierto && <span>Cerrar sesión</span>}
          </button>
        </div>
      </div>

      {/* ---------- CONTENIDO ---------- */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ background:paleta.surface, padding:'14px 30px', borderBottom:`1px solid ${paleta.line}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            {seccionActiva === 'inicio' ? <Home size={18} color={paleta.brand} /> : itemActivo && <itemActivo.icon size={18} color={paleta.brand} />}
            <h2 style={{ margin:0, fontSize:'16.5px', fontWeight:'700', color:paleta.ink }}>{seccionActiva === 'inicio' ? 'Inicio' : itemActivo?.label}</h2>
          </div>
          <span style={{ color:paleta.muted, fontSize:'12.5px', background:paleta.paper, padding:'6px 14px', borderRadius:'7px', border:`1px solid ${paleta.line}` }}>
            {new Date().toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </span>
        </div>

        <div style={{ flex:1, padding:'26px 30px', overflowY:'auto' }}>
          {seccionActiva === 'inicio' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'22px', alignItems:'start' }}>
              <div>
                <p style={{ color:paleta.inkSoft, marginBottom:'20px', fontSize:'14.5px' }}>Hola, <strong style={{ color:paleta.ink }}>{nombreUsuario}</strong>. Este es el estado de Briseo hoy.</p>

                <div style={{ display:'grid', gridTemplateColumns: hero ? '1.3fr repeat(2, 1fr)' : 'repeat(3,1fr)', gap:'12px', marginBottom:'26px' }}>
                  {hero && (
                    <button onClick={() => setSeccionActiva(hero.modulo)} style={{ background:paleta.brand, border:'none', borderRadius:'12px', padding:'20px', cursor:'pointer', textAlign:'left', gridRow:'span 2', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <hero.icon size={18} color="rgba(255,255,255,0.85)" />
                        <ArrowRight size={15} color="rgba(255,255,255,0.6)" />
                      </div>
                      <div>
                        <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'12.5px', margin:'0 0 4px', fontWeight:'500' }}>{hero.label}</p>
                        <p style={{ color:'#fff', fontSize:'28px', fontWeight:'800', margin:0 }}>
                          {hero.tipo==='dinero' ? hero.valor.toLocaleString('es-AR',{style:'currency',currency:'ARS'}) : hero.valor}
                        </p>
                      </div>
                    </button>
                  )}
                  {secundarias.map((t,i) => {
                    const acc = colores[t.modulo]?.main || paleta.brand
                    return (
                      <button key={i} onClick={() => setSeccionActiva(t.modulo)} style={{ background:paleta.surface, border:`1px solid ${paleta.line}`, borderLeft:`3px solid ${acc}`, borderRadius:'10px', padding:'14px 16px', cursor:'pointer', textAlign:'left', display:'flex', flexDirection:'column', gap:'6px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                          <t.icon size={14} color={acc} />
                          <p style={{ color:paleta.muted, fontSize:'11.5px', fontWeight:'600', margin:0 }}>{t.label}</p>
                        </div>
                        <p style={{ color:paleta.ink, fontSize:'19px', fontWeight:'700', margin:0 }}>
                          {t.tipo==='dinero' ? t.valor.toLocaleString('es-AR',{style:'currency',currency:'ARS'}) : t.valor}
                        </p>
                      </button>
                    )
                  })}
                </div>

                <p style={{ color:paleta.muted, fontSize:'12px', fontWeight:'600', marginBottom:'12px' }}>Módulos</p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:'10px' }}>
                  {accesosVisibles.map((card) => {
                    const acc = colores[card.id]?.main || paleta.brand
                    const light = colores[card.id]?.light || paleta.brandSoft
                    return (
                      <button key={card.id} onClick={() => setSeccionActiva(card.id)} style={{ background:paleta.surface, border:`1px solid ${paleta.line}`, borderRadius:'10px', padding:'14px 12px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'10px' }}>
                        <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:light, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <card.icon size={16} color={acc} />
                        </div>
                        <span style={{ color:paleta.inkSoft, fontWeight:'600', fontSize:'12.5px' }}>{card.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* PANEL DE ALERTAS */}
              <div style={{ position:'sticky', top:'0' }}>
                <div style={{ background:paleta.surface, borderRadius:'12px', padding:'18px', border:`1px solid ${paleta.line}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
                    <Bell size={16} color={paleta.inkSoft} />
                    <h3 style={{ margin:0, fontSize:'14px', fontWeight:'700', color:paleta.ink }}>Alertas</h3>
                    {alertas.length > 0 && <span style={{ background:paleta.danger, color:'#fff', borderRadius:'99px', fontSize:'11px', fontWeight:'700', padding:'1px 8px', marginLeft:'auto' }}>{alertas.length}</span>}
                  </div>

                  {alertas.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'26px 0' }}>
                      <CheckCircle2 size={24} color={paleta.brand} style={{ marginBottom:'8px' }} />
                      <p style={{ color:paleta.muted, fontSize:'13px', margin:0 }}>Sin alertas pendientes</p>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                      {alertas.map((a, i) => {
                        const col = alertaEstilo[a.tipo] || alertaEstilo.info
                        return (
                          <button key={i} onClick={() => setSeccionActiva(a.modulo)}
                            style={{ background:'transparent', border:'none', borderBottom:i < alertas.length-1 ? `1px solid ${paleta.line}` : 'none', borderRadius:0, padding:'10px 2px', cursor:'pointer', textAlign:'left', width:'100%', display:'flex', gap:'9px', alignItems:'flex-start' }}>
                            <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:col.dot, marginTop:'6px', flexShrink:0 }} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ margin:'0 0 2px', fontSize:'12.5px', fontWeight:'600', color:paleta.ink }}>{a.titulo}</p>
                              <p style={{ margin:0, fontSize:'11.5px', color:paleta.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.detalle}</p>
                              {a.monto && <p style={{ margin:'2px 0 0', fontSize:'12px', fontWeight:'700', color:col.text }}>{a.monto.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <button onClick={() => cargarAlertas()} style={{ width:'100%', marginTop:'12px', padding:'8px', background:paleta.paper, border:`1px solid ${paleta.line}`, borderRadius:'7px', color:paleta.inkSoft, fontSize:'12px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                    <RefreshCw size={12} /> Actualizar
                  </button>
                </div>
              </div>
            </div>
          )}
          {seccionActiva === 'clientes' && <Clientes />}
          {seccionActiva === 'contratos' && <Contratos />}
          {seccionActiva === 'personal' && <Personal />}
          {seccionActiva === 'agenda' && <Agenda />}
          {seccionActiva === 'presupuestos' && <Presupuestos />}
          {seccionActiva === 'facturacion' && esAdmin && <Facturacion />}
          {seccionActiva === 'insumos' && <Insumos />}
          {seccionActiva === 'finanzas' && esAdmin && <Finanzas />}
          {seccionActiva === 'costos' && esAdmin && <Costos />}
          {seccionActiva === 'sueldos' && esAdmin && <Sueldos />}
          {seccionActiva === 'proveedores' && <Proveedores />}
          {seccionActiva === 'reportes' && <Reportes />}
          {seccionActiva === 'usuarios' && esAdmin && <Usuarios />}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
