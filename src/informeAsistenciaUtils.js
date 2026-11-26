// Armado del informe mensual de asistencia por servicio (cliente) para su validación
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const nombrePeriodo = p => { const [a, m] = String(p).split('-'); return `${MESES[Number(m) - 1] || m} ${a}` }
export const fechaCorta = f => { const [a, m, d] = String(f).slice(0, 10).split('-'); return `${d}/${m}/${a}` }
const r2 = n => Math.round((Number(n) || 0) * 100) / 100
const hm = t => (t ? String(t).slice(0, 5) : '')
const minutos = t => Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3, 5))

export const calcHoras = (entrada, salida) => {
  if (!entrada || !salida) return null
  let m = minutos(salida) - minutos(entrada)
  if (m < 0) m += 1440
  return r2(m / 60)
}

export const fmtHoras = h => `${r2(h).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} h`

// Horas que el servicio tiene programadas en el mes según los horarios activos del cliente
export function horasProgramadas(horarios, periodo) {
  const [a, m] = periodo.split('-').map(Number)
  const dias = new Date(a, m, 0).getDate()
  let total = 0
  for (let d = 1; d <= dias; d++) {
    const iso = `${periodo}-${String(d).padStart(2, '0')}`
    const wd = new Date(a, m - 1, d).getDay()
    const isoDow = wd === 0 ? 7 : wd
    for (const h of horarios) {
      if (h.activo === false || !h.hora_desde || !h.hora_hasta) continue
      if (h.desde && iso < h.desde) continue
      if (h.hasta && iso > h.hasta) continue
      const ds = h.dias || []
      if (!(ds.includes(isoDow) || (wd === 0 && ds.includes(0)))) continue
      let mins = minutos(h.hora_hasta) - minutos(h.hora_desde)
      if (mins < 0) mins += 1440
      total += mins / 60
    }
  }
  return r2(total)
}

// Marcaciones de un cliente en el mes + indicadores para revisar antes de enviar
export function resumenCliente({ clienteId, periodo, asistencias, horarios }) {
  const filas = asistencias
    .filter(x => x.cliente_id === clienteId && String(x.fecha).startsWith(periodo))
    .sort((p, q) => (p.fecha + (p.entrada || '')).localeCompare(q.fecha + (q.entrada || '')))
  const trabajadas = filas.filter(x => x.tipo === 'trabajado')
  const sinSalida = trabajadas.filter(x => !x.salida)
  const fuera = trabajadas.filter(x => x.en_zona === false || x.en_zona_salida === false)
  const sinUbic = trabajadas.filter(x => x.origen === 'celular' && x.lat == null)
  const manuales = trabajadas.filter(x => x.origen !== 'celular')
  const horas = r2(trabajadas.reduce((s, x) => s + (Number(x.horas) || 0), 0))
  const programadas = horasProgramadas(horarios.filter(h => h.cliente_id === clienteId), periodo)
  return {
    filas, horas, programadas, sinSalida, fuera, sinUbic, manuales,
    dias: new Set(trabajadas.map(x => x.fecha)).size,
    empleados: new Set(trabajadas.map(x => x.empleado_id)).size,
  }
}

const ETIQ_TIPO = { trabajado: 'Trabajó', falta: 'Falta', licencia: 'Licencia', vacaciones: 'Vacaciones', enfermedad: 'Enfermedad' }

// Congela el informe para enviarlo: lo que el servicio valida no cambia aunque después se edite la asistencia
export function armarDatosInforme({ cliente, periodo, resumen, nombreEmpleado }) {
  const porEmp = {}
  resumen.filas.forEach(x => {
    const r = (porEmp[x.empleado_id] ||= { nombre: nombreEmpleado(x.empleado_id), horas: 0, dias: new Set(), faltas: 0, otras: 0 })
    if (x.tipo === 'trabajado') { r.horas += Number(x.horas) || 0; r.dias.add(x.fecha) }
    else if (x.tipo === 'falta') r.faltas++
    else r.otras++
  })
  return {
    cliente: { nombre: cliente.razon_social || cliente.nombre_contacto, cuit: cliente.cuit || null },
    periodo,
    resumen: { horas: resumen.horas, programadas: resumen.programadas, dias: resumen.dias, empleados: resumen.empleados },
    empleados: Object.values(porEmp).map(r => ({ nombre: r.nombre, horas: r2(r.horas), dias: r.dias.size, faltas: r.faltas, otras: r.otras }))
      .sort((p, q) => p.nombre.localeCompare(q.nombre)),
    filas: resumen.filas.map(x => ({
      fecha: x.fecha, empleado: nombreEmpleado(x.empleado_id), tipo: ETIQ_TIPO[x.tipo] || x.tipo,
      entrada: hm(x.entrada), salida: hm(x.salida), horas: x.horas == null ? null : Number(x.horas),
      obs: [x.salida || x.tipo !== 'trabajado' ? '' : 'Sin salida', x.observaciones && !/Salida no marcada/.test(x.observaciones) ? x.observaciones : ''].filter(Boolean).join(' · ')
    })),
  }
}

