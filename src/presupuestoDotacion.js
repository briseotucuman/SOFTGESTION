// Motor de cálculo del presupuestador "por dotación" (servicio de limpieza continuo).
// Misma lógica que la planilla Presupuestador_Servicio_Limpieza.xlsx. Funciones puras, sin dependencias de React.

export const CONFIG_DEFAULT = {
  // Jornada y dotación
  horasTurno: 8,            // horas de un turno
  maxDiasEmpleado: 6,       // días máximos trabajados por empleado por semana
  horasContratoSemana: 48,  // base del factor de contratación (prorrateo)
  prorrateo: true,          // si la jornada es < 48 h, se contrata proporcionalmente
  reservaPct: 7.5,          // % de retén/reemplazos sobre la dotación base (mín. 1)
  turnosPorDia: 3,
  // Costo laboral mensual por persona (bruto + cargas + SAC/vacaciones)
  costoJefe: 1589178.73,
  costoOperario: 1585284.71,
  // Referencia de las cantidades de insumos y equipos
  refEmpleadosTurno: 12,
  refHorasDia: 24,
  refDiasSemana: 7,
  // Porcentajes (sobre costos directos / sobre precio)
  gaPct: 8,
  imprevistosPct: 3,
  margenPct: 15,
  iibbPct: 3.5,
  chequePct: 1.2,
  incluirImpuestosEnPrecio: false,
  ivaPct: 21,
  // escala: 'fijo' | 'dias' | 'horas'
  insumos: [
    { cod: 'COD306', nombre: 'LUXE Papel Higiénico Blanco Cono Chico x 8 un.', unidad: 'Bulto', cantidad: 150, precio: 5569.6, escala: 'dias' },
    { cod: 'COD2081', nombre: 'LUXE Toalla Intercalada Beige x 10 paq.', unidad: 'Bulto', cantidad: 180, precio: 4449, escala: 'dias' },
    { cod: 'QUIM-01', nombre: 'Jabón líquido bactericida para manos (bidón 5 L)', unidad: 'Bidón', cantidad: 30, precio: 8500, escala: 'dias' },
    { cod: 'QUIM-02', nombre: 'Desinfectante amonio cuaternario / hipoclorito (bidón 5 L)', unidad: 'Bidón', cantidad: 40, precio: 7200, escala: 'horas' },
    { cod: 'QUIM-03', nombre: 'Detergente neutro / desengrasante industrial (bidón 5 L)', unidad: 'Bidón', cantidad: 30, precio: 6800, escala: 'horas' },
    { cod: 'QUIM-04', nombre: 'Limpiavidrios antiestático concentrado (bidón 5 L)', unidad: 'Bidón', cantidad: 15, precio: 6200, escala: 'fijo' },
    { cod: 'RES-01', nombre: 'Bolsas consorcio alto micraje (80×100 cm) x 100', unidad: 'Paquete', cantidad: 50, precio: 14500, escala: 'dias' },
    { cod: 'VARIOS', nombre: 'Paños microfibra, mopas, repuestos de secadores, discos', unidad: 'Global', cantidad: 1, precio: 185000, escala: 'horas' }
  ],
  // porEmpleado=true: la cantidad crece con los empleados por turno (redondeo hacia arriba, mínimo 1)
  equipos: [
    { nombre: 'Lavadora / fregadora automática de pisos', cantidad: 2, costoUnit: 225000, porEmpleado: true },
    { nombre: 'Lustradora rotativa industrial', cantidad: 2, costoUnit: 75000, porEmpleado: true },
    { nombre: 'Aspiradora industrial polvo/agua 70 L', cantidad: 2, costoUnit: 57000, porEmpleado: true },
    { nombre: 'Hidrolavadora de alta presión (200 bar)', cantidad: 2, costoUnit: 95000, porEmpleado: true },
    { nombre: 'Equipos de altura (andamios, escaleras, arneses)', cantidad: 1, costoUnit: 60000, porEmpleado: false },
    { nombre: 'Carros de limpieza, baldes estrujadores, EPP', cantidad: 1, costoUnit: 100000, porEmpleado: true },
    { nombre: 'Prensa compactadora de residuos (SIN COSTO CARGADO)', cantidad: 1, costoUnit: 0, porEmpleado: false }
  ]
}

export const ESCALAS = [['fijo', 'Fijo'], ['dias', 'Días/semana'], ['horas', 'Horas-puesto']]

export const INPUT_DEFAULT = {
  empleadosTurno: 12,
  jefesTurno: 1,
  horasDia: 24,
  diasSemana: 7,
  dotacionManual: '',   // vacío = automática
  plazoMeses: 12
}

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
// Equivalente a ROUNDUP(ROUND(x,6),0) de la planilla: evita que 3.0000000001 suba a 4
const techo = (x) => Math.ceil(Math.round(x * 1e6) / 1e6)
const redondea = (x) => Math.round(x)

