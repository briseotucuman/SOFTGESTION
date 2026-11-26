import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { MARCA } from '../marca.js'
import { Send, Printer, Copy, Mail, MessageCircle, CheckCircle2, AlertTriangle, X, ChevronRight } from 'lucide-react'
import { armarDatosInforme, calcHoras, fechaCorta, fmtHoras, htmlInforme, nombrePeriodo, resumenCliente, urlValidar } from '../informeAsistenciaUtils.js'

const hoy = new Date().toISOString().split('T')[0]
const chip = (bg, color) => ({ background: bg, color, borderRadius: 8, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 })
const th = { ...s.tablaCabecera(), padding: '8px 10px' }
const td = { padding: '6px 10px' }

// Informe mensual de horas por servicio: se revisa, se envía y el servicio lo valida u observa con un enlace
export default function InformeAsistencia() {
  const [periodo, setPeriodo] = useState(() => new Date(Date.now() - 864e5 * 10).toISOString().slice(0, 7))
  const [clientes, setClientes] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [asistencias, setAsistencias] = useState([])
  const [horarios, setHorarios] = useState([])
  const [informes, setInformes] = useState([])
  const [sel, setSel] = useState(null)
  const [enviado, setEnviado] = useState(null)
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const cargar = useCallback(async () => {
    const [c, e, a, h, i] = await Promise.all([
      supabase.from('clientes').select('id, razon_social, nombre_contacto, cuit, email, telefono').eq('activo', true).order('razon_social'),
      supabase.from('empleados').select('id, nombre, apellido'),
      supabase.from('asistencias').select('*').gte('fecha', `${periodo}-01`).lte('fecha', `${periodo}-31`),
      supabase.from('horarios_servicio').select('*').eq('activo', true),
      supabase.from('informes_asistencia').select('*').eq('periodo', periodo),
    ])
    if (i.error) setError('Falta crear la tabla del informe: ejecutá fichaje_informe_softgestion.sql en Supabase (SQL Editor).'); else setError('')
    setClientes(c.data || []); setEmpleados(e.data || []); setAsistencias(a.data || []); setHorarios(h.data || []); setInformes(i.data || [])
  }, [periodo])
  useEffect(() => { cargar() }, [cargar])

  const nomE = id => { const x = empleados.find(e => e.id === id); return x ? `${x.apellido} ${x.nombre}` : '—' }
  const nomC = c => c.razon_social || c.nombre_contacto

  const filas = useMemo(() => {
    const conHorario = new Set(horarios.map(h => h.cliente_id))
    return clientes
      .filter(c => conHorario.has(c.id) || asistencias.some(a => a.cliente_id === c.id))
      .map(c => ({ c, r: resumenCliente({ clienteId: c.id, periodo, asistencias, horarios }), inf: informes.find(i => i.cliente_id === c.id) }))
  }, [clientes, asistencias, horarios, informes, periodo])

  const actual = sel ? filas.find(f => f.c.id === sel) : null

  const corregirSalida = async (a, salida) => {
    if (!salida) return
    const horas = calcHoras(a.entrada, salida)
    const obs = [String(a.observaciones || '').replace(/\s*·?\s*Salida no marcada/, '').trim(), 'Salida cargada manualmente'].filter(Boolean).join(' · ')
    const { error: e } = await supabase.from('asistencias').update({ salida, horas, observaciones: obs }).eq('id', a.id)
    if (e) return setError(e.message)
    cargar()
  }

  const imprimir = datos => {
    const w = window.open('', '_blank')
    if (!w) return setError('El navegador bloqueó la ventana de impresión: permití ventanas emergentes para este sitio.')
    w.document.write(htmlInforme(datos, MARCA)); w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
  }

  const enviar = async ({ c, r, inf }) => {
    if (r.sinSalida.length > 0 && !confirm(`Hay ${r.sinSalida.length} jornada(s) sin salida marcada: se informarán sin horas. ¿Enviar igual? (Podés cargar la salida en el detalle antes de enviar.)`)) return
    if (inf?.estado === 'validado' && !confirm('Este informe ya fue validado por el servicio. Si lo enviás de nuevo vuelve a quedar pendiente de validación. ¿Continuar?')) return
    setTrabajando(true); setError('')
    const datos = armarDatosInforme({ cliente: c, periodo, resumen: r, nombreEmpleado: nomE })
    const { data, error: e } = await supabase.from('informes_asistencia').upsert({
      cliente_id: c.id, periodo, datos, estado: 'enviado', enviado_en: new Date().toISOString(), enviado_a: c.email || null,
      respondido_en: null, respondido_por: null, comentario: null,
    }, { onConflict: 'cliente_id,periodo' }).select().single()
    setTrabajando(false)
    if (e) return setError(e.message)
    setEnviado({ c, token: data.token, datos }); cargar()
  }

  const estadoChip = ({ r, inf }) => {
    if (!inf) return <span style={chip('#F1F5F9', '#64748B')}>Sin enviar</span>
    const cambio = Math.abs((inf.datos?.resumen?.horas ?? 0) - r.horas) > 0.009
    return <>
      {inf.estado === 'validado' && <span style={chip('#DCFCE7', '#15803D')}><CheckCircle2 size={11} /> Validado · {inf.respondido_por}</span>}
      {inf.estado === 'enviado' && <span style={chip('#EFF6FF', '#1D4ED8')}>Enviado · esperando</span>}
      {inf.estado === 'observado' && <span style={chip('#FFE4E6', '#BE123C')}><AlertTriangle size={11} /> Observado</span>}
      {cambio && <span style={{ ...chip('#FEF3C7', '#92400E'), marginLeft: 4 }} title="Las horas cambiaron después del envío">Cambió desde el envío</span>}
    </>
  }

  return (
    <div>
      {error && <div style={{ ...s.card, padding: 12, color: paleta.danger, background: paleta.dangerSoft }}>{error}</div>}
      <div style={{ ...s.card, padding: 14, color: paleta.inkSoft, fontSize: 13 }}>
        Informe mensual de horas por servicio. Revisalo, enviáselo al servicio con un enlace y quedan registradas su <b>conformidad</b> o sus <b>observaciones</b>. Lo que se envía queda congelado: si después corregís marcaciones, el sistema te avisa que cambió.
      </div>
      <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="month" style={{ ...s.input, width: 'auto' }} value={periodo} max={hoy.slice(0, 7)} onChange={e => { setPeriodo(e.target.value); setSel(null) }} />
          <span style={{ color: paleta.muted, fontSize: 13 }}>{nombrePeriodo(periodo)}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['Servicio', 'Horas registradas', 'Programadas', 'Días', 'Personal', 'A revisar', 'Estado', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{filas.map(f => {
            const { c, r } = f, dif = r.horas - r.programadas
            return (
              <tr key={c.id} style={{ borderTop: `1px solid ${paleta.line}`, background: sel === c.id ? '#F8FAFF' : undefined }}>
                <td style={{ ...td, fontWeight: 600 }}>{nomC(c)}</td>
                <td style={{ ...td, fontFamily: paleta.fontMono }}>{fmtHoras(r.horas)}</td>
                <td style={{ ...td, fontFamily: paleta.fontMono }}>{r.programadas ? <>{fmtHoras(r.programadas)} <span style={{ fontSize: 11, color: Math.abs(dif) < 0.5 ? paleta.muted : dif < 0 ? paleta.danger : '#B45309' }}>({dif >= 0 ? '+' : ''}{Math.round(dif * 10) / 10})</span></> : <span style={{ color: paleta.muted }}>—</span>}</td>
                <td style={td}>{r.dias}</td><td style={td}>{r.empleados}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {r.sinSalida.length + r.fuera.length + r.sinUbic.length === 0 ? <span style={{ color: paleta.muted }}>—</span> : <>
                    {r.sinSalida.length > 0 && <span style={chip('#FFE4E6', '#BE123C')}>{r.sinSalida.length} sin salida</span>}{' '}
                    {r.fuera.length > 0 && <span style={chip('#FEF3C7', '#92400E')}>{r.fuera.length} fuera de zona</span>}{' '}
                    {r.sinUbic.length > 0 && <span style={chip('#FEF3C7', '#92400E')}>{r.sinUbic.length} sin ubic.</span>}</>}
                </td>
                <td style={td}>{estadoChip(f)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <button style={s.btnSecundario} onClick={() => setSel(sel === c.id ? null : c.id)}>Detalle <ChevronRight size={12} /></button>{' '}
                  <button style={s.btnPrimario('#15803D')} disabled={trabajando || r.filas.length === 0} onClick={() => enviar(f)}><Send size={12} /> {f.inf ? 'Reenviar' : 'Enviar'}</button>
                </td>
              </tr>)
          })}</tbody>
        </table>
        {filas.length === 0 && <div style={{ padding: 14, color: paleta.muted }}>No hay servicios con horarios ni marcaciones en este período.</div>}
      </div>

      {actual && (
        <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
          <div style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>{nomC(actual.c)}</b><span style={{ color: paleta.muted }}>· {nombrePeriodo(periodo)}</span>
            <span style={{ marginLeft: 'auto' }} />
            <button style={s.btnSecundario} onClick={() => imprimir(armarDatosInforme({ cliente: actual.c, periodo, resumen: actual.r, nombreEmpleado: nomE }))}><Printer size={13} /> Vista previa / PDF</button>
          </div>
          {actual.inf?.estado === 'observado' && (
            <div style={{ margin: '0 12px 12px', padding: 12, borderRadius: 10, background: '#FFF1F2', color: '#9F1239', fontSize: 13 }}>
              <b>Observación de {actual.inf.respondido_por}</b> ({fechaCorta(actual.inf.respondido_en)}): {actual.inf.comentario}
              <div style={{ marginTop: 4, color: '#64748B' }}>Corregí lo que corresponda en las marcaciones y tocá «Reenviar»: el servicio recibe el mismo enlace con el informe actualizado.</div>
            </div>)}
          {actual.inf?.estado === 'validado' && (
            <div style={{ margin: '0 12px 12px', padding: 12, borderRadius: 10, background: '#F0FDF4', color: '#166534', fontSize: 13 }}>
              <b>Validado por {actual.inf.respondido_por}</b> el {fechaCorta(actual.inf.respondido_en)}{actual.inf.comentario ? ` · «${actual.inf.comentario}»` : ''}
            </div>)}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['Fecha', 'Persona', 'Situación', 'Entrada', 'Salida', 'Horas', 'Observaciones'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{actual.r.filas.map(a => (
              <tr key={a.id} style={{ borderTop: `1px solid ${paleta.line}` }}>
                <td style={td}>{fechaCorta(a.fecha)}</td><td style={{ ...td, fontWeight: 600 }}>{nomE(a.empleado_id)}</td>
                <td style={td}>{a.tipo}</td><td style={td}>{a.entrada?.slice(0, 5)}</td>
                <td style={td}>{a.tipo === 'trabajado' && !a.salida && a.entrada
                  ? <input type="time" style={{ ...s.input, width: 110, padding: '3px 6px' }} title="Cargá la salida y se calculan las horas" onChange={e => e.target.value && corregirSalida(a, e.target.value)} />
                  : a.salida?.slice(0, 5)}</td>
                <td style={{ ...td, fontFamily: paleta.fontMono }}>{a.horas ?? ''}</td>
                <td style={{ ...td, fontSize: 12, color: paleta.muted }}>
                  {a.tipo === 'trabajado' && !a.salida && <span style={chip('#FFE4E6', '#BE123C')}>Sin salida</span>}{' '}
                  {(a.en_zona === false || a.en_zona_salida === false) && <span style={chip('#FEF3C7', '#92400E')}>Fuera de zona</span>}{' '}
                  {a.origen !== 'celular' && a.tipo === 'trabajado' && 'Carga manual'} {a.observaciones}
                </td>
              </tr>))}</tbody>
          </table>
        </div>)}

      {enviado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 26, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Informe listo para enviar</h4>
              <button onClick={() => setEnviado(null)} style={{ background: 'none', border: 0, cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
            <p style={{ fontSize: 13, color: '#475569' }}>{nomC(enviado.c)} · {nombrePeriodo(periodo)}. Mandale este enlace: ahí ve el detalle y puede <b>dar su conformidad</b> u <b>observar</b>. No necesita usuario.</p>
            <input readOnly style={{ ...s.input, fontSize: 12 }} value={urlValidar(enviado.token)} onFocus={e => e.target.select()} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button style={s.btnSecundario} onClick={() => navigator.clipboard?.writeText(urlValidar(enviado.token))}><Copy size={13} /> Copiar enlace</button>
              <a style={{ ...s.btnPrimario('#2563EB'), textDecoration: 'none' }} href={`mailto:${enviado.c.email || ''}?subject=${encodeURIComponent(`Informe de asistencia ${nombrePeriodo(periodo)} - ${MARCA.fantasia}`)}&body=${encodeURIComponent(`Hola, te enviamos el informe de asistencia del servicio correspondiente a ${nombrePeriodo(periodo)} para tu validación.\n\nPodés verlo y dar tu conformidad u observarlo desde este enlace:\n${urlValidar(enviado.token)}\n\nSaludos,\n${MARCA.fantasia}`)}`}><Mail size={13} /> Email</a>
              <a style={{ ...s.btnPrimario('#15803D'), textDecoration: 'none' }} target="_blank" rel="noreferrer" href={`https://wa.me/${String(enviado.c.telefono || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, te enviamos el informe de asistencia de ${nombrePeriodo(periodo)} para tu validación: ${urlValidar(enviado.token)}`)}`}><MessageCircle size={13} /> WhatsApp</a>
              <button style={s.btnSecundario} onClick={() => imprimir(enviado.datos)}><Printer size={13} /> PDF</button>
            </div>
            {!enviado.c.email && <div style={{ fontSize: 12, color: paleta.warn, marginTop: 10 }}>Este cliente no tiene email cargado: completalo en Clientes o usá WhatsApp / copiá el enlace.</div>}
          </div>
        </div>)}
    </div>
  )
}