export const urlValidar = token => `${window.location.origin}/validar/${token}`

// HTML imprimible (guardar como PDF desde el diálogo de impresión)
export function htmlInforme(datos, marca, extra = '') {
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const h = n => (n == null ? '' : r2(n).toLocaleString('es-AR'))
  return `<!doctype html><html><head><meta charset="utf-8"><title>Informe de asistencia ${esc(datos.cliente.nombre)} ${esc(nombrePeriodo(datos.periodo))}</title>
<style>body{font-family:Arial,sans-serif;color:#0f172a;margin:28px;font-size:12px}h1{font-size:18px;margin:0}h2{font-size:13px;margin:18px 0 6px;color:#1e40af}
table{width:100%;border-collapse:collapse}th{background:#eff6ff;text-align:left;padding:5px 7px;border-bottom:1px solid #bfdbfe;font-size:11px}td{padding:4px 7px;border-bottom:1px solid #e2e8f0}
.k{display:flex;gap:10px;margin:10px 0}.k div{flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:8px}.k b{display:block;font-size:16px}.pie{margin-top:22px;color:#64748b;font-size:10.5px}
.num{text-align:right;font-variant-numeric:tabular-nums}</style></head><body>
<div style="display:flex;justify-content:space-between"><div><h1>Informe mensual de asistencia</h1><div>${esc(datos.cliente.nombre)}${datos.cliente.cuit ? ' · CUIT ' + esc(datos.cliente.cuit) : ''}</div><div>Período: <b>${esc(nombrePeriodo(datos.periodo))}</b></div></div>
<div style="text-align:right"><b>${esc(marca.fantasia)}</b><br>${esc(marca.razonSocial)}<br>CUIT ${esc(marca.cuit)}</div></div>
<div class="k"><div>Horas registradas<b>${h(datos.resumen.horas)} h</b></div><div>Horas programadas<b>${h(datos.resumen.programadas)} h</b></div><div>Días con servicio<b>${datos.resumen.dias}</b></div><div>Personal<b>${datos.resumen.empleados}</b></div></div>
<h2>Resumen por persona</h2><table><thead><tr><th>Persona</th><th class="num">Horas</th><th class="num">Días</th><th class="num">Faltas</th><th class="num">Licencias</th></tr></thead><tbody>
${datos.empleados.map(e => `<tr><td>${esc(e.nombre)}</td><td class="num">${h(e.horas)}</td><td class="num">${e.dias}</td><td class="num">${e.faltas}</td><td class="num">${e.otras}</td></tr>`).join('')}</tbody></table>
<h2>Detalle de marcaciones</h2><table><thead><tr><th>Fecha</th><th>Persona</th><th>Situación</th><th>Entrada</th><th>Salida</th><th class="num">Horas</th><th>Observaciones</th></tr></thead><tbody>
${datos.filas.map(f => `<tr><td>${esc(fechaCorta(f.fecha))}</td><td>${esc(f.empleado)}</td><td>${esc(f.tipo)}</td><td>${esc(f.entrada)}</td><td>${esc(f.salida)}</td><td class="num">${h(f.horas)}</td><td>${esc(f.obs)}</td></tr>`).join('')}</tbody></table>
${extra}<div class="pie">${esc(marca.pie)} · Registro de entrada y salida mediante marcación personal desde celular con verificación de ubicación.</div></body></html>`
}