export function calcular(inputRaw, cfgRaw = CONFIG_DEFAULT) {
  const cfg = { ...CONFIG_DEFAULT, ...cfgRaw }
  const P = Math.max(0, n(inputRaw.empleadosTurno))
  const J = Math.min(P, Math.max(0, n(inputRaw.jefesTurno)))
  const H = Math.min(24, Math.max(0, n(inputRaw.horasDia)))
  const D = Math.min(7, Math.max(0, n(inputRaw.diasSemana)))
  const manual = inputRaw.dotacionManual === '' || inputRaw.dotacionManual == null ? null : Math.max(0, n(inputRaw.dotacionManual))
  const plazo = Math.max(1, n(inputRaw.plazoMeses) || 1)

  // --- Dotación ---
  const turnos = H / cfg.horasTurno
  const horasPuestoSemana = P * H * D
  const diasTrabajados = Math.min(D, cfg.maxDiasEmpleado)
  const horasEmpleadoSemana = cfg.horasTurno * diasTrabajados
  const base = horasEmpleadoSemana > 0 ? techo(horasPuestoSemana / horasEmpleadoSemana) : 0
  const reserva = base > 0 ? Math.max(1, redondea(base * n(cfg.reservaPct) / 100)) : 0
  const total = manual != null ? manual : base + reserva
  const jefes = Math.min(total, techo(turnos) * J)
  const titulares = Math.max(0, Math.min(total - jefes, redondea((P - J) * turnos)))
  const reten = total - jefes - titulares
  const cobertura = horasPuestoSemana > 0 ? (total * horasEmpleadoSemana) / horasPuestoSemana : 0
  const factorContratacion = cfg.prorrateo ? Math.min(1, horasEmpleadoSemana / cfg.horasContratoSemana) : 1

  const laboralJefes = jefes * n(cfg.costoJefe) * factorContratacion
  const laboralOperarios = (titulares + reten) * n(cfg.costoOperario) * factorContratacion
  const laboral = laboralJefes + laboralOperarios

  // --- Factores de escala para insumos y equipos ---
  const hpRef = n(cfg.refEmpleadosTurno) * n(cfg.refHorasDia) * n(cfg.refDiasSemana)
  const fDias = cfg.refDiasSemana > 0 ? D / cfg.refDiasSemana : 0
  const fHoras = hpRef > 0 ? horasPuestoSemana / hpRef : 0
  const fEmpleados = cfg.refEmpleadosTurno > 0 ? P / cfg.refEmpleadosTurno : 0

  const insumos = cfg.insumos.map((i) => {
    const f = i.escala === 'fijo' ? 1 : i.escala === 'dias' ? fDias : fHoras
    const cantidad = n(i.cantidad) * f
    return { ...i, cantidadCalc: cantidad, costo: cantidad * n(i.precio) }
  })
  const totalInsumos = insumos.reduce((a, i) => a + i.costo, 0)

  const equipos = cfg.equipos.map((e) => {
    const cantidad = e.porEmpleado ? Math.max(1, techo(n(e.cantidad) * fEmpleados)) : n(e.cantidad)
    return { ...e, cantidadCalc: cantidad, costo: cantidad * n(e.costoUnit) }
  })
  const totalEquipos = equipos.reduce((a, e) => a + e.costo, 0)

  // --- Costos y precio ---
  const directos = laboral + totalInsumos + totalEquipos
  const ga = directos * n(cfg.gaPct) / 100
  const imprevistos = directos * n(cfg.imprevistosPct) / 100
  const costoOperativo = directos + ga + imprevistos
  const margen = n(cfg.margenPct) / 100
  const tasaImp = cfg.incluirImpuestosEnPrecio ? (n(cfg.iibbPct) + n(cfg.chequePct)) / 100 : 0
  const denom = 1 - margen - tasaImp
  const precioNeto = denom > 0 ? costoOperativo / denom : 0
  const utilidad = precioNeto * margen
  const impuestos = precioNeto * tasaImp
  const iva = precioNeto * n(cfg.ivaPct) / 100
  const precioConIva = precioNeto + iva
  const horasPuestoMes = (horasPuestoSemana * 365) / 12 / 7

  return {
    entrada: { P, J, H, D, manual, plazo },
    dotacion: { turnos, horasPuestoSemana, diasTrabajados, horasEmpleadoSemana, base, reserva, total, jefes, titulares, reten, cobertura, factorContratacion },
    laboral: { jefes: laboralJefes, operarios: laboralOperarios, total: laboral },
    insumos, totalInsumos, equipos, totalEquipos,
    directos, ga, imprevistos, costoOperativo, utilidad, impuestos,
    precioNeto, iva, precioConIva,
    totalPlazoNeto: precioNeto * plazo, totalPlazoConIva: precioConIva * plazo,
    horasPuestoMes,
    netoPorHora: horasPuestoMes > 0 ? precioNeto / horasPuestoMes : 0,
    conIvaPorHora: horasPuestoMes > 0 ? precioConIva / horasPuestoMes : 0,
    netoPorPersona: total > 0 ? precioNeto / total : 0,
    margenSobreCosto: costoOperativo > 0 ? (precioNeto - costoOperativo - impuestos) / costoOperativo : 0
  }
}
