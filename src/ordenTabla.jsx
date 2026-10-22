import { useMemo, useState } from 'react'

const comparador = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

/**
 * Orden por columna para tablas: click en el encabezado alterna ascendente / descendente.
 * columnas: [{ label, get: fila => valor }]  (sin `get` la columna no se ordena)
 */
export function useOrden(filas, columnas) {
  const [orden, setOrden] = useState({ idx: null, dir: 1 })

  const ordenadas = useMemo(() => {
    if (orden.idx === null || !columnas[orden.idx]?.get) return filas
    const get = columnas[orden.idx].get
    return [...filas].sort((a, b) => {
      const va = get(a), vb = get(b)
      if (va == null || va === '') return 1
      if (vb == null || vb === '') return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * orden.dir
      return comparador.compare(String(va), String(vb)) * orden.dir
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, orden])

  const encabezados = (estilo) => columnas.map((col, idx) => {
    const activa = orden.idx === idx
    const ordenable = !!col.get
    return (
      <th
        key={idx}
        style={{ ...estilo, cursor: ordenable ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
        aria-sort={activa ? (orden.dir === 1 ? 'ascending' : 'descending') : undefined}
        onClick={ordenable ? () => setOrden(o => (o.idx === idx ? { idx, dir: -o.dir } : { idx, dir: 1 })) : undefined}
        title={ordenable ? 'Ordenar' : undefined}
      >
        {col.label}{activa ? (orden.dir === 1 ? ' ▲' : ' ▼') : ''}
      </th>
    )
  })

  return { ordenadas, encabezados }
}
