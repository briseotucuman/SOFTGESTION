import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { Trash2, Download, Smartphone, Copy, MessageCircle } from 'lucide-react'

const hoy = new Date().toISOString().split('T')[0]
const TIPOS = [['trabajado', 'Trabajó'], ['falta', 'Falta'], ['licencia', 'Licencia'], ['vacaciones', 'Vacaciones'], ['enfermedad', 'Enfermedad']]
const calcHoras = (e, sal) => {
  if (!e || !sal) return null
  let m = (Number(sal.slice(0, 2)) * 60 + Number(sal.slice(3, 5))) - (Number(e.slice(0, 2)) * 60 + Number(e.slice(3, 5)))
  if (m < 0) m += 1440
  return Math.round(m / 60 * 100) / 100
}

// Registro diario de asistencia y horas reales por empleado y cliente
export default function Asistencia() {
  const [vista, setVista] = useState('dia')
  const [fecha, setFecha] = useState(hoy)
  const [mes, setMes] = useState(hoy.slice(0, 7))
  const [empleados, setEmpleados] = useState([])
  const [clientes, setClientes] = useState([])
  const [delDia, setDelDia] = useState([])
  const [delMes, setDelMes] = useState([])
  const [f, setF] = useState({ empleado_id: '', cliente_id: '', tipo: 'trabajado', entrada: '', salida: '', observaciones: '' })
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const [e, c, d, m] = await Promise.all([
      supabase.from('empleados').select('id, nombre, apellido, telefono, token_marcacion').eq('activo', true).order('apellido'),
      supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true).order('razon_social'),
      supabase.from('asistencias').select('*').eq('fecha', fecha).order('creado_en'),
      supabase.from('asistencias').select('*').gte('fecha', `${mes}-01`).lte('fecha', `${mes}-31`)
    ])
    if (d.error) setError('Falta crear las tablas nuevas: ejecutá mejoras_softgestion.sql en Supabase (SQL Editor).'); else setError('')
    setEmpleados(e.data || []); setClientes(c.data || []); setDelDia(d.data || []); setDelMes(m.data || [])
  }, [fecha, mes])
  useEffect(() => { cargar() }, [cargar])

  const nomE = id => { const x = empleados.find(e => e.id === id); return x ? `${x.apellido} ${x.nombre}` : '—' }
  const nomC = id => { const x = clientes.find(c => c.id === id); return x ? (x.razon_social || x.nombre_contacto) : '—' }

  const guardar = async () => {
    if (!f.empleado_id) return setError('Elegí el empleado.')
    const horas = f.tipo === 'trabajado' ? calcHoras(f.entrada, f.salida) : null
    if (f.tipo === 'trabajado' && horas == null) return setError('Cargá entrada y salida.')
    const { error: e } = await supabase.from('asistencias').insert([{ empleado_id: f.empleado_id, cliente_id: f.cliente_id || null, fecha, tipo: f.tipo, entrada: f.entrada || null, salida: f.salida || null, horas, observaciones: f.observaciones || null }])
    if (e) return setError(e.message)
    setF({ ...f, entrada: '', salida: '', observaciones: '' }); setError(''); cargar()
  }
  const borrar = async id => { await supabase.from('asistencias').delete().eq('id', id); cargar() }

  const resumen = useMemo(() => {
    const m = {}
    delMes.forEach(a => {
      const r = (m[a.empleado_id] ||= { horas: 0, faltas: 0, licencias: 0, clientes: {} })
      if (a.tipo === 'trabajado') { r.horas += Number(a.horas) || 0; const k = a.cliente_id || 'sin'; r.clientes[k] = (r.clientes[k] || 0) + (Number(a.horas) || 0) }
      else if (a.tipo === 'falta') r.faltas++
      else r.licencias++
    })
    return Object.entries(m).map(([id, r]) => ({ id, ...r })).sort((a, b) => nomE(a.id).localeCompare(nomE(b.id)))
  }, [delMes, empleados])

  const exportar = () => {
    const filas = [['Empleado', 'Horas', 'Faltas', 'Licencias/vacaciones', 'Detalle por cliente'], ...resumen.map(r => [nomE(r.id), r.horas, r.faltas, r.licencias, Object.entries(r.clientes).map(([k, h]) => `${k === 'sin' ? 'Sin cliente' : nomC(k)}: ${h}h`).join(' | ')])]
    const txt = filas.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' })); a.download = `asistencia_${mes}.csv`; a.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button style={vista === 'dia' ? s.btnPrimario('#1e40af') : s.btnSecundario} onClick={() => setVista('dia')}>Registro diario</button>
        <button style={vista === 'mes' ? s.btnPrimario('#1e40af') : s.btnSecundario} onClick={() => setVista('mes')}>Resumen mensual</button>
        <button style={vista === 'enlaces' ? s.btnPrimario('#1e40af') : s.btnSecundario} onClick={() => setVista('enlaces')}><Smartphone size={13} /> Marcación por celular</button>
      </div>
      {error && <div style={{ ...s.card, padding: 12, color: paleta.danger, background: paleta.dangerSoft }}>{error}</div>}
      {vista === 'enlaces' ? <Enlaces empleados={empleados} recargar={cargar} /> : vista === 'dia' ? (<>
        <div style={{ ...s.card, padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label style={s.label}>Fecha</label><input type="date" style={s.input} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
          <div><label style={s.label}>Empleado</label><select style={s.input} value={f.empleado_id} onChange={e => setF({ ...f, empleado_id: e.target.value })}><option value="">Elegir…</option>{empleados.map(e => <option key={e.id} value={e.id}>{e.apellido} {e.nombre}</option>)}</select></div>
          <div><label style={s.label}>Situación</label><select style={s.input} value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>{TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          {f.tipo === 'trabajado' && <>
            <div><label style={s.label}>Cliente / servicio</label><select style={s.input} value={f.cliente_id} onChange={e => setF({ ...f, cliente_id: e.target.value })}><option value="">—</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social || c.nombre_contacto}</option>)}</select></div>
            <div><label style={s.label}>Entrada</label><input type="time" style={s.input} value={f.entrada} onChange={e => setF({ ...f, entrada: e.target.value })} /></div>
            <div><label style={s.label}>Salida</label><input type="time" style={s.input} value={f.salida} onChange={e => setF({ ...f, salida: e.target.value })} /></div></>}
          <button style={s.btnPrimario('#15803D')} onClick={guardar}>Registrar</button>
        </div>
        <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['Empleado', 'Situación', 'Cliente', 'Entrada', 'Salida', 'Horas', ''].map(h => <th key={h} style={{ ...s.tablaCabecera(), padding: '8px 10px' }}>{h}</th>)}</tr></thead>
            <tbody>{delDia.map(a => (
              <tr key={a.id} style={{ borderTop: `1px solid ${paleta.line}` }}>
                <td style={{ padding: '6px 10px', fontWeight: 600 }}>{nomE(a.empleado_id)}</td><td style={{ padding: '6px 10px' }}>{TIPOS.find(t => t[0] === a.tipo)?.[1]}</td>
                <td style={{ padding: '6px 10px' }}>{a.cliente_id ? nomC(a.cliente_id) : ''}</td><td style={{ padding: '6px 10px' }}>{a.entrada?.slice(0, 5)}</td><td style={{ padding: '6px 10px' }}>{a.salida?.slice(0, 5)}</td>
                <td style={{ padding: '6px 10px', fontFamily: paleta.fontMono }}>{a.horas ?? ''}</td>
                <td style={{ padding: '6px 10px' }}><button style={s.btnPeligro} onClick={() => borrar(a.id)}><Trash2 size={12} /></button></td>
              </tr>))}</tbody>
          </table>
          {delDia.length === 0 && <div style={{ padding: 14, color: paleta.muted }}>Sin registros para este día.</div>}
        </div>
      </>) : (
        <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
          <div style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="month" style={{ ...s.input, width: 'auto' }} value={mes} onChange={e => setMes(e.target.value)} />
            <button style={{ ...s.btnSecundario, marginLeft: 'auto' }} onClick={exportar}><Download size={13} /> Exportar</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['Empleado', 'Horas trabajadas', 'Faltas', 'Licencias / vacaciones', 'Horas por cliente'].map(h => <th key={h} style={{ ...s.tablaCabecera(), padding: '8px 10px' }}>{h}</th>)}</tr></thead>
            <tbody>{resumen.map(r => (
              <tr key={r.id} style={{ borderTop: `1px solid ${paleta.line}` }}>
                <td style={{ padding: '6px 10px', fontWeight: 600 }}>{nomE(r.id)}</td><td style={{ padding: '6px 10px', fontFamily: paleta.fontMono }}>{r.horas}</td>
                <td style={{ padding: '6px 10px', color: r.faltas ? paleta.danger : undefined }}>{r.faltas}</td><td style={{ padding: '6px 10px' }}>{r.licencias}</td>
                <td style={{ padding: '6px 10px' }}>{Object.entries(r.clientes).map(([k, h]) => `${k === 'sin' ? 'Sin cliente' : nomC(k)}: ${h} h`).join(' · ')}</td>
              </tr>))}</tbody>
          </table>
          {resumen.length === 0 && <div style={{ padding: 14, color: paleta.muted }}>Sin registros en el mes.</div>}
        </div>
      )}
    </div>
  )
}

