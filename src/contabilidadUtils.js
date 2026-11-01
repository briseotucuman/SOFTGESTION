import { supabase } from './supabase.js'
import { esCuentaBancaria } from './finanzasUtils.js'

export const r2 = n => Math.round((Number(n) || 0) * 100) / 100
export const arsC = n => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Trae todas las filas de una consulta paginando de a 1000
export async function traerTodo(construir) {
  const todo = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await construir().range(desde, desde + 999)
    if (error) throw error
    todo.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return todo
}

const CUENTA_RETENCION = { ganancias: '1.1.03.03', iva: '1.1.03.02', iibb: '1.1.03.04', tem: '1.1.03.05', suss: '1.1.03.06', otra: '1.1.03.07' }
const GASTO_COMPRA = { Insumos: '5.1.01', Servicios: '5.2.02', Alquiler: '5.2.01', Alquileres: '5.2.01', Impuestos: '5.2.06', Mantenimiento: '5.2.05', Otro: '5.2.05' }
const EGRESO_MOV = { Alquileres: '5.2.01', Servicios: '5.2.02', Impuestos: '5.2.06', Préstamos: '2.1.04.01', Socios: '3.1.03', Marketing: '5.2.07', 'Otro egreso': '5.2.05', 'Ajuste de saldo': '5.3.02' }
const INGRESO_MOV = { 'Otro ingreso': '4.1.02', 'Ajuste de saldo': '5.3.02', Socios: '3.1.03' }

/**
 * Genera los asientos automáticos del período a partir de lo ya cargado en el sistema
 * (ventas, compras, cobros, pagos, movimientos manuales y liquidaciones). Es idempotente:
 * cada documento origen genera un único asiento (origen_tipo + origen_id).
 * Con `regenerar` borra antes los asientos automáticos del período (los manuales no se tocan).
 */
