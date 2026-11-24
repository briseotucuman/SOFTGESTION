// Utilidades y reglas de negocio para finanzas y tesorería

/**
 * Determina si una cuenta es estrictamente bancaria (cuenta corriente, caja de ahorro),
 * excluyendo cajas físicas, efectivo o arqueos.
 *
 * @param {Object} ct - Objeto de cuenta con campos { tipo, banco, cbu, numero }
 * @returns {boolean} true si es cuenta de banco, false si es efectivo / caja
 */
export function esCuentaBancaria(ct) {
  if (!ct) return false
  const tipo = String(ct.tipo || '').toLowerCase().trim()
  const nombre = String(ct.banco || '').toLowerCase().trim()

  // Cuentas con tipo explícito de caja chica o efectivo
  if (tipo === 'caja_chica' || tipo === 'efectivo' || tipo === 'caja') {
    return false
  }

  // Nombres que indiquen caja de efectivo físico o arqueo
  if (
    nombre.includes('efectivo') ||
    nombre.includes('caja chica') ||
    nombre.includes('caja fisica') ||
    nombre.includes('caja fuerte') ||
    nombre.includes('arqueo')
  ) {
    return false
  }

  // Cajas numeradas o cajas físicas ("Caja 1", "Caja central") pero permitiendo "Caja de ahorro"
  if (nombre === 'caja' || (nombre.startsWith('caja ') && !nombre.includes('ahorro'))) {
    return false
  }

  return true
}

/**
 * Analiza el concepto e importe de un movimiento bancario para clasificarlo automáticamente
 * en Transferencia, Gasto Bancario, Impuesto, Sueldo/Haberes, Rendimiento u Otro.
 *
 * @param {string} descripcion - Concepto o glosa del extracto bancario
 * @param {number|string} monto - Importe del movimiento (positivo: crédito/ingreso, negativo: débito/egreso)
 * @returns {Object} Clasificación detallada con tipo, categoría sugerida, etiqueta y colores
 */