const urlMarcar = tk => `${window.location.origin}/marcar/${tk}`
function Enlaces({ empleados, recargar }) {
  const [copiado, setCopiado] = useState('')
  const copiar = async e => { try { await navigator.clipboard.writeText(urlMarcar(e.token_marcacion)); setCopiado(e.id); setTimeout(() => setCopiado(''), 1500) } catch { prompt('Copiá el enlace:', urlMarcar(e.token_marcacion)) } }
  const wsp = e => {
    const tel = String(e.telefono || '').replace(/\D/g, '')
    const txt = encodeURIComponent(`Hola ${e.nombre}, este es tu enlace personal para marcar entrada y salida en Briseo Limpieza (no lo compartas): ${urlMarcar(e.token_marcacion)}`)
    window.open(`https://wa.me/${tel}?text=${txt}`, '_blank')
  }
  const renovar = async e => {
    if (!confirm(`¿Generar un enlace nuevo para ${e.nombre}? El anterior deja de funcionar.`)) return
    await supabase.from('empleados').update({ token_marcacion: crypto.randomUUID().replace(/-/g, '') }).eq('id', e.id); recargar()
  }
  const sinToken = empleados.some(e => !e.token_marcacion)
  return (
    <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
      <div style={{ padding: 14, color: paleta.inkSoft, fontSize: 13 }}>
        Cada empleado tiene un enlace personal. Se lo mandás por WhatsApp y lo guarda en su celular (idealmente como acceso directo en la pantalla de inicio). Al abrirlo marca <b>entrada</b> y, la segunda vez, <b>salida</b>; el sistema calcula las horas y guarda la ubicación si el celular lo permite.
        {sinToken && <div style={{ color: paleta.warn, marginTop: 6 }}>Algunos empleados no tienen enlace: ejecutá marcacion_softgestion.sql en Supabase.</div>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>{['Empleado', 'Teléfono', 'Enlace', ''].map(h => <th key={h} style={{ ...s.tablaCabecera(), padding: '8px 10px' }}>{h}</th>)}</tr></thead>
        <tbody>{empleados.map(e => (
          <tr key={e.id} style={{ borderTop: `1px solid ${paleta.line}` }}>
            <td style={{ padding: '6px 10px', fontWeight: 600 }}>{e.apellido} {e.nombre}</td>
            <td style={{ padding: '6px 10px' }}>{e.telefono || <span style={{ color: paleta.muted }}>—</span>}</td>
            <td style={{ padding: '6px 10px', fontFamily: paleta.fontMono, fontSize: 11, color: paleta.muted }}>{e.token_marcacion ? `…/marcar/${e.token_marcacion.slice(0, 6)}…` : 'sin enlace'}</td>
            <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
              {e.token_marcacion && <><button style={s.btnSecundario} onClick={() => copiar(e)}><Copy size={13} /> {copiado === e.id ? 'Copiado' : 'Copiar'}</button>{' '}
              <button style={s.btnPrimario('#15803D')} onClick={() => wsp(e)}><MessageCircle size={13} /> WhatsApp</button>{' '}
              <button style={s.btnSecundario} onClick={() => renovar(e)}>Renovar</button></>}
            </td>
          </tr>))}</tbody>
      </table>
    </div>
  )
}
