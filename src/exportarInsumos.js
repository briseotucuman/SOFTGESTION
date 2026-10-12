// Exportación de pedidos de insumos a Excel y PDF.
// Las librerías se cargan recién al exportar para no engordar el bundle inicial.

const ESTADOS = { pedido: 'Pedido', enviado: 'Enviado', recibido: 'Recibido' }

const pad = n => String(n).padStart(2, '0')

export function fechaLocalISO(valor) {
  const d = new Date(valor)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fmtFecha(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function nombreArchivo(desde, hasta, ext) {
  const hoy = fechaLocalISO(new Date())
  const rango = desde || hasta
    ? `${desde ? fmtFecha(desde).replaceAll('/', '-') : 'inicio'}_a_${hasta ? fmtFecha(hasta).replaceAll('/', '-') : 'hoy'}`
    : fmtFecha(hoy).replaceAll('/', '-')
  return `Pedidos_insumos_${rango}.${ext}`
}

function textoRango(desde, hasta) {
  if (desde && hasta) return `Del ${fmtFecha(desde)} al ${fmtFecha(hasta)}`
  if (desde) return `Desde el ${fmtFecha(desde)}`
  if (hasta) return `Hasta el ${fmtFecha(hasta)}`
  return 'Todas las fechas'
}

// Una fila por ítem, ordenadas de la más antigua a la más reciente.
export function armarFilas(solicitudes, sucursales, insumos) {
  const filas = []
  const ordenadas = [...solicitudes].sort((a, b) => new Date(a.fecha_solicitud) - new Date(b.fecha_solicitud))
  for (const sol of ordenadas) {
    const suc = sucursales.find(x => x.id === sol.sucursal_id)
    const f = new Date(sol.fecha_solicitud)
    const base = {
      fecha: fechaLocalISO(f),
      hora: `${pad(f.getHours())}:${pad(f.getMinutes())}`,
      cliente: suc?.clientes?.razon_social || '',
      sucursal: suc?.nombre || 'Sin especificar',
      pidio: (sol.solicitado_por || '').trim(),
    }
    const itemsSol = sol.itemsSol || []
    if (itemsSol.length === 0) continue
    for (const it of itemsSol) {
      const ins = insumos.find(i => i.id === it.insumo_id)
      filas.push({
        ...base,
        insumo: (ins?.nombre || it.nombre_libre || '').replace(/\s+/g, ' ').trim(),
        cantidad: Number(it.cantidad) || 0,
        estado: ESTADOS[it.estado] || 'Pedido',
      })
    }
  }
  return filas
}

function consolidar(filas) {
  const mapa = new Map()
  for (const f of filas) mapa.set(f.insumo, (mapa.get(f.insumo) || 0) + f.cantidad)
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportarExcel(filas, desde, hasta) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SOFTGESTION · Briseo'
  const AZUL = 'FF0091DC'
  const fuente = { name: 'Arial', size: 10 }
  const borde = { style: 'thin', color: { argb: 'FFD0D7DE' } }
  const bordes = { top: borde, left: borde, bottom: borde, right: borde }

  function encabezado(ws, titulo, columnas) {
    ws.getCell('A1').value = titulo
    ws.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: AZUL } }
    ws.getCell('A2').value = `${textoRango(desde, hasta)} — emitido el ${fmtFecha(fechaLocalISO(new Date()))}`
    ws.getCell('A2').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } }
    const fila = ws.getRow(4)
    columnas.forEach((c, i) => {
      const cell = fila.getCell(i + 1)
      cell.value = c.titulo
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = bordes
      ws.getColumn(i + 1).width = c.ancho
    })
    ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }]
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  }

  // Hoja 1: detalle
  const ws = wb.addWorksheet('Detalle')
  encabezado(ws, 'BRISEO — Pedidos de insumos', [
    { titulo: 'Fecha', ancho: 12 }, { titulo: 'Hora', ancho: 8 }, { titulo: 'Cliente', ancho: 36 },
    { titulo: 'Sucursal', ancho: 18 }, { titulo: 'Solicitado por', ancho: 18 },
    { titulo: 'Insumo', ancho: 66 }, { titulo: 'Cantidad', ancho: 10 }, { titulo: 'Estado', ancho: 12 },
  ])
  let r = 5
  let grupo = 0
  let ultimoPedido = ''
  for (const f of filas) {
    const clave = `${f.fecha}|${f.hora}|${f.sucursal}`
    if (clave !== ultimoPedido) { grupo++; ultimoPedido = clave }
    const row = ws.getRow(r++)
    const [y, m, d] = f.fecha.split('-').map(Number)
    const vals = [new Date(Date.UTC(y, m - 1, d)), f.hora, f.cliente, f.sucursal, f.pidio, f.insumo, f.cantidad, f.estado]
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = v
      cell.font = fuente
      cell.border = bordes
      if (grupo % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5FC' } }
      if ([0, 1, 6, 7].includes(i)) cell.alignment = { horizontal: 'center' }
    })
    row.getCell(1).numFmt = 'DD/MM/YYYY'
  }
  if (filas.length) {
    ws.autoFilter = { from: 'A4', to: `H${r - 1}` }
    ws.getCell(`F${r}`).value = 'TOTAL UNIDADES'
    ws.getCell(`F${r}`).font = { name: 'Arial', size: 10, bold: true }
    ws.getCell(`G${r}`).value = { formula: `SUM(G5:G${r - 1})`, result: filas.reduce((a, f) => a + f.cantidad, 0) }
    ws.getCell(`G${r}`).font = { name: 'Arial', size: 10, bold: true }
    ws.getCell(`G${r}`).alignment = { horizontal: 'center' }
  }

  // Hoja 2: consolidado por insumo (útil para pasarle al proveedor)
  const wc = wb.addWorksheet('Consolidado por insumo')
  encabezado(wc, 'BRISEO — Consolidado por insumo', [
    { titulo: 'Insumo', ancho: 70 }, { titulo: 'Cantidad total', ancho: 14 },
  ])
  let rc = 5
  for (const [insumo, cant] of consolidar(filas)) {
    const row = wc.getRow(rc++)
    row.getCell(1).value = insumo
    row.getCell(2).value = cant
    for (const i of [1, 2]) { row.getCell(i).font = fuente; row.getCell(i).border = bordes }
    row.getCell(2).alignment = { horizontal: 'center' }
  }
  if (rc > 5) {
    wc.getCell(`A${rc}`).value = 'TOTAL'
    wc.getCell(`A${rc}`).font = { name: 'Arial', size: 10, bold: true }
    wc.getCell(`B${rc}`).value = { formula: `SUM(B5:B${rc - 1})`, result: filas.reduce((a, f) => a + f.cantidad, 0) }
    wc.getCell(`B${rc}`).font = { name: 'Arial', size: 10, bold: true }
    wc.getCell(`B${rc}`).alignment = { horizontal: 'center' }
  }

  const buffer = await wb.xlsx.writeBuffer()
  descargar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nombreArchivo(desde, hasta, 'xlsx'))
}

