// Lectura de los PDF de recibos de sueldo y del F.931 (sin dependencias del navegador, se puede probar en Node)
// Cada página es una lista de líneas; cada línea, una lista de fragmentos { x, r (borde derecho), s (texto) }.

const NUM = /^-?\d{1,3}(\.\d{3})*,\d{2}$/
const num = x => { const t = String(x ?? '').replace('$', '').trim(); return !t || t === '-' ? 0 : Number(t.replace(/\./g, '').replace(',', '.')) }
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const texto = l => l.items.map(i => i.s).join(' ').replace(/\s+/g, ' ').trim()
const fechaISO = d => { const [dd, mm, yy] = d.split('/'); return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` }
const r2 = n => Math.round(n * 100) / 100

export function agruparLineas(fragmentos) {
  const orden = [...fragmentos].sort((a, b) => b.y - a.y || a.x - b.x)
  const lineas = []
  for (const f of orden) {
    const l = lineas.find(l => Math.abs(l.y - f.y) <= 2.5)
    if (l) l.items.push(f); else lineas.push({ y: f.y, items: [f] })
  }
  lineas.forEach(l => l.items.sort((a, b) => a.x - b.x))
  return lineas
}

export function parsearRecibos(paginas) {
  const recibos = []
  for (const lineas of paginas) {
    const tx = lineas.map(texto)
    if (!tx.some(t => /Recibo de Haberes/i.test(t))) continue
    const avisos = []
    const iCab = tx.findIndex(t => /\d{3}\s+\$\s*[\d.,]+\s+\d+ años/.test(t))
    if (iCab < 0) { avisos.push('No se encontró el encabezado del recibo'); continue }
    const cab = tx[iCab].match(/^(\p{L}+) (\d{4})\s+(.+?),\s*(.+?)\s+(\d{3})\s+\$\s*([\d.,]+)\s+(\d+) años/u)
    if (!cab) { avisos.push('Encabezado ilegible'); continue }
    const mes = MESES.indexOf(cab[1].toUpperCase()) + 1
    const fila2 = tx.find(t => /\d+\/\d+\/\d{4}\s+.+\s\d{11}\s/.test(t)) || ''
    const f2 = fila2.match(/(\d+\/\d+\/\d{4})\s+(.+?)\s+(\d{11})\s+(\S+)\s+(\p{L}+ \d{4})/u)
    const ultimo = (re) => { const t = tx.find(x => re.test(x)); return t ? num((t.match(/([\d.]+,\d{2})\s*$/) || [])[1]) : 0 }
    const comp = tx.find(t => /COMPOSICION SALARIAL/.test(t))?.match(/Remunerativo:\s*\$\s*([\d.,]+)\s+No Remunerativo:\s*\$\s*([\d.,]+|-)\s+Descuentos:\s*\$\s*([\d.,]+|-)/)
    const pago = tx.find(t => /Fecha de Pago:/.test(t))?.match(/(\d+\/\d+\/\d{4})/)

    // Contribuciones del empleador (entre el primer "CONCEPTO ... MONTO" y "SUB TOTAL")
    const iMonto = tx.findIndex(t => /CONCEPTO.*UNIDAD.*BASE.*MONTO/.test(t))
    const iSub = tx.findIndex(t => /SUB TOTAL CONTRIBUCIONES/.test(t))
    const contrib = []
    if (iMonto >= 0 && iSub > iMonto) {
      for (const l of lineas.slice(iMonto + 1, iSub)) {
        const it = l.items.map(i => i.s)
        if (it.length >= 4 && NUM.test(it[it.length - 1]) && num(it[it.length - 1]) !== 0) contrib.push({ tipo: 'contribucion', concepto: it[0], unidad: it[1], base: num(it[2]), monto: num(it[it.length - 1]) })
      }
    }

    // Conceptos del recibo: la columna (remunerativo / no remunerativo / descuento) se decide por el borde derecho del importe
    const iHead = tx.findIndex(t => /REMUNERATIVO.*NO REMUNERAT.*DESCUENTOS/.test(t))
    const iComp = tx.findIndex(t => /COMPOSICION SALARIAL/.test(t))
    const conceptos = []
    if (iHead >= 0 && iComp > iHead) {
      const h = lineas[iHead].items
      const cols = [['haber_rem', h.find(i => /^REMUNERATIVO$/.test(i.s))], ['haber_no_rem', h.find(i => /NO REMUNERAT/.test(i.s))], ['descuento', h.find(i => /^DESCUENTOS$/.test(i.s))]]
      for (const l of lineas.slice(iHead + 1, iComp)) {
        const it = l.items
        if (it.length < 3 || !NUM.test(it[it.length - 1].s)) continue
        const monto = it[it.length - 1]
        const rest = it.slice(1, -1).map(i => i.s)
        const base = rest.length ? rest.pop() : '0'
        const unidad = rest.length ? rest.pop() : ''
        const tipo = cols.reduce((mejor, [t, hd]) => (hd && Math.abs(monto.r - hd.r) < Math.abs(monto.r - mejor[1].r) ? [t, hd] : mejor), cols[0])[0]
        conceptos.push({ tipo, concepto: it[0].s, unidad, base: num(base), monto: num(monto.s) })
      }
    }

    const r = {
      apellido: cab[3], nombre: cab[4], legajo: cab[5], periodo: `${cab[2]}-${String(mes).padStart(2, '0')}`,
      bruto: num(cab[6]), antiguedad: Number(cab[7]),
      ingreso: f2 ? fechaISO(f2[1]) : null, categoria: f2?.[2] || '', cuil: f2?.[3] || '', banco: f2?.[4] || '', periodo_aportes: f2?.[5] || '',
      costo: ultimo(/COSTO TOTAL EMPLEADOR/), contribuciones: ultimo(/SUB TOTAL CONTRIBUCIONES/), neto: ultimo(/SUELDO NETO/),
      remunerativo: comp ? num(comp[1]) : 0, no_remunerativo: comp ? num(comp[2]) : 0, descuentos: comp ? num(comp[3]) : 0,
      fecha_pago: pago ? fechaISO(pago[1]) : null, conceptos: [...conceptos, ...contrib], avisos
    }
    // Controles de consistencia
    const sum = t => r2(conceptos.filter(c => c.tipo === t).reduce((a, c) => a + c.monto, 0))
    if (Math.abs(sum('descuento') - r.descuentos) > 0.05) avisos.push(`Los descuentos detallados (${sum('descuento')}) no coinciden con el total (${r.descuentos})`)
    if (Math.abs(sum('haber_rem') - r.remunerativo) > 0.05) avisos.push(`Los haberes remunerativos detallados (${sum('haber_rem')}) no coinciden con el total (${r.remunerativo})`)
    if (Math.abs(r.bruto - r.descuentos - r.neto) > 1) avisos.push('Bruto − descuentos no coincide con el neto')
    if (Math.abs(r.bruto + r.contribuciones - r.costo) > 0.05) avisos.push('Bruto + contribuciones no coincide con el costo total del empleador')
    recibos.push(r)
  }
  return recibos
}

export function parsearF931(paginas) {
  const lineas = paginas.flat()
  const t = lineas.map(texto).join('\n')
  const m = (re) => { const x = t.match(re); return x ? num(x[1]) : 0 }
  const per = t.match(/(\d{2})\/(\d{4})\s+Servicios Eventuales/) || t.match(/Mes - Año[\s\S]{0,80}?(\d{2})\/(\d{4})/)
  const rem = {}
  for (const x of t.matchAll(/Suma de Rem\. (\d+):\s*([\d.]+,\d{2})/g)) rem[x[1]] = num(x[2])
  const d = {
    periodo: per ? `${per[2]}-${per[1]}` : null,
    cuit: (t.match(/C\.U\.I\.T\.\s*(\d{2}-\d{8}-\d)/) || [])[1] || null,
    rectificativa: Number((t.match(/Rect\. \(1\/9\):\s*(\d)/) || [])[1] || 0),
    nro_verificador: (t.match(/Nro\. Verificador:\s*(\d+)/) || t.match(/\b(\d{6})\s+Suma de Rem/) || t.match(/Verificador:[\s\S]{0,60}?(\d{6})/) || [])[1] || null,
    empleados: Number((t.match(/Empleados en nómina:\s*(\d+)/) || [])[1] || 0),
    aportes_ss: m(/301 - Aportes de Seguridad Social\s+([\d.]+,\d{2})/), aportes_os: m(/302 - Aportes de Obra Social\s+([\d.]+,\d{2})/),
    contribuciones_ss: m(/351 - Contribuciones de Seguridad Social\s+([\d.]+,\d{2})/), contribuciones_os: m(/352 - Contribuciones de Obra Social\s+([\d.]+,\d{2})/),
    detraccion: m(/Detracción art\. 23 Ley 27\.541\s+([\d.]+,\d{2})/),
    lrt: m(/312 - L\.R\.T\.\s+([\d.]+,\d{2})/), scvo: m(/028 - Seguro Colectivo de Vida Obligatorio\s+([\d.]+,\d{2})/),
    renatre: m(/360 - Contribuciones RENATRE\s+([\d.]+,\d{2})/), vales: m(/270 - Vales Alimentarios\/Cajas de alimentos\s+([\d.]+,\d{2})/), sepelio: m(/935 - Seg\. Sepelio UATRE\s+([\d.]+,\d{2})/)
  }
  for (let i = 1; i <= 10; i++) d['rem' + i] = rem[i] ?? 0
  d.total_a_pagar = r2(d.aportes_ss + d.aportes_os + d.contribuciones_ss + d.contribuciones_os + d.lrt + d.scvo + d.renatre + d.vales + d.sepelio)
  d.avisos = []
  if (!d.periodo) d.avisos.push('No se pudo leer el período')
  if (!d.total_a_pagar) d.avisos.push('No se pudieron leer los montos a ingresar (sección VIII)')
  return d
}
