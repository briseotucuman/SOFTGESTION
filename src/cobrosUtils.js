import { supabase } from './supabase.js'

// Retenciones que los clientes practican al pagar (créditos fiscales a favor de Briseo)
export const TIPOS_RETENCION = [
  { id: 'ganancias', label: 'Ganancias' },
  { id: 'iva', label: 'IVA' },
  { id: 'iibb', label: 'Ingresos Brutos' },
  { id: 'tem', label: 'TEM (Municipalidad SMT)' },
  { id: 'suss', label: 'SUSS' },
  { id: 'otra', label: 'Otra' }
]
export const LABEL_RETENCION = Object.fromEntries(TIPOS_RETENCION.map(t => [t.id, t.label]))

export const retencionesVacias = () => Object.fromEntries(TIPOS_RETENCION.map(t => [t.id, '']))

export function totalRetenciones(ret) {
  return TIPOS_RETENCION.reduce((a, t) => a + (parseFloat(ret?.[t.id]) || 0), 0)
}

/**
 * Registra un cobro de factura de venta separando:
 *  - neto: lo que realmente entra a caja/banco (efectivo, transferencia, cheque)
 *  - retenciones: lo que el cliente retuvo (cancela deuda pero no es plata en cuenta)
 * La factura se cancela por neto + retenciones; la caja sube solo por el neto.
 */
export async function registrarCobroConRetenciones({ factura, neto, retenciones, certificado, fecha, medio_pago, cuenta_id, referencia, descripcion, forma_pago }) {
  const netoNum = Number(neto) || 0
  const lista = TIPOS_RETENCION
    .map(t => ({ tipo: t.id, monto: Math.round((parseFloat(retenciones?.[t.id]) || 0) * 100) / 100 }))
    .filter(r => r.monto > 0)
  const totalRet = lista.reduce((a, r) => a + r.monto, 0)
  const imputado = Math.round((netoNum + totalRet) * 100) / 100

  const { data: pago, error: errPago } = await supabase.from('pagos').insert([{
    factura_id: factura.id, fecha_pago: fecha, monto: imputado, monto_retenciones: totalRet,
    medio_pago, cuenta_id: netoNum > 0 ? cuenta_id : null, referencia: referencia || null
  }]).select('id').single()
  if (errPago) throw errPago

  if (lista.length) {
    const { error } = await supabase.from('retenciones_cobro').insert(lista.map(r => ({
      pago_id: pago.id, factura_id: factura.id, tipo: r.tipo, monto: r.monto,
      nro_certificado: certificado || null, fecha
    })))
    if (error) throw error
  }

  if (netoNum > 0) {
    await supabase.from('movimientos_financieros').insert([{
      fecha, tipo: 'ingreso', categoria: 'Cobranzas', descripcion, monto: netoNum,
      cuenta_id, comprobante: referencia || null, forma_pago, factura_id: factura.id
    }])
    const { data } = await supabase.from('cuentas_bancarias').select('saldo').eq('id', cuenta_id).single()
    if (data) await supabase.from('cuentas_bancarias').update({ saldo: Number(data.saldo) + netoNum }).eq('id', cuenta_id)
  }
  return { imputado, totalRet }
}

const hoyChequeISO = () => new Date().toISOString().split('T')[0]
export const chequeVacio = () => ({ numero: '', banco: '', librador: '', importe: '', fecha_emision: hoyChequeISO(), fecha_vencimiento: hoyChequeISO() })
export const listaChequesVacia = (librador = '') => [{ ...chequeVacio(), librador }]
export const totalCheques = lista => lista.reduce((a, c) => a + (parseFloat(c.importe) || 0), 0)

/** Valida la lista de cheques cargados; devuelve un mensaje de error o null. */
export function validarCheques(lista, importeEsperado) {
  for (let i = 0; i < lista.length; i++) {
    const ch = lista[i], n = lista.length > 1 ? ` (cheque ${i + 1})` : ''
    if (!ch.numero?.trim()) return 'Ingresá el número del cheque' + n
    if (!(parseFloat(ch.importe) > 0)) return 'Ingresá el importe del cheque' + n
    if (!ch.fecha_emision || !ch.fecha_vencimiento) return 'Completá la fecha de emisión y la de vencimiento' + n
    if (ch.fecha_vencimiento < ch.fecha_emision) return 'El vencimiento no puede ser anterior a la emisión' + n
  }
  const nums = lista.map(c => c.numero.trim())
  if (new Set(nums).size !== nums.length) return 'Hay números de cheque repetidos'
  if (importeEsperado !== undefined && Math.abs(totalCheques(lista) - importeEsperado) > 0.01) return 'La suma de los cheques no coincide con el importe a cobrar/pagar'
  return null
}

const filaCheque = (ch, extra) => ({
  numero: ch.numero.trim(), banco: ch.banco || null, librador: ch.librador || null,
  importe: parseFloat(ch.importe), fecha_emision: ch.fecha_emision, fecha_pago: ch.fecha_vencimiento, ...extra
})

/**
 * Cobro con cheques de tercero (uno o varios, p. ej. diferidos): quedan EN CARTERA y la plata entra
 * a la cuenta recién al depositarlos/cobrarlos desde Finanzas > Cheques, que ahí registra el cobro.
 */
export async function crearChequesTercero({ cheques, factura }) {
  const { error } = await supabase.from('cheques').insert(cheques.map(ch => filaCheque(ch, {
    tipo: 'tercero', estado: 'cartera', cliente_id: factura.cliente_id || null, factura_id: factura.id, cuenta_id: null
  })))
  if (error) throw error
}

/** Pago con cheques propios: quedan EMITIDOS y salen de la cuenta cuando se debitan (Finanzas > Cheques). */
export async function crearChequesPropios({ cheques, facturaCompra, cuenta_id }) {
  const { error } = await supabase.from('cheques').insert(cheques.map(ch => filaCheque(ch, {
    tipo: 'propio', estado: 'emitido', cuenta_id, proveedor_id: facturaCompra.proveedor_id || null, factura_compra_id: facturaCompra.id
  })))
  if (error) throw error
}