export async function generarAsientos({ desde, hasta, regenerar = false, usuario = null }) {
  const { data: plan, error: e0 } = await supabase.from('plan_cuentas').select('id, codigo')
  if (e0) throw e0
  const cta = Object.fromEntries((plan || []).map(p => [p.codigo, p.id]))
  if (!cta['1.1.01.01']) throw new Error('El plan de cuentas está vacío. Ejecutá primero el script de Contabilidad en Supabase.')

  // Cuentas bancarias -> cuentas contables
  const { data: bancos } = await supabase.from('cuentas_bancarias').select('*')
  const cuentaBanco = {}
  for (const b of bancos || []) {
    if (b.cuenta_contable_id) { cuentaBanco[b.id] = b.cuenta_contable_id; continue }
    if (!esCuentaBancaria(b)) { cuentaBanco[b.id] = cta['1.1.01.01']; continue }
    const { data: existentes } = await supabase.from('plan_cuentas').select('codigo').eq('padre_codigo', '1.1.01.02')
    const n = (existentes || []).length + 1
    const codigo = `1.1.01.02.${String(n).padStart(2, '0')}`
    const nombre = `Banco ${b.banco || ''} ${b.numero || b.tipo || ''}`.trim()
    const { data: nueva, error } = await supabase.from('plan_cuentas').insert([{ codigo, nombre, tipo: 'activo', rubro: 'Caja y bancos', imputable: true, padre_codigo: '1.1.01.02' }]).select('id').single()
    if (error) throw error
    await supabase.from('cuentas_bancarias').update({ cuenta_contable_id: nueva.id }).eq('id', b.id)
    cuentaBanco[b.id] = nueva.id
  }
  const banco = id => cuentaBanco[id] || cta['1.1.01.01']

  if (regenerar) {
    const { error } = await supabase.from('asientos').delete().neq('origen_tipo', 'manual').gte('fecha', desde).lte('fecha', hasta)
    if (error) throw error
  }
  const { data: yaHechos } = await supabase.from('asientos').select('origen_tipo, origen_id').neq('origen_tipo', 'manual').not('origen_id', 'is', null)
  const hechos = new Set((yaHechos || []).map(a => `${a.origen_tipo}:${a.origen_id}`))

  const nuevos = [] // { origen_tipo, origen_id, fecha, descripcion, lineas: [[codigoOId, debe, haber, detalle, cliente]] }
  const nuevo = (origen_tipo, origen_id, fecha, descripcion, lineas) => {
    if (!fecha || fecha < desde || fecha > hasta || hechos.has(`${origen_tipo}:${origen_id}`)) return
    const ls = lineas.filter(l => r2(l[1]) > 0 || r2(l[2]) > 0)
    const d = ls.reduce((a, l) => a + r2(l[1]), 0), h = ls.reduce((a, l) => a + r2(l[2]), 0)
    if (!ls.length || Math.abs(d - h) > 0.005) return
    nuevos.push({ origen_tipo, origen_id, fecha, descripcion, lineas: ls })
  }
  const C = codigo => cta[codigo]

  // 1) Ventas
  const fa = await traerTodo(() => supabase.from('facturas').select('id, numero_factura, fecha_emision, subtotal, total, impuestos, estado, tipo_comprobante, cliente_id, clientes(razon_social, nombre_contacto)').neq('estado', 'anulada').gte('fecha_emision', desde).lte('fecha_emision', hasta))
  fa.forEach(f => {
    const total = r2(f.total), neto = r2(f.subtotal ?? f.total), iva = r2(total - neto)
    const nc = /cr[eé]dito/i.test(f.tipo_comprobante || '')
    const quien = f.clientes?.razon_social || f.clientes?.nombre_contacto || ''
    const cl = f.cliente_id
    const lin = [[C('1.1.02.01'), total, 0, quien, cl], [C('4.1.01'), 0, neto, 'Ventas de servicios', cl], [C('2.1.03.01'), 0, iva, 'IVA débito fiscal', cl]]
    nuevo('venta', f.id, f.fecha_emision, `${nc ? 'NC' : 'Factura'} ${f.numero_factura || 's/n'} — ${quien}`, nc ? lin.map(l => [l[0], l[2], l[1], l[3], l[4]]) : lin)
  })

  // 2) Compras
  const fc = await traerTodo(() => supabase.from('facturas_compra').select('id, numero_factura, fecha_emision, subtotal, total, categoria, concepto, cliente_id, proveedores(razon_social)').neq('estado', 'anulada').gte('fecha_emision', desde).lte('fecha_emision', hasta))
  fc.forEach(f => {
    const total = r2(f.total), neto = r2(f.subtotal ?? f.total), iva = r2(total - neto)
    const gasto = C(GASTO_COMPRA[f.categoria] || '5.2.05')
    nuevo('compra', f.id, f.fecha_emision, `Compra ${f.numero_factura || 's/n'} — ${f.proveedores?.razon_social || ''}`, [[gasto, neto, 0, f.concepto || f.categoria, f.cliente_id], [C('1.1.03.01'), iva, 0, 'IVA crédito fiscal', null], [C('2.1.01.01'), 0, total, f.proveedores?.razon_social || '', null]])
  })

  // 3) Cobros (con retenciones sufridas)
  const pg = await traerTodo(() => supabase.from('pagos').select('id, fecha_pago, monto, monto_retenciones, cuenta_id, facturas(numero_factura, cliente_id, clientes(razon_social, nombre_contacto))').gte('fecha_pago', desde).lte('fecha_pago', hasta))
  const ret = await traerTodo(() => supabase.from('retenciones_cobro').select('pago_id, tipo, monto'))
  const retPor = {}; ret.forEach(r => { (retPor[r.pago_id] ||= []).push(r) })
  pg.forEach(p => {
    const monto = r2(p.monto), rt = r2(p.monto_retenciones), neto = r2(monto - rt)
    const quien = p.facturas?.clientes?.razon_social || p.facturas?.clientes?.nombre_contacto || ''
    const cl = p.facturas?.cliente_id
    const lin = [[banco(p.cuenta_id), neto, 0, `Cobro factura ${p.facturas?.numero_factura || ''}`, cl]]
    ;(retPor[p.id] || []).forEach(r => lin.push([C(CUENTA_RETENCION[r.tipo] || '1.1.03.07'), r2(r.monto), 0, `Retención ${r.tipo}`, cl]))
    const sumaRet = (retPor[p.id] || []).reduce((a, r) => a + r2(r.monto), 0)
    if (rt - sumaRet > 0.005) lin.push([C('1.1.03.07'), r2(rt - sumaRet), 0, 'Retención sin detallar', cl])
    lin.push([C('1.1.02.01'), 0, monto, quien, cl])
    nuevo('cobro', p.id, p.fecha_pago, `Cobro factura ${p.facturas?.numero_factura || 's/n'} — ${quien}`, lin)
  })

  // 4) Pagos a proveedores
  const pc = await traerTodo(() => supabase.from('pagos_compra').select('id, fecha_pago, monto, cuenta_id, facturas_compra(numero_factura, proveedores(razon_social))').gte('fecha_pago', desde).lte('fecha_pago', hasta))
  pc.forEach(p => {
    const m = r2(p.monto), prov = p.facturas_compra?.proveedores?.razon_social || ''
    nuevo('pago_compra', p.id, p.fecha_pago, `Pago factura ${p.facturas_compra?.numero_factura || 's/n'} — ${prov}`, [[C('2.1.01.01'), m, 0, prov, null], [banco(p.cuenta_id), 0, m, 'Pago a proveedor', null]])
  })

  // 5) Movimientos manuales (sin los que ya nacen de cobros o pagos de facturas)
  const mv = await traerTodo(() => supabase.from('movimientos_financieros').select('id, fecha, tipo, categoria, descripcion, monto, cuenta_id, factura_id, cliente_id').gte('fecha', desde).lte('fecha', hasta))
  mv.forEach(m => {
    const desc = m.descripcion || ''
    if (m.factura_id) return
    if (m.tipo === 'ingreso' && m.categoria === 'Cobranzas') return
    if (m.tipo === 'egreso' && (m.categoria === 'Insumos' || m.categoria === 'Pago a proveedores' || /^pago (con cheque|factura)/i.test(desc))) return
    const monto = r2(m.monto)
    if (m.tipo === 'ingreso') {
      nuevo('movimiento', m.id, m.fecha, desc || m.categoria || 'Ingreso', [[banco(m.cuenta_id), monto, 0, desc, m.cliente_id], [C(INGRESO_MOV[m.categoria] || '4.1.02'), 0, monto, m.categoria, m.cliente_id]])
    } else {
      let contra = EGRESO_MOV[m.categoria]
      if (m.categoria === 'Haberes') contra = /^anticipo/i.test(desc) ? '1.1.03.08' : '2.1.02.01'
      nuevo('movimiento', m.id, m.fecha, desc || m.categoria || 'Egreso', [[C(contra || '5.2.05'), monto, 0, desc || m.categoria, m.cliente_id], [banco(m.cuenta_id), 0, monto, desc, null]])
    }
  })

  // 6) Liquidaciones de sueldo
  const li = await traerTodo(() => supabase.from('liquidaciones_sueldo').select('id, periodo, fecha_pago, total_bruto, total_descuentos, total_neto, empleados(nombre, apellido)'))
  li.forEach(l => {
    const fecha = l.fecha_pago || `${String(l.periodo).slice(0, 7)}-28`
    const bruto = r2(l.total_bruto), desc = r2(l.total_descuentos), neto = r2(bruto - desc)
    nuevo('liquidacion', l.id, fecha, `Liquidación ${l.periodo} — ${l.empleados?.apellido || ''} ${l.empleados?.nombre || ''}`.trim(), [[C('5.1.02'), bruto, 0, 'Sueldo bruto', null], [C('2.1.02.01'), 0, neto, 'Neto a pagar', null], [C('2.1.02.02'), 0, desc, 'Retenciones y aportes', null]])
  })

  // Guardado por tandas (cada tanda inserta asientos y todas sus líneas)
  let creados = 0
  for (let i = 0; i < nuevos.length; i += 100) {
    const lote = nuevos.slice(i, i + 100)
    const { data: filas, error } = await supabase.from('asientos').insert(lote.map(a => ({ fecha: a.fecha, descripcion: a.descripcion, origen_tipo: a.origen_tipo, origen_id: a.origen_id, creado_por: usuario }))).select('id, origen_tipo, origen_id')
    if (error) throw error
    const idDe = Object.fromEntries(filas.map(f => [`${f.origen_tipo}:${f.origen_id}`, f.id]))
    const lineas = lote.flatMap(a => a.lineas.map(l => ({ asiento_id: idDe[`${a.origen_tipo}:${a.origen_id}`], cuenta_id: l[0], debe: r2(l[1]), haber: r2(l[2]), detalle: l[3] || null, cliente_id: l[4] || null })))
    const { error: e2 } = await supabase.from('asiento_lineas').insert(lineas)
    if (e2) { await supabase.from('asientos').delete().in('id', filas.map(f => f.id)); throw e2 }
    creados += lote.length
  }
  return { creados }
}
