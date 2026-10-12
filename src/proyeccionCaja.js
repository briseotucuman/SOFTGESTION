// Lógica pura de la proyección de caja (cashflow).
// Junta cobros y egresos de todas las fuentes en una lista de ítems
// { fecha, monto, rubro } y los agrupa por tramos de días o por mes.

const pad = n => String(n).padStart(2, '0')

export const RUBROS_EGRESO = ['facturas', 'prestamos', 'impuestos', 'costosFijos', 'sueldos']

export const NOMBRE_RUBRO = {
  cobrar: 'Por cobrar',
  facturas: 'Facturas de proveedores',
  prestamos: 'Préstamos (cuotas)',
  impuestos: 'Impuestos y otros',
  costosFijos: 'Costos fijos',
  sueldos: 'Sueldos',
}

export function isoLocal(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function ultimoDiaMes(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function finDeMes(ym) {
  return `${ym}-${pad(ultimoDiaMes(ym))}`
}

// Suma n meses manteniendo el día; si el mes destino es más corto, usa su último día
// (ej: 31/01 + 1 mes = 28/02).
export function sumarMeses(fechaISO, n) {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  const yy = Math.floor(idx / 12)
  const mm = (idx % 12) + 1
  const dd = Math.min(d, new Date(yy, mm, 0).getDate())
  return `${yy}-${pad(mm)}-${pad(dd)}`
}

export function fechasMensuales(primeraISO, cantidad) {
  return Array.from({ length: cantidad }, (_, i) => sumarMeses(primeraISO, i))
}

export function sumarMesesYM(ym, n) {
  return sumarMeses(`${ym}-01`, n).slice(0, 7)
}

export function diasEntre(desdeISO, hastaISO) {
  const [y1, m1, d1] = desdeISO.split('-').map(Number)
  const [y2, m2, d2] = hastaISO.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

export function nombreMes(ym) {
  const [y, m] = ym.split('-').map(Number)
  const n = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long' })
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${y}`
}

function sumaPorId(filas, campoId) {
  const mapa = {}
  ;(filas || []).forEach(p => { mapa[p[campoId]] = (mapa[p[campoId]] || 0) + Number(p.monto) })
  return mapa
}

/**
 * Arma la lista de ítems de caja futuros.
 * costosFijos: filas activas de costos_fijos { nombre, monto, frecuencia, mes }
 * liquidaciones: liquidaciones de sueldo { total_neto, estado, fecha_pago, periodo }
 */
export function construirItems({
  facturas = [], pagosVenta = [], facturasCompra = [], pagosCompra = [],
  compromisos = [], costosFijos = [], liquidaciones = [],
  hoyISO, meses = 12, incluirCostosMesActual = true,
}) {
  const items = []
  const pagadoV = sumaPorId(pagosVenta, 'factura_id')
  const pagadoC = sumaPorId(pagosCompra, 'factura_compra_id')

  facturas.forEach(f => {
    const saldo = Number(f.total) - (pagadoV[f.id] || 0)
    if (saldo > 0) items.push({ fecha: f.fecha_vencimiento || null, monto: saldo, rubro: 'cobrar' })
  })
  facturasCompra.forEach(f => {
    const saldo = Number(f.total) - (pagadoC[f.id] || 0)
    if (saldo > 0) items.push({ fecha: f.fecha_vencimiento || null, monto: saldo, rubro: 'facturas' })
  })

  compromisos.filter(c => c.estado === 'pendiente').forEach(c => {
    items.push({ fecha: c.fecha_vencimiento, monto: Number(c.monto), rubro: c.tipo === 'prestamo' ? 'prestamos' : 'impuestos' })
  })

  liquidaciones.filter(l => l.estado === 'pendiente').forEach(l => {
    const fecha = l.fecha_pago || (l.periodo ? finDeMes(l.periodo) : null)
    items.push({ fecha, monto: Number(l.total_neto), rubro: 'sueldos' })
  })

  // Costos fijos: los mensuales se repiten mes a mes desde el último importe cargado;
  // anuales y únicos se toman una sola vez en su mes (al fin de mes).
  const mesActual = hoyISO.slice(0, 7)
  const desdeMes = incluirCostosMesActual ? mesActual : sumarMesesYM(mesActual, 1)
  const porNombre = {}
  costosFijos.forEach(cf => {
    const clave = String(cf.nombre || '').trim().toUpperCase()
    if (!porNombre[clave]) porNombre[clave] = []
    porNombre[clave].push(cf)
  })
  Object.values(porNombre).forEach(filas => {
    const mensuales = filas.filter(f => f.frecuencia === 'mensual').sort((a, b) => a.mes.localeCompare(b.mes))
    if (mensuales.length) {
      const primerMes = mensuales[0].mes
      for (let i = 0; i < meses; i++) {
        const ym = sumarMesesYM(mesActual, i)
        if (ym < desdeMes || ym < primerMes) continue
        const aplicable = [...mensuales].reverse().find(f => f.mes <= ym)
        items.push({ fecha: finDeMes(ym), monto: Number(aplicable.monto), rubro: 'costosFijos' })
      }
    }
    filas.filter(f => f.frecuencia !== 'mensual' && f.mes >= desdeMes).forEach(f => {
      items.push({ fecha: finDeMes(f.mes), monto: Number(f.monto), rubro: 'costosFijos' })
    })
  })

  return items
}

const RUBROS = ['cobrar', ...RUBROS_EGRESO]
const vacio = () => Object.fromEntries(RUBROS.map(r => [r, 0]))

export const TRAMOS = [
  { id: 'vencido', label: 'Vencido', desde: -99999, hasta: -1 },
  { id: 'b30', label: '0-30 días', desde: 0, hasta: 30 },
  { id: 'b60', label: '31-60 días', desde: 31, hasta: 60 },
  { id: 'b90', label: '61-90 días', desde: 61, hasta: 90 },
  { id: 'mas90', label: '+90 días', desde: 91, hasta: 99999 },
  { id: 'sinfecha', label: 'Sin fecha', desde: null, hasta: null },
]

export function totalEgresos(fila) {
  return RUBROS_EGRESO.reduce((a, r) => a + (fila[r] || 0), 0)
}

export function agruparPorTramos(items, hoyISO) {
  const filas = TRAMOS.map(t => ({ ...t, ...vacio() }))
  items.forEach(it => {
    let fila
    if (!it.fecha) fila = filas.find(f => f.id === 'sinfecha')
    else {
      const d = diasEntre(hoyISO, it.fecha)
      fila = filas.find(f => f.desde !== null && d >= f.desde && d <= f.hasta)
    }
    fila[it.rubro] += it.monto
  })
  return filas
}

export function agruparPorMes(items, hoyISO, meses = 12) {
  const mesActual = hoyISO.slice(0, 7)
  const filas = [
    { id: 'vencido', label: 'Vencido', ...vacio() },
    ...Array.from({ length: meses }, (_, i) => {
      const ym = sumarMesesYM(mesActual, i)
      return { id: ym, label: nombreMes(ym), ...vacio() }
    }),
    { id: 'mas', label: 'Más adelante', ...vacio() },
    { id: 'sinfecha', label: 'Sin fecha', ...vacio() },
  ]
  const ultimo = filas[meses].id
  items.forEach(it => {
    let id
    if (!it.fecha) id = 'sinfecha'
    else if (it.fecha < hoyISO) id = 'vencido'
    else if (it.fecha.slice(0, 7) > ultimo) id = 'mas'
    else id = it.fecha.slice(0, 7)
    filas.find(f => f.id === id)[it.rubro] += it.monto
  })
  return filas
}
