import { useEffect, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HardHat,
  Landmark,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { colores } from '../estilos.js';
import { esMovimientoAjuste, formatearMonedaAR } from '../finanzasUtils.js';
import { supabase } from '../supabase.js';

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CARD_SPRING = { type: 'spring', stiffness: 320, damping: 24 };

function buildSmoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

function cortoARS(valor) {
  const v = Number(valor || 0);
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1).replace('.', ',')}M`;
  if (Math.abs(v) >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}

function IngresosSparkline({ serie }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const width = 280;
  const height = 72;
  const padX = 6;
  const padY = 10;

  const { coords, linePath, areaPath } = useMemo(() => {
    const safe = serie.length ? serie : [{ label: 'Sin datos', valor: 0 }];
    const vals = safe.map((d) => d.valor);
    const min = Math.min(...vals);
    const max = Math.max(...vals, min + 1);
    const span = max - min || 1;
    const mapped = safe.map((d, idx) => ({
      x: safe.length === 1 ? width / 2 : padX + (idx / (safe.length - 1)) * (width - padX * 2),
      y: height - padY - ((d.valor - min) / span) * (height - padY * 2),
      ...d,
    }));
    const line = buildSmoothPath(mapped);
    const area =
      mapped.length > 1
        ? `${line} L ${mapped[mapped.length - 1].x} ${height} L ${mapped[0].x} ${height} Z`
        : '';
    return { coords: mapped, linePath: line, areaPath: area };
  }, [serie]);

  const active = hoveredIdx !== null ? coords[hoveredIdx] : coords[coords.length - 1];

  return (
    <div className="relative mt-3 select-none">
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-400">
        <span>{active?.label || 'Período'}</span>
        <span className="tabular-nums font-semibold text-[#3B66F5]">
          {formatearMonedaAR(active?.valor || 0, 0)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[72px] overflow-visible"
        onMouseLeave={() => setHoveredIdx(null)}
        aria-label="Tendencia de ingresos cobrados"
      >
        <defs>
          <linearGradient id="briseoIngGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B66F5" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#A6BEFF" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {areaPath && (
          <Motion.path
            d={areaPath}
            fill="url(#briseoIngGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
        )}
        <Motion.path
          d={linePath}
          fill="none"
          stroke="#3B66F5"
          strokeWidth="2.4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        {coords.map((pt, idx) => {
          const isActive = (hoveredIdx ?? coords.length - 1) === idx;
          return (
            <g key={`${pt.label}-${idx}`}>
              <rect
                x={pt.x - width / (coords.length * 2)}
                y={0}
                width={width / Math.max(coords.length, 1)}
                height={height}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
              />
              {isActive && (
                <>
                  <line
                    x1={pt.x}
                    y1={pt.y}
                    x2={pt.x}
                    y2={height}
                    stroke="#A6BEFF"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle cx={pt.x} cy={pt.y} r="6" fill="#3B66F5" fillOpacity="0.16" />
                  <circle cx={pt.x} cy={pt.y} r="3.4" fill="#3B66F5" stroke="#ffffff" strokeWidth="1.5" />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EgresosWave({ serie }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const width = 260;
  const height = 62;
  const padX = 6;
  const padY = 10;

  const { coords, path } = useMemo(() => {
    const safe = serie.length ? serie : [{ label: 'Actual', valor: 0 }];
    const vals = safe.map((d) => d.valor);
    const min = Math.min(...vals);
    const max = Math.max(...vals, min + 1);
    const span = max - min || 1;
    const mapped = safe.map((d, idx) => ({
      x: safe.length === 1 ? width / 2 : padX + (idx / (safe.length - 1)) * (width - padX * 2),
      y: height - padY - ((d.valor - min) / span) * (height - padY * 2),
      ...d,
    }));
    return { coords: mapped, path: buildSmoothPath(mapped) };
  }, [serie]);

  const active = hoveredIdx !== null ? coords[hoveredIdx] : coords[coords.length - 1];

  return (
    <div className="mt-3 select-none">
      <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
        <span>{active?.label || 'Flujo'}</span>
        <span className="tabular-nums font-semibold text-[#A6BEFF]">
          {formatearMonedaAR(active?.valor || 0, 0)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[62px] overflow-visible"
        onMouseLeave={() => setHoveredIdx(null)}
        aria-label="Flujo de egresos"
      >
        <defs>
          <linearGradient id="briseoDarkStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3B66F5" />
            <stop offset="55%" stopColor="#7C9BFF" />
            <stop offset="100%" stopColor="#A6BEFF" />
          </linearGradient>
          <linearGradient id="briseoDarkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B66F5" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#18191C" stopOpacity="0" />
          </linearGradient>
          <filter id="briseoWaveGlow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {coords.length > 1 && (
          <path
            d={`${path} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`}
            fill="url(#briseoDarkFill)"
          />
        )}
        <Motion.path
          d={path}
          fill="none"
          stroke="url(#briseoDarkStroke)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#briseoWaveGlow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
        />
        {coords.map((pt, idx) => {
          const isActive = (hoveredIdx ?? coords.length - 1) === idx;
          return (
            <g key={`${pt.label}-${idx}`}>
              <rect
                x={pt.x - width / (coords.length * 2)}
                y={0}
                width={width / Math.max(coords.length, 1)}
                height={height}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
              />
              {isActive && (
                <>
                  <circle cx={pt.x} cy={pt.y} r="6" fill="#A6BEFF" fillOpacity="0.22" />
                  <circle cx={pt.x} cy={pt.y} r="3" fill="#ffffff" stroke="#3B66F5" strokeWidth="1.8" />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function BentoTablero({
  kpis,
  metricaPeriodo,
  alertas,
  esAdmin,
  filtroPeriodo,
  setFiltroPeriodo,
  actualizandoKpis,
  onSincronizar,
  onNavegar,
  todosItemsDisponibles,
}) {
  const [facturasMensuales, setFacturasMensuales] = useState([]);
  const [clientesTop, setClientesTop] = useState([]);
  const [cuentasDetalle, setCuentasDetalle] = useState([]);
  const [serieIngresos, setSerieIngresos] = useState([]);
  const [serieEgresos, setSerieEgresos] = useState([]);
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  const [verTodosModulos, setVerTodosModulos] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargarDetallesBento() {
      try {
        const hoy = new Date();
        const desde8Meses = new Date(hoy.getFullYear(), hoy.getMonth() - 7, 1)
          .toISOString()
          .slice(0, 10);

        const [{ data: facs }, { data: movs }, { data: cuentas }] = await Promise.all([
          supabase
            .from('facturas')
            .select('id, numero_factura, total, estado, fecha_emision, cliente_id, clientes(razon_social, nombre_contacto)')
            .neq('estado', 'anulada')
            .gte('fecha_emision', desde8Meses)
            .order('fecha_emision', { ascending: false })
            .limit(400),
          supabase
            .from('movimientos_financieros')
            .select('id, tipo, monto, categoria, fecha')
            .gte('fecha', desde8Meses)
            .order('fecha', { ascending: true })
            .limit(1500),
          supabase
            .from('cuentas_bancarias')
            .select('id, banco, tipo, saldo, activa')
            .eq('activa', true),
        ]);

        if (!activo) return;

        // 1. Facturación por mes (últimos 8 meses)
        const mapaMeses = [];
        for (let i = 7; i >= 0; i--) {
          const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          mapaMeses.push({
            key,
            label: MESES_ES[d.getMonth()],
            anio: d.getFullYear(),
            total: 0,
            cantidad: 0,
          });
        }

        (facs || []).forEach((f) => {
          const k = String(f.fecha_emision || '').slice(0, 7);
          const slot = mapaMeses.find((m) => m.key === k);
          if (slot) {
            slot.total += Number(f.total || 0);
            slot.cantidad += 1;
          }
        });

        setFacturasMensuales(mapaMeses);
        setMesSeleccionado((prev) => prev || mapaMeses[mapaMeses.length - 1]?.key || '');

        // 2. Top clientes del período reciente (agrupado por cliente desde facturas)
        const porCliente = {};
        (facs || []).forEach((f) => {
          const nombre =
            f.clientes?.razon_social || f.clientes?.nombre_contacto || 'Cliente general';
          const key = f.cliente_id || nombre;
          if (!porCliente[key]) {
            porCliente[key] = {
              id: key,
              nombre,
              facturas: 0,
              total: 0,
              ultimaFecha: f.fecha_emision || '',
              pendientes: 0,
            };
          }
          porCliente[key].facturas += 1;
          porCliente[key].total += Number(f.total || 0);
          if (!['pagada', 'cobrada'].includes(String(f.estado || '').toLowerCase())) {
            porCliente[key].pendientes += 1;
          }
        });

        const topOrdenados = Object.values(porCliente)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        setClientesTop(topOrdenados);

        // 3. Flujo mensual real de ingresos y egresos (sin ajustes/transferencias)
        const flujoMeses = mapaMeses.map((m) => ({ key: m.key, label: m.label, ing: 0, egr: 0 }));
        (movs || []).forEach((m) => {
          if (esMovimientoAjuste(m)) return;
          const k = String(m.fecha || '').slice(0, 7);
          const slot = flujoMeses.find((x) => x.key === k);
          if (!slot) return;
          const val = Number(m.monto || 0);
          if (m.tipo === 'ingreso') slot.ing += val;
          else if (m.tipo === 'egreso') slot.egr += val;
        });

        setSerieIngresos(flujoMeses.map((x) => ({ label: x.label, valor: Math.round(x.ing) })));
        setSerieEgresos(flujoMeses.map((x) => ({ label: x.label, valor: Math.round(x.egr) })));

        // 4. Cuentas activas para el ecualizador de Caja + Bancos
        setCuentasDetalle(cuentas || []);
      } catch {
        // Fallback silencioso si el usuario no tiene permisos o sin red
      }
    }

    cargarDetallesBento();
    return () => {
      activo = false;
    };
  }, [kpis.ingresosMes, kpis.saldoCajaYBancos, kpis.facturasPendientes]);

  const maxFacturacionMes = useMemo(
    () => Math.max(...facturasMensuales.map((m) => m.total), 1),
    [facturasMensuales],
  );

  const mesActivoObj =
    facturasMensuales.find((m) => m.key === mesSeleccionado) ||
    facturasMensuales[facturasMensuales.length - 1];

  const [hoveredCuenta, setHoveredCuenta] = useState(null);
  const maxCuentaAbs = useMemo(
    () => Math.max(...cuentasDetalle.map((c) => Math.abs(Number(c.saldo || 0))), 1),
    [cuentasDetalle],
  );

  const tasaCobranza = useMemo(() => {
    const denom = Number(metricaPeriodo.ingresos || 0) + Number(kpis.facturasPendientes || 0);
    if (denom <= 0) return 0;
    return Math.round((Number(metricaPeriodo.ingresos || 0) / denom) * 100);
  }, [metricaPeriodo.ingresos, kpis.facturasPendientes]);

  const operacionTotal = Math.max(
    1,
    kpis.clientes + kpis.contratos + kpis.empleados + metricaPeriodo.servicios,
  );

  const segmentosOperacion = [
    { label: 'Clientes', val: kpis.clientes, color: 'bg-[#3B66F5]', dot: 'bg-[#3B66F5]', mod: 'clientes' },
    { label: 'Contratos', val: kpis.contratos, color: 'bg-[#A6BEFF]', dot: 'bg-[#A6BEFF]', mod: 'contratos' },
    { label: 'Personal', val: kpis.empleados, color: 'bg-slate-800', dot: 'bg-slate-800', mod: 'personal' },
    { label: 'Servicios', val: metricaPeriodo.servicios, color: 'bg-slate-300', dot: 'bg-slate-300', mod: 'agenda' },
  ];

  return (
    <div className="space-y-5">
      {/* Barra de Período (Hoy / Semana / Mes) y Sincronización */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-full bg-white/85 border border-[#E5E7EB] p-1 shadow-[0_4px_16px_rgb(0,0,0,0.03)]">
          {[
            { id: 'hoy', label: 'Hoy' },
            { id: 'semana', label: 'Semana' },
            { id: 'mes', label: 'Mes actual' },
          ].map((p) => {
            const active = filtroPeriodo === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setFiltroPeriodo(p.id)}
                className={`relative rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  active ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {active && (
                  <Motion.span
                    layoutId="briseoPeriodoPill"
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    className="absolute inset-0 rounded-full bg-[#18191C]"
                  />
                )}
                <span className="relative z-10">{p.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onSincronizar}
          disabled={actualizandoKpis}
          className="inline-flex items-center gap-2 rounded-full bg-white/90 hover:bg-white border border-[#E5E7EB] px-4 py-2 text-xs font-semibold text-slate-700 shadow-[0_4px_16px_rgb(0,0,0,0.03)] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#3B66F5] ${actualizandoKpis ? 'animate-spin' : ''}`} />
          <span>{actualizandoKpis ? 'Sincronizando…' : 'Sincronizar datos'}</span>
        </button>
      </div>

      {/* BENTO GRID ASIMÉTRICO DE 3 COLUMNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* COLUMNA PRINCIPAL IZQUIERDA/CENTRO (2 columnas) */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* FILA SUPERIOR: 2 TARJETAS KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* KPI 1: INGRESOS COBRADOS DEL PERÍODO */}
            {esAdmin ? (
              <Motion.section
                whileHover={{ y: -4 }}
                transition={CARD_SPRING}
                onClick={() => onNavegar('finanzas', 'movimientos')}
                className="cursor-pointer bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-600">
                      {metricaPeriodo.tituloIngresos}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#3B66F5] tabular-nums">
                      <TrendingUp className="w-3 h-3" />
                      {tasaCobranza}% cobrado
                    </span>
                  </div>
                  <div className="mt-2 text-2xl sm:text-[30px] font-bold text-slate-900 tracking-tight tabular-nums">
                    {formatearMonedaAR(metricaPeriodo.ingresos)}
                  </div>
                  <p className="text-[11.5px] text-slate-500 mt-1 tabular-nums">
                    {metricaPeriodo.subtituloIngresos} · {metricaPeriodo.cantIngresos}{' '}
                    {metricaPeriodo.cantIngresos === 1 ? 'cobranza' : 'cobranzas'}
                  </p>
                </div>
                <IngresosSparkline serie={serieIngresos} />
              </Motion.section>
            ) : (
              <Motion.section
                whileHover={{ y: -4 }}
                transition={CARD_SPRING}
                onClick={() => onNavegar('agenda')}
                className="cursor-pointer bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-600">
                      {metricaPeriodo.tituloServicios}
                    </h2>
                    <CalendarDays className="w-4 h-4 text-[#3B66F5]" />
                  </div>
                  <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">
                    {metricaPeriodo.servicios}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{metricaPeriodo.subtituloServicios}</p>
                </div>
              </Motion.section>
            )}

            {/* KPI 2: OPERACIÓN & DOTACIÓN (CONTRATOS, SERVICIOS, CLIENTES, PERSONAL) */}
            <Motion.section
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-600">Operación Activa</h2>
                  <button
                    type="button"
                    onClick={() => onNavegar('agenda')}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#F3F5FA] hover:bg-slate-200/70 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors"
                  >
                    Agenda <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="mt-2 flex items-baseline gap-2.5">
                  <span className="text-2xl sm:text-[30px] font-bold text-slate-900 tracking-tight tabular-nums">
                    {metricaPeriodo.servicios}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {metricaPeriodo.subtituloServicios}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-3 w-full rounded-full bg-slate-100 p-0.5 flex gap-1 overflow-hidden">
                  {segmentosOperacion.map((seg) => (
                    <Motion.div
                      key={seg.label}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(6, (seg.val / operacionTotal) * 100)}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full ${seg.color}`}
                      title={`${seg.label}: ${seg.val}`}
                    />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-4 gap-1.5">
                  {segmentosOperacion.map((seg) => (
                    <button
                      key={seg.label}
                      type="button"
                      onClick={() => onNavegar(seg.mod)}
                      className="text-left rounded-lg px-1.5 py-1 hover:bg-[#F3F5FA] transition-colors"
                    >
                      <div className="flex items-center gap-1 text-[10.5px] text-slate-500 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${seg.dot}`} />
                        <span className="truncate">{seg.label}</span>
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums">
                        {seg.val}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Motion.section>
          </div>

          {/* FILA MEDIA: PRINCIPALES CLIENTES & FACTURACIÓN */}
          <Motion.section
            whileHover={{ y: -4 }}
            transition={CARD_SPRING}
            className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">
                  Principales Clientes & Facturación
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Volumen facturado en los últimos meses según comprobantes emitidos
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavegar(esAdmin ? 'facturacion' : 'clientes')}
                className="rounded-full bg-[#F3F5FA] hover:bg-[#E7ECF7] px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap"
              >
                Ver todos
              </button>
            </div>

            {clientesTop.length === 0 ? (
              <div className="py-6 text-center rounded-xl bg-[#F3F5FA]/60">
                <p className="text-xs font-medium text-slate-500">
                  {esAdmin
                    ? 'Aún no hay facturas registradas en los últimos meses.'
                    : `${kpis.clientes} cuentas corporativas activas · ${kpis.contratos} contratos vigentes`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {clientesTop.map((cli, idx) => {
                  const iniciales = cli.nombre
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase();
                  const tonos = [
                    'bg-blue-100 text-[#3B66F5]',
                    'bg-indigo-100 text-indigo-700',
                    'bg-sky-100 text-sky-700',
                    'bg-slate-200 text-slate-800',
                    'bg-violet-100 text-violet-700',
                  ];
                  return (
                    <button
                      key={cli.id}
                      type="button"
                      onClick={() => onNavegar(esAdmin ? 'facturacion' : 'clientes')}
                      className="w-full py-2.5 px-2.5 -mx-2.5 rounded-xl flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            tonos[idx % tonos.length]
                          }`}
                        >
                          {iniciales || 'CL'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {cli.nombre}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {cli.facturas} {cli.facturas === 1 ? 'comprobante' : 'comprobantes'}
                            {cli.pendientes > 0
                              ? ` · ${cli.pendientes} pendiente${cli.pendientes > 1 ? 's' : ''}`
                              : ' · Al día'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-slate-900 tabular-nums block">
                          {formatearMonedaAR(cli.total, 0)}
                        </span>
                        <span
                          className={`text-[11px] font-medium ${
                            cli.pendientes > 0 ? 'text-amber-600' : 'text-[#3B66F5]'
                          }`}
                        >
                          {cli.pendientes > 0 ? 'Con saldo' : 'Cobrado'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Motion.section>

          {/* FILA INFERIOR: GRÁFICO DE BARRAS MENSUAL (FACTURACIÓN POR MES) */}
          {esAdmin && (
            <Motion.section
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">
                    Facturación por Mes
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Seleccioná un mes para inspeccionar el total facturado (IVA incluido)
                  </p>
                </div>
                {mesActivoObj && (
                  <div className="flex items-center gap-3 rounded-xl bg-[#F3F5FA] px-3 py-1.5">
                    <span className="text-xs font-medium text-slate-500">
                      {mesActivoObj.label} {mesActivoObj.anio}
                    </span>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatearMonedaAR(mesActivoObj.total, 0)}
                    </span>
                    <span className="text-[11px] font-semibold text-[#3B66F5] tabular-nums">
                      {mesActivoObj.cantidad} fact.
                    </span>
                  </div>
                )}
              </div>

              <div className="h-[170px] flex items-end justify-between gap-2.5 sm:gap-3.5 pt-5">
                {facturasMensuales.map((item, idx) => {
                  const isHighlighted = item.key === (mesActivoObj?.key || '');
                  const heightPct = Math.max(
                    10,
                    Math.round((item.total / maxFacturacionMes) * 100),
                  );
                  const barColor = isHighlighted
                    ? 'bg-[#3B66F5] shadow-[0_6px_18px_rgba(59,102,245,0.28)]'
                    : idx % 2 === 0
                      ? 'bg-[#A6BEFF] hover:bg-[#8DAEFF]'
                      : 'bg-[#C4D5FF] hover:bg-[#9AB8FF]';

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMesSeleccionado(item.key)}
                      className="group flex-1 flex flex-col items-center h-full justify-end focus:outline-none"
                    >
                      <div className="relative w-full flex-1 flex items-end justify-center">
                        <span className="hidden sm:block absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-slate-500 tabular-nums">
                          {cortoARS(item.total)}
                        </span>
                        <Motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPct}%` }}
                          transition={{ duration: 0.45, delay: idx * 0.03 }}
                          className={`w-full max-w-[36px] rounded-t-lg transition-colors ${barColor}`}
                        />
                      </div>
                      <span
                        className={`mt-2.5 text-[11px] font-medium ${
                          isHighlighted ? 'text-[#3B66F5] font-semibold' : 'text-slate-400'
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Motion.section>
          )}
        </div>

        {/* COLUMNA DERECHA (1 columna, apilada verticalmente) */}
        <div className="lg:col-span-1 flex flex-col gap-5">
          {/* TARJETA SUPERIOR AZUL ROYAL: CAJA + BANCOS A LA FECHA */}
          {esAdmin ? (
            <Motion.section
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              onClick={() => onNavegar('finanzas', 'movimientos')}
              className="cursor-pointer bg-[#3B66F5] text-white rounded-2xl p-6 shadow-[0_12px_32px_rgba(59,102,245,0.25)] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-white/85">Caja + Bancos a la fecha</h2>
                  <span className="rounded-lg bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                    {kpis.cantCuentas} {kpis.cantCuentas === 1 ? 'cuenta' : 'cuentas'}
                  </span>
                </div>
                <div className="mt-2 text-2xl sm:text-[32px] font-bold tracking-tight text-white tabular-nums">
                  {formatearMonedaAR(kpis.saldoCajaYBancos)}
                </div>
                <p className="text-[11.5px] text-white/80 mt-1.5 tabular-nums">
                  Bancos: {formatearMonedaAR(kpis.saldoBancos, 0)} · Efec.:{' '}
                  {formatearMonedaAR(kpis.saldoEfectivo, 0)}
                </p>
              </div>

              {/* Ecualizador de cuentas activas */}
              <div className="mt-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between text-[11px] text-white/80 mb-2">
                  <span className="truncate">
                    {hoveredCuenta ? hoveredCuenta.banco : 'Distribución por cuenta'}
                  </span>
                  <span className="tabular-nums font-semibold text-white shrink-0 ml-2">
                    {hoveredCuenta
                      ? formatearMonedaAR(hoveredCuenta.saldo, 0)
                      : formatearMonedaAR(kpis.saldoCajaYBancos, 0)}
                  </span>
                </div>
                <div className="flex items-end gap-2 h-14">
                  {(cuentasDetalle.length ? cuentasDetalle : [{ id: 'empty', banco: 'Sin cuentas', saldo: 0 }]).map(
                    (ct, idx) => {
                      const pct = Math.max(
                        18,
                        Math.round((Math.abs(Number(ct.saldo || 0)) / maxCuentaAbs) * 100),
                      );
                      const isHov = hoveredCuenta?.id === ct.id;
                      return (
                        <button
                          key={ct.id}
                          type="button"
                          onMouseEnter={() => setHoveredCuenta(ct)}
                          onMouseLeave={() => setHoveredCuenta(null)}
                          onClick={() => onNavegar('finanzas', 'movimientos')}
                          title={`${ct.banco}: ${formatearMonedaAR(ct.saldo)}`}
                          className="flex-1 h-full flex items-end justify-center cursor-pointer"
                        >
                          <Motion.span
                            initial={{ height: 10 }}
                            animate={{ height: `${pct}%` }}
                            transition={{ duration: 0.45, delay: idx * 0.04 }}
                            className={`w-full max-w-[16px] rounded-full transition-colors ${
                              isHov ? 'bg-white' : idx % 2 === 0 ? 'bg-white/90' : 'bg-white/50'
                            }`}
                          />
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            </Motion.section>
          ) : (
            <Motion.section
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              onClick={() => onNavegar('clientes')}
              className="cursor-pointer bg-[#3B66F5] text-white rounded-2xl p-6 shadow-[0_12px_32px_rgba(59,102,245,0.25)]"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-white/85">Cuentas Corporativas</h2>
                <Users className="w-4 h-4 text-white/80" />
              </div>
              <div className="mt-2 text-3xl font-bold tabular-nums">{kpis.clientes}</div>
              <p className="text-xs text-white/80 mt-1">{kpis.contratos} contratos vigentes</p>
            </Motion.section>
          )}

          {/* TARJETA MEDIA BLANCA: CUENTAS POR COBRAR & POR PAGAR */}
          {esAdmin ? (
            <Motion.section
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <TrendingUp className="w-3.5 h-3.5 text-[#3B66F5]" />
                    <span>Cuentas por Cobrar</span>
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
                    {formatearMonedaAR(kpis.facturasPendientes)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                    {kpis.cantPorCobrar}{' '}
                    {kpis.cantPorCobrar === 1 ? 'factura pendiente' : 'facturas pendientes'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavegar('finanzas', 'por-cobrar')}
                  aria-label="Ir a Cuentas por Cobrar"
                  title="Ver Cuentas por Cobrar"
                  className="w-11 h-11 rounded-full bg-[#18191C] hover:bg-[#3B66F5] text-white flex items-center justify-center shrink-0 shadow-md transition-colors"
                >
                  <ArrowUpRight className="w-5 h-5" />
                </button>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                    <span>Cuentas por Pagar</span>
                  </div>
                  <div className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                    {formatearMonedaAR(kpis.porPagar)}
                  </div>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    {kpis.cantPorPagar}{' '}
                    {kpis.cantPorPagar === 1 ? 'comprobante pendiente' : 'comprobantes pendientes'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavegar('finanzas', 'por-pagar')}
                  className="rounded-full bg-[#F3F5FA] hover:bg-slate-200/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
                >
                  Ver pagar
                </button>
              </div>
            </Motion.section>
          ) : (
            <Motion.section
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              onClick={() => onNavegar('personal')}
              className="cursor-pointer bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-between"
            >
              <div>
                <h2 className="text-sm font-semibold text-slate-500">Dotación de Personal</h2>
                <div className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">
                  {kpis.empleados}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Operarios activos</p>
              </div>
              <div className="w-11 h-11 rounded-full bg-[#18191C] text-white flex items-center justify-center">
                <HardHat className="w-5 h-5" />
              </div>
            </Motion.section>
          )}

          {/* TARJETA INFERIOR OSCURA (#18191C): EGRESOS & ALERTAS ACTIVAS */}
          <Motion.section
            whileHover={{ y: -4 }}
            transition={CARD_SPRING}
            className="bg-[#18191C] text-white rounded-2xl p-6 shadow-[0_12px_32px_rgba(24,25,28,0.22)] flex-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-zinc-400">
                  {esAdmin ? `Egresos (${metricaPeriodo.etiquetaPeriodo})` : 'Alertas Operativas'}
                </h2>
                <span
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                    alertas.length > 0
                      ? 'bg-amber-400/20 text-amber-300'
                      : 'bg-emerald-400/15 text-emerald-300'
                  }`}
                >
                  {alertas.length > 0 ? `${alertas.length} alertas` : 'Al día'}
                </span>
              </div>

              <div className="mt-2 text-2xl sm:text-[30px] font-bold tracking-tight text-white tabular-nums">
                {esAdmin ? formatearMonedaAR(metricaPeriodo.egresos) : alertas.length}
              </div>

              {esAdmin && <EgresosWave serie={serieEgresos} />}
            </div>

            {/* Alertas rápidas accionables */}
            <div className="mt-4 pt-3.5 border-t border-white/10 space-y-2 max-h-44 overflow-y-auto">
              {alertas.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Sin alertas operativas pendientes.</span>
                </div>
              ) : (
                alertas.slice(0, 4).map((a, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => a.modulo && onNavegar(a.modulo)}
                    className="w-full text-left flex items-start justify-between gap-2.5 rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 transition-colors"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                          a.tipo === 'danger'
                            ? 'text-rose-400'
                            : a.tipo === 'warning'
                              ? 'text-amber-300'
                              : 'text-[#A6BEFF]'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{a.titulo}</div>
                        <div className="text-[11px] text-zinc-400 truncate">{a.detalle}</div>
                      </div>
                    </div>
                    {a.monto > 0 && (
                      <span className="text-[11px] font-semibold text-[#A6BEFF] tabular-nums shrink-0">
                        {cortoARS(a.monto)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </Motion.section>
        </div>
      </div>

      {/* BANDA DE ACCESOS DIRECTOS A MÓDULOS ERP */}
      <Motion.section
        whileHover={{ y: -2 }}
        transition={CARD_SPRING}
        className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      >
        <button
          type="button"
          onClick={() => setVerTodosModulos((v) => !v)}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F3F5FA] flex items-center justify-center text-[#3B66F5]">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Módulos del Sistema ERP</h3>
              <p className="text-xs text-slate-500">
                Acceso directo a todos los módulos operativos, contables y financieros
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline rounded-full bg-[#F3F5FA] px-3 py-1 text-[11px] font-semibold text-slate-600 tabular-nums">
              {todosItemsDisponibles.length} activos
            </span>
            {verTodosModulos ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {verTodosModulos && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {todosItemsDisponibles.map((item) => {
              const Icon = item.icon;
              const colorMod = colores[item.id]?.main || '#3B66F5';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onNavegar(
                      item.id === 'conciliacion' ? 'conciliacion' : item.id,
                      item.id === 'finanzas' ? 'movimientos' : undefined,
                    )
                  }
                  className="group rounded-xl border border-[#E5E7EB] bg-[#F3F5FA]/50 hover:bg-white hover:border-[#3B66F5]/40 p-3 text-left flex items-center gap-3 transition-all hover:shadow-xs"
                >
                  <div
                    className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-2xs"
                    style={{ color: colorMod }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 group-hover:text-[#3B66F5] truncate transition-colors">
                      {item.label}
                    </div>
                    <div className="text-[10.5px] text-slate-500 truncate">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Motion.section>
    </div>
  );
}
