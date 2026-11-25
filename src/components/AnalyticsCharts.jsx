import { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';

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

export function DeliverySparkline({ data }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const width = 280;
  const height = 74;
  const padX = 6;
  const padY = 10;

  const { coords, linePath, areaPath } = useMemo(() => {
    const rates = data.map((d) => d.rate);
    const min = Math.min(...rates) - 0.8;
    const max = Math.max(...rates) + 0.6;
    const span = max - min || 1;
    const mapped = data.map((d, idx) => ({
      x: padX + (idx / Math.max(data.length - 1, 1)) * (width - padX * 2),
      y: height - padY - ((d.rate - min) / span) * (height - padY * 2),
      ...d,
    }));
    const line = buildSmoothPath(mapped);
    const area = `${line} L ${mapped[mapped.length - 1].x} ${height} L ${mapped[0].x} ${height} Z`;
    return { coords: mapped, linePath: line, areaPath: area };
  }, [data]);

  const activePoint = hoveredIdx !== null ? coords[hoveredIdx] : coords[coords.length - 1];

  return (
    <div className="relative mt-3 select-none">
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-400">
        <span>{activePoint.day}</span>
        <span className="tabular-nums text-[#3B66F5] font-semibold">
          {activePoint.rate.toFixed(1)}% · {activePoint.delivered.toLocaleString()} sent
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[74px] overflow-visible"
        onMouseLeave={() => setHoveredIdx(null)}
        aria-label="Delivery rate trend chart"
      >
        <defs>
          <linearGradient id="deliveryAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B66F5" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#A6BEFF" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <Motion.path
          d={areaPath}
          fill="url(#deliveryAreaGrad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
        />
        <Motion.path
          d={linePath}
          fill="none"
          stroke="#3B66F5"
          strokeWidth="2.4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
        />
        {coords.map((pt, idx) => {
          const isActive = (hoveredIdx ?? coords.length - 1) === idx;
          return (
            <g key={pt.day}>
              <rect
                x={pt.x - width / (coords.length * 2)}
                y={0}
                width={width / coords.length}
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

export function CampaignProgressViz({ campaigns }) {
  const [hoveredSeg, setHoveredSeg] = useState(null);

  const counts = useMemo(() => {
    const active = campaigns.filter((c) => c.status === 'Active').length;
    const completed = campaigns.filter((c) => c.status === 'Completed').length;
    const scheduled = campaigns.filter((c) => c.status === 'Scheduled').length;
    // Scale proportionally when showing summary of 25 total campaigns
    const totalShown = active + completed + scheduled;
    if (totalShown <= 6) {
      return { active: 16, completed: 6, scheduled: 3, total: 25 };
    }
    return { active, completed, scheduled, total: totalShown };
  }, [campaigns]);

  const segments = [
    { key: 'Active', count: counts.active, color: 'bg-[#3B66F5]', dot: 'bg-[#3B66F5]' },
    { key: 'Completed', count: counts.completed, color: 'bg-[#A6BEFF]', dot: 'bg-[#A6BEFF]' },
    { key: 'Scheduled', count: counts.scheduled, color: 'bg-slate-200', dot: 'bg-slate-300' },
  ];

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-2">
        <span>{hoveredSeg ? `${hoveredSeg.key} campaigns` : 'Pipeline split'}</span>
        <span className="tabular-nums font-semibold text-slate-800">
          {hoveredSeg
            ? `${hoveredSeg.count} of ${counts.total} (${Math.round((hoveredSeg.count / counts.total) * 100)}%)`
            : `${Math.round((counts.active / counts.total) * 100)}% live`}
        </span>
      </div>

      <div className="h-3 w-full rounded-full bg-slate-100 p-0.5 flex gap-1 overflow-hidden">
        {segments.map((seg) => {
          const pct = (seg.count / counts.total) * 100;
          return (
            <Motion.div
              key={seg.key}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              onMouseEnter={() => setHoveredSeg(seg)}
              onMouseLeave={() => setHoveredSeg(null)}
              className={`h-full rounded-full ${seg.color} cursor-pointer transition-opacity ${
                hoveredSeg && hoveredSeg.key !== seg.key ? 'opacity-50' : 'opacity-100'
              }`}
              title={`${seg.key}: ${seg.count}`}
            />
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {segments.map((seg) => (
          <button
            key={seg.key}
            type="button"
            onMouseEnter={() => setHoveredSeg(seg)}
            onMouseLeave={() => setHoveredSeg(null)}
            className="text-left rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className={`w-2 h-2 rounded-full ${seg.dot}`} />
              <span>{seg.key}</span>
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{seg.count}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MessagesBarChart({ data, selectedMonth, onSelectMonth }) {
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);
  const activeKey = hoveredMonth || selectedMonth;
  const activeDatum = data.find((d) => d.month === activeKey) || data[8];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight">Messages by Month</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any month bar to inspect outbound volume
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-[#F3F5FA] px-3 py-1.5">
          <span className="text-xs font-medium text-slate-500">{activeDatum.month} 2026</span>
          <span className="text-sm font-bold text-slate-900 tabular-nums">
            {activeDatum.count.toLocaleString()}
          </span>
          <span className="text-[11px] font-semibold text-[#3B66F5] tabular-nums">
            {activeDatum.growth}
          </span>
        </div>
      </div>

      <div className="h-[176px] flex items-end justify-between gap-2 sm:gap-3 pt-4">
        {data.map((item, idx) => {
          const isHighlighted = item.month === selectedMonth;
          const isHovered = item.month === hoveredMonth;
          const heightPct = Math.max(14, Math.round((item.count / maxVal) * 100));
          // Alternate soft periwinkle shades cleanly while using vibrant royal blue (#3B66F5) for highlighted month
          const barColor = isHighlighted
            ? 'bg-[#3B66F5] shadow-[0_6px_18px_rgba(59,102,245,0.28)]'
            : idx % 2 === 0
              ? 'bg-[#A6BEFF] hover:bg-[#8DAEFF]'
              : 'bg-[#C4D5FF] hover:bg-[#9AB8FF]';

          return (
            <button
              key={item.month}
              type="button"
              onClick={() => onSelectMonth(item.month)}
              onMouseEnter={() => setHoveredMonth(item.month)}
              onMouseLeave={() => setHoveredMonth(null)}
              className="group flex-1 flex flex-col items-center h-full justify-end focus:outline-none"
              aria-label={`${item.month}: ${item.count.toLocaleString()} messages`}
            >
              <div className="relative w-full flex-1 flex items-end justify-center">
                {(isHovered || isHighlighted) && (
                  <Motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="hidden sm:block absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#18191C] px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums pointer-events-none"
                  >
                    {(item.count / 1000).toFixed(1)}k
                  </Motion.div>
                )}
                <Motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ duration: 0.45, delay: idx * 0.025, ease: 'easeOut' }}
                  className={`w-full max-w-[30px] rounded-t-lg transition-colors duration-150 ${barColor}`}
                />
              </div>
              <span
                className={`mt-2.5 text-[11px] font-medium transition-colors ${
                  isHighlighted ? 'text-[#3B66F5] font-semibold' : 'text-slate-400 group-hover:text-slate-700'
                }`}
              >
                {item.month}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ContactsEqualizer({ data }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const active = hoveredIdx !== null ? data[hoveredIdx] : data[6];

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-[11px] text-white/75 mb-2.5">
        <span>Daily net additions</span>
        <span className="tabular-nums font-semibold text-white">+{active.added} contacts</span>
      </div>
      <div className="flex items-end justify-between gap-1.5 h-16">
        {data.map((bar, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <button
              key={`${bar.label}-${idx}`}
              type="button"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              aria-label={`${bar.added} contacts added`}
              className="flex-1 h-full flex items-end justify-center cursor-pointer"
            >
              <Motion.span
                initial={{ height: 8 }}
                animate={{ height: `${bar.value}%` }}
                transition={{ duration: 0.45, delay: idx * 0.03 }}
                className={`w-full max-w-[10px] rounded-full transition-all duration-150 ${
                  isHovered ? 'bg-white scale-y-105' : idx % 3 === 0 ? 'bg-white/95' : 'bg-white/45'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TextsSentWave({ data }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const width = 260;
  const height = 66;
  const padX = 6;
  const padY = 10;

  const { coords, path } = useMemo(() => {
    const counts = data.map((d) => d.count);
    const min = Math.min(...counts) - 1200;
    const max = Math.max(...counts) + 1200;
    const span = max - min || 1;
    const mapped = data.map((d, idx) => ({
      x: padX + (idx / Math.max(data.length - 1, 1)) * (width - padX * 2),
      y: height - padY - ((d.count - min) / span) * (height - padY * 2),
      ...d,
    }));
    return { coords: mapped, path: buildSmoothPath(mapped) };
  }, [data]);

  const active = hoveredIdx !== null ? coords[hoveredIdx] : coords[coords.length - 1];

  return (
    <div className="mt-4 select-none">
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
        <span>{active.label} volume</span>
        <span className="tabular-nums font-semibold text-[#A6BEFF]">
          {active.count.toLocaleString()} msgs
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[66px] overflow-visible"
        onMouseLeave={() => setHoveredIdx(null)}
        aria-label="Texts sent wave chart"
      >
        <defs>
          <linearGradient id="darkWaveStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3B66F5" />
            <stop offset="55%" stopColor="#7C9BFF" />
            <stop offset="100%" stopColor="#A6BEFF" />
          </linearGradient>
          <linearGradient id="darkWaveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B66F5" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#18191C" stopOpacity="0" />
          </linearGradient>
          <filter id="waveGlow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={`${path} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`}
          fill="url(#darkWaveFill)"
        />
        <Motion.path
          d={path}
          fill="none"
          stroke="url(#darkWaveStroke)"
          strokeWidth="2.6"
          strokeLinecap="round"
          filter="url(#waveGlow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {coords.map((pt, idx) => {
          const isActive = (hoveredIdx ?? coords.length - 1) === idx;
          return (
            <g key={pt.label}>
              <rect
                x={pt.x - width / (coords.length * 2)}
                y={0}
                width={width / coords.length}
                height={height}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
              />
              {isActive && (
                <>
                  <circle cx={pt.x} cy={pt.y} r="6.5" fill="#A6BEFF" fillOpacity="0.22" />
                  <circle cx={pt.x} cy={pt.y} r="3.2" fill="#ffffff" stroke="#3B66F5" strokeWidth="1.8" />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