export function clasificarMovimientoBancario(descripcion, monto) {
  const d = (descripcion || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const numMonto = Number(monto) || 0
  const esIngreso = numMonto > 0

  // 1. IMPUESTOS (AFIP / ARCA / IIBB / SIRCREB / Déb-Créd / Retenciones / Percepciones / Ley 25413 / Sellado)
  if (
    d.includes('afip') || d.includes('arca') || d.includes('iibb') || d.includes('sircreb') ||
    d.includes('deb.cred') || d.includes('deb-cred') || d.includes('debito credito') ||
    d.includes('ley 25413') || d.includes('impuest') || d.includes('retenc') ||
    d.includes('percep') || d.includes('iva ') || d.includes(' dgr') || d.includes('rentas') ||
    d.includes('sellos') || d.includes('sellado') || d.includes('tasa ') ||
    d.includes('percepcion') || d.includes('retencion') ||
    d.includes('imp.cred') || d.includes('imp.deb') || d.includes('ret.iibb') ||
    d.includes('ret.iva') || d.includes('ret. ib') || d.includes('ret.ib')
  ) {
    return {
      tipo: 'impuesto',
      categoriaSugerida: 'Impuestos',
      label: 'Impuesto',
      detalle: 'Impuesto AFIP / IIBB / Déb-Créd',
      color: '#7C3AED',
      bg: '#F5F3FF',
      border: '#DDD6FE',
      icono: 'Landmark'
    }
  }

  // 2. GASTOS BANCARIOS (Comisiones, Mantenimiento, Paquete, Cargos, Resumen, Cheques)
  if (
    d.includes('comis') || d.includes('comi ') || d.includes('com mant') || d.includes('com.mant') ||
    d.includes('mantenimiento') || d.includes('paquete') ||
    d.includes('cargo') || d.includes('gasto') || d.includes('costo') ||
    d.includes('resumen') || d.includes('renovacion') || d.includes('emision') ||
    d.includes('cheque rech') || d.includes('chq rech') || d.includes('certific') ||
    d.includes('interes por descubierto') || d.includes('interes cobr') ||
    d.includes('int.desc') || d.includes('int.cob') || d.includes('com.transf') ||
    d.includes('cargo mens') || d.includes('serv.banco')
  ) {
    return {
      tipo: 'gasto_bancario',
      categoriaSugerida: 'Gastos bancarios',
      label: 'Gasto bancario',
      detalle: 'Comisión o cargo de la entidad',
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
      icono: 'CreditCard'
    }
  }

  // 3. TRANSFERENCIAS (Enviadas o Recibidas, Coelsa, Debin, Alias, CBU)
  if (
    d.includes('transf') || d.includes('transferencia') || d.includes('trf') ||
    d.includes('inmediata') || d.includes('coelsa') || d.includes('debin') ||
    d.includes('cbu') || d.includes('cvu') || d.includes('alias') ||
    d.includes('interbanking') || d.includes('envio') || d.includes('recep') ||
    d.includes('pago a proveed') || d.includes('cobro de client')
  ) {
    return {
      tipo: 'transferencia',
      categoriaSugerida: esIngreso ? 'Cobranzas' : 'Insumos',
      label: esIngreso ? 'Transf. Recibida' : 'Transf. Enviada',
      detalle: esIngreso ? 'Transferencia acreditada' : 'Transferencia enviada',
      color: esIngreso ? '#0284C7' : '#0369A1',
      bg: '#F0F9FF',
      border: '#BAE6FD',
      icono: 'ArrowRightLeft'
    }
  }

  // 4. HABERES / SUELDOS
  if (d.includes('sueldo') || d.includes('haberes') || d.includes('nomina') || d.includes('aguinaldo') || d.includes('sac')) {
    return {
      tipo: 'sueldo',
      categoriaSugerida: 'Haberes',
      label: 'Sueldo / Haberes',
      detalle: 'Pago de nómina laboral',
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      icono: 'Users'
    }
  }

  // 5. RENDIMIENTOS / INTERESES
  if (d.includes('rendimiento') || d.includes('plazo fijo') || d.includes('interes ganado') || d.includes('inversion')) {
    return {
      tipo: 'rendimiento',
      categoriaSugerida: 'Rendimientos e intereses',
      label: 'Rendimiento / Int.',
      detalle: 'Intereses o rentas ganadas',
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      icono: 'TrendingUp'
    }
  }

  // 6. DEFAULT GENERAL
  return {
    tipo: 'otro',
    categoriaSugerida: esIngreso ? 'Cobranzas' : 'Otro egreso',
    label: esIngreso ? 'Ingreso bancario' : 'Egreso bancario',
    detalle: esIngreso ? 'Acreditación en cuenta' : 'Débito en cuenta',
    color: '#64748B',
    bg: '#F8FAFC',
    border: '#E2E8F0',
    icono: esIngreso ? 'ArrowDownLeft' : 'ArrowUpRight'
  }
}

/**
 * Desglosa el importe total de una factura determinando el Neto y el IVA
 * a partir de la alícuota aplicable (regla: el Total ya incluye el IVA).
 */
export function calcularDesgloseFactura(facturaOTotal, alicuotaDefault = 21) {
  let total = 0
  let subtotal = 0
  let impuestos = 0
  let alicuota = alicuotaDefault

  if (typeof facturaOTotal === 'object' && facturaOTotal !== null) {
    total = parseFloat(facturaOTotal.total) || 0
    subtotal = parseFloat(facturaOTotal.subtotal) || 0
    impuestos = parseFloat(facturaOTotal.impuestos) || 0
    if (facturaOTotal.alicuota_iva !== undefined && facturaOTotal.alicuota_iva !== null && facturaOTotal.alicuota_iva !== '') {
      alicuota = parseFloat(facturaOTotal.alicuota_iva) || 0
    }
  } else {
    total = parseFloat(facturaOTotal) || 0
  }

  if (total === 0 && (subtotal > 0 || impuestos > 0)) {
    total = subtotal + impuestos
  }

  if (impuestos > 0 && subtotal > 0 && Math.abs((subtotal + impuestos) - total) < 0.05) {
    const alicCalc = Math.round((impuestos / subtotal) * 1000) / 10
    return {
      total: Math.round(total * 100) / 100,
      neto: Math.round(subtotal * 100) / 100,
      iva: Math.round(impuestos * 100) / 100,
      alicuota: alicCalc,
      factor: subtotal > 0 ? (total / subtotal) : 1
    }
  }

  const numAlic = parseFloat(alicuota) || 0
  const factor = 1 + (numAlic / 100)
  const neto = factor > 0 ? (total / factor) : total
  const iva = total - neto

  return {
    total: Math.round(total * 100) / 100,
    neto: Math.round(neto * 100) / 100,
    iva: Math.round(iva * 100) / 100,
    alicuota: numAlic,
    factor: Math.round(factor * 10000) / 10000
  }
}

/**
 * Indica si un movimiento financiero es un ajuste contable de saldo / arqueo
 * (no representa cobranzas ni gastos operativos reales del período).
 */
export function esMovimientoAjuste(m) {
  const cat = String(m?.categoria || '').toLowerCase().trim()
  return cat === 'ajuste de saldo' || cat === 'transferencia entre cuentas'
}

/**
 * Calcula el resumen unificado de Cuentas por Cobrar (facturas de venta pendientes netas de pagos).
 * Usado por Dashboard, Finanzas, Reportes y Facturación para garantizar cifras idénticas.
 */
export function calcularResumenCuentasPorCobrar(facturas = [], pagosVenta = []) {
  const pagadoPorFact = {}
  ;(pagosVenta || []).forEach(p => {
    if (p?.factura_id) {
      pagadoPorFact[p.factura_id] = (pagadoPorFact[p.factura_id] || 0) + Number(p.monto || 0)
    }
  })

  let totalPorCobrar = 0
  let cantidadPendientes = 0

  ;(facturas || []).forEach(f => {
    const est = String(f?.estado || '').toLowerCase().trim()
    if (['pagada', 'cobrada', 'anulada'].includes(est)) return
    const pagado = pagadoPorFact[f.id] || 0
    const saldo = Math.max(0, Number(f.total || 0) - pagado)
    if (saldo > 0.009) {
      totalPorCobrar += saldo
      cantidadPendientes++
    }
  })

  return {
    totalPorCobrar: Math.round(totalPorCobrar * 100) / 100,
    cantidadPendientes,
    pagadoPorFact
  }
}

/**
 * Calcula el resumen unificado de Cuentas por Pagar (facturas de compra pendientes netas de pagos).
 */
export function calcularResumenCuentasPorPagar(facturasCompra = [], pagosCompra = []) {
  const pagadoPorCompra = {}
  ;(pagosCompra || []).forEach(p => {
    if (p?.factura_compra_id) {
      pagadoPorCompra[p.factura_compra_id] = (pagadoPorCompra[p.factura_compra_id] || 0) + Number(p.monto || 0)
    }
  })

  let totalPorPagar = 0
  let cantidadPendientes = 0

  ;(facturasCompra || []).forEach(f => {
    const est = String(f?.estado || '').toLowerCase().trim()
    if (['pagada', 'anulada'].includes(est)) return
    const pagado = pagadoPorCompra[f.id] || 0
    const saldo = Math.max(0, Number(f.total || 0) - pagado)
    if (saldo > 0.009) {
      totalPorPagar += saldo
      cantidadPendientes++
    }
  })

  return {
    totalPorPagar: Math.round(totalPorPagar * 100) / 100,
    cantidadPendientes,
    pagadoPorCompra
  }
}

/**
 * Calcula saldos consolidados de Caja (Efectivo) y Bancos activos a la fecha.
 */
export function calcularSaldosCuentas(cuentas = []) {
  const activas = (cuentas || []).filter(ct => ct && ct.activa !== false)
  let totalBancos = 0
  let totalEfectivo = 0
  let cantidadBancos = 0
  let cantidadEfectivo = 0

  activas.forEach(ct => {
    const saldo = Number(ct.saldo || 0)
    if (esCuentaBancaria(ct)) {
      totalBancos += saldo
      cantidadBancos++
    } else {
      totalEfectivo += saldo
      cantidadEfectivo++
    }
  })

  totalBancos = Math.round(totalBancos * 100) / 100
  totalEfectivo = Math.round(totalEfectivo * 100) / 100

  return {
    totalBancos,
    totalEfectivo,
    totalCajaYBancos: Math.round((totalBancos + totalEfectivo) * 100) / 100,
    cantidadBancos,
    cantidadEfectivo,
    cantidadCuentas: activas.length
  }
}

export function formatearMonedaAR(valor, decimales = 2) {
  return Number(valor || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  })
}

