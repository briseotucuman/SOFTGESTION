import { agruparLineas } from './parsersPdf.js'

// Extrae las páginas de un PDF como líneas de texto con posiciones (carga perezosa de pdf.js)
export async function extraerPaginas(archivo) {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise
  const paginas = []
  for (let n = 1; n <= doc.numPages; n++) {
    const tc = await (await doc.getPage(n)).getTextContent()
    const frag = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ x: i.transform[4], r: i.transform[4] + i.width, y: i.transform[5], s: i.str.trim() }))
    paginas.push(agruparLineas(frag))
  }
  return paginas
}
