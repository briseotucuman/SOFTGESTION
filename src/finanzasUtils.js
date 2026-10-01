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

  // 1. IMPUESTOS (AFIP / ARCA / IIBB / SIRCREB / Déb-Créd / Retenciones / Percepciones / Ley 25413)
  if (
    d.includes('afip') || d.includes('arca') || d.includes('iibb') || d.includes('sircreb') ||
    d.includes('deb.cred') || d.includes('deb-cred') || d.includes('debito credito') ||
    d.includes('ley 25413') || d.includes('impuesto') || d.includes('retenc') ||
    d.includes('percep') || d.includes('iva ') || d.includes(' dgr') || d.includes('rentas') ||
    d.includes('sellos') || d.includes('tasa ') || d.includes('percepcion') || d.includes('retencion') ||
    d.includes('imp.cred') || d.includes('imp.deb') || d.includes('ret.iibb') || d.includes('ret.iva')
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
    d.includes('comis') || d.includes('mantenimiento') || d.includes('paquete') ||
    d.includes('cargo') || d.includes('gasto') || d.includes('costo') ||
    d.includes('resumen') || d.includes('renovacion') || d.includes('emision') ||
    d.includes('cheque rech') || d.includes('chq rech') || d.includes('certific') ||
    d.includes('interes por descubierto') || d.includes('int.desc') || d.includes('com.transf') ||
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

