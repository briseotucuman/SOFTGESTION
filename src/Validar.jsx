import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabase.js'
import { MARCA } from './marca.js'
import { fechaCorta, fmtHoras, htmlInforme, nombrePeriodo } from './informeAsistenciaUtils.js'

const fondo = 'linear-gradient(160deg, #eaf2ff 0%, #d5e4fb 100%)'
const caja = { background: '#fff', borderRadius: 20, boxShadow: '0 20px 40px -18px rgba(37,99,235,0.35)', padding: 22, marginBottom: 14 }
const th = { textAlign: 'left', padding: '6px 8px', fontSize: 11.5, color: '#1e40af', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', whiteSpace: 'nowrap' }
const td = { padding: '5px 8px', fontSize: 13, borderBottom: '1px solid #f1f5f9' }

// Página pública: el servicio revisa el informe mensual de asistencia y da su conformidad u observa
export default function Validar() {
  const { token } = useParams()
  const [inf, setInf] = useState(null)
  const [nombre, setNombre] = useState('')
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('informe_asistencia_publico', { p_token: token })
    if (e) return setError('El sistema todavía no está habilitado. Avisá a administración.')
    setInf(data)
  }, [token])
  useEffect(() => { cargar() }, [cargar])

  const responder = async accion => {
    setError('')
    if (!nombre.trim()) return setError('Escribí tu nombre y cargo para registrar tu respuesta.')
    if (accion === 'observar' && !comentario.trim()) return setError('Contanos qué observás.')
    setEnviando(true)
    const { data, error: e } = await supabase.rpc('responder_informe_asistencia', { p_token: token, p_accion: accion, p_nombre: nombre, p_comentario: comentario })
    setEnviando(false)
    if (e || !data?.ok) return setError(data?.error || 'No se pudo registrar. Probá de nuevo.')
    cargar()
  }

  const base = { minHeight: '100vh', background: fondo, padding: '20px 12px', fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif", display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }
  if (error && !inf) return <div style={base}><div style={{ ...caja, maxWidth: 420, color: '#be123c', textAlign: 'center' }}>{error}</div></div>
  if (!inf) return <div style={base}><div style={{ ...caja, maxWidth: 420, textAlign: 'center' }}>Cargando…</div></div>
  if (!inf.ok) return <div style={base}><div style={{ ...caja, maxWidth: 420, textAlign: 'center' }}><b>Enlace no válido</b><p style={{ color: '#64748b' }}>Pedí a {MARCA.fantasia} que te reenvíe el informe.</p></div></div>

  const d = inf.datos, pendiente = inf.estado !== 'validado'
  const imprimir = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write(htmlInforme(d, MARCA)); w.document.close(); w.focus(); setTimeout(() => w.print(), 300) }

  return (
    <div style={base}>
      <div style={{ maxWidth: 820, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <img src="/logo.jpg" alt={MARCA.fantasia} style={{ height: 50, borderRadius: 12, background: '#fff', padding: 5 }} />
          <div style={{ fontWeight: 700, color: '#1e40af', marginTop: 4 }}>{MARCA.fantasia}</div>
        </div>
        <div style={caja}>
          <div style={{ fontSize: 13, color: '#64748b' }}>Informe mensual de asistencia</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{d.cliente.nombre}</div>
          <div style={{ color: '#334155' }}>Período: <b>{nombrePeriodo(inf.periodo)}</b></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 14 }}>
            {[['Horas registradas', fmtHoras(d.resumen.horas)], ['Horas programadas', d.resumen.programadas ? fmtHoras(d.resumen.programadas) : '—'], ['Días con servicio', d.resumen.dias], ['Personal', d.resumen.empleados]].map(([k, v]) => (
              <div key={k} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 10 }}><div style={{ fontSize: 11.5, color: '#64748b' }}>{k}</div><div style={{ fontSize: 19, fontWeight: 700 }}>{v}</div></div>))}
          </div>
          {inf.estado === 'validado' && <div style={{ marginTop: 14, background: '#dcfce7', color: '#166534', borderRadius: 12, padding: '10px 14px', fontWeight: 600 }}>✓ Validado por {inf.respondido_por} el {fechaCorta(inf.respondido_en)}{inf.comentario ? ` · «${inf.comentario}»` : ''}</div>}
          {inf.estado === 'observado' && <div style={{ marginTop: 14, background: '#ffe4e6', color: '#9f1239', borderRadius: 12, padding: '10px 14px' }}>Enviaste una observación el {fechaCorta(inf.respondido_en)}: «{inf.comentario}». {MARCA.fantasia} la va a revisar y te reenviará el informe actualizado en este mismo enlace.</div>}
        </div>

        <div style={{ ...caja, overflowX: 'auto' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Resumen por persona</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Persona</th><th style={th}>Horas</th><th style={th}>Días</th><th style={th}>Faltas</th><th style={th}>Licencias</th></tr></thead>
            <tbody>{d.empleados.map((e, i) => <tr key={i}><td style={{ ...td, fontWeight: 600 }}>{e.nombre}</td><td style={td}>{fmtHoras(e.horas)}</td><td style={td}>{e.dias}</td><td style={td}>{e.faltas}</td><td style={td}>{e.otras}</td></tr>)}</tbody>
          </table>
        </div>

        <div style={{ ...caja, overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Detalle de marcaciones</div>
            <button onClick={imprimir} style={{ marginLeft: 'auto', border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>Imprimir / PDF</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Fecha', 'Persona', 'Situación', 'Entrada', 'Salida', 'Horas', 'Observaciones'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{d.filas.map((f, i) => <tr key={i}><td style={td}>{fechaCorta(f.fecha)}</td><td style={td}>{f.empleado}</td><td style={td}>{f.tipo}</td><td style={td}>{f.entrada}</td><td style={td}>{f.salida}</td><td style={td}>{f.horas ?? ''}</td><td style={{ ...td, color: '#64748b', fontSize: 12 }}>{f.obs}</td></tr>)}</tbody>
          </table>
        </div>

        {pendiente && (
          <div style={caja}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Tu respuesta</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>Si las horas coinciden con el servicio recibido, dá tu conformidad. Si algo no coincide, contanos qué día o persona.</div>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre y cargo" style={{ width: '100%', boxSizing: 'border-box', padding: 12, fontSize: 16, borderRadius: 12, border: '1px solid #cbd5e1', marginBottom: 8 }} />
            <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3} placeholder="Comentario u observación (obligatorio si observás)" style={{ width: '100%', boxSizing: 'border-box', padding: 12, fontSize: 15, borderRadius: 12, border: '1px solid #cbd5e1', fontFamily: 'inherit' }} />
            {error && <div style={{ color: '#be123c', marginTop: 8, fontSize: 14 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button disabled={enviando} onClick={() => responder('validar')} style={{ flex: 1, minWidth: 180, padding: '14px 0', fontSize: 16, fontWeight: 700, color: '#fff', background: '#15803d', border: 0, borderRadius: 14, cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>Dar conformidad</button>
              <button disabled={enviando} onClick={() => responder('observar')} style={{ flex: 1, minWidth: 180, padding: '14px 0', fontSize: 16, fontWeight: 700, color: '#be123c', background: '#fff', border: '2px solid #be123c', borderRadius: 14, cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>Observar</button>
            </div>
          </div>)}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b' }}>{MARCA.pie} · Enviado el {fechaCorta(inf.enviado_en)}</div>
      </div>
    </div>
  )
}