export async function exportarPDF(filas, desde, hasta) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(0, 145, 220)
  doc.text('BRISEO — Pedidos de insumos', 14, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`${textoRango(desde, hasta)} · emitido el ${fmtFecha(fechaLocalISO(new Date()))}`, 14, 21)

  const total = filas.reduce((a, f) => a + f.cantidad, 0)
  autoTable(doc, {
    startY: 26,
    head: [['Fecha', 'Cliente / Sucursal', 'Pidió', 'Insumo', 'Cant.', 'Estado']],
    body: filas.map(f => [
      fmtFecha(f.fecha),
      f.cliente ? `${f.cliente}\n${f.sucursal}` : f.sucursal,
      f.pidio,
      f.insumo,
      String(f.cantidad),
      f.estado,
    ]),
    foot: [['', '', '', 'TOTAL UNIDADES', String(total), '']],
    styles: { fontSize: 8, cellPadding: 1.8, textColor: 30, lineColor: [208, 215, 222], lineWidth: 0.1 },
    headStyles: { fillColor: [0, 145, 220], textColor: 255, halign: 'center' },
    footStyles: { fillColor: [232, 245, 252], textColor: 30, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' }, 1: { cellWidth: 62 }, 2: { cellWidth: 32 },
      4: { cellWidth: 14, halign: 'center' }, 5: { cellWidth: 22, halign: 'center' },
    },
    didDrawPage: () => {
      const n = doc.internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(`Página ${n}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
    },
  })

  // Consolidado en hoja aparte
  const cons = consolidar(filas)
  if (cons.length) {
    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(0, 145, 220)
    doc.text('Consolidado por insumo', 14, 15)
    autoTable(doc, {
      startY: 20,
      head: [['Insumo', 'Cantidad total']],
      body: cons.map(([i, c]) => [i, String(c)]),
      foot: [['TOTAL', String(total)]],
      styles: { fontSize: 8, cellPadding: 1.8, textColor: 30, lineColor: [208, 215, 222], lineWidth: 0.1 },
      headStyles: { fillColor: [0, 145, 220], textColor: 255, halign: 'center' },
      footStyles: { fillColor: [232, 245, 252], textColor: 30, fontStyle: 'bold' },
      columnStyles: { 1: { cellWidth: 32, halign: 'center' } },
    })
  }

  descargar(doc.output('blob'), nombreArchivo(desde, hasta, 'pdf'))
}
