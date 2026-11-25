// ============================================================
// Sistema de diseño — BRISEO ERP (Glassmorphism & Bento Grid)
// Tipografía: Plus Jakarta Sans + tabular-nums
// Paleta: Cool Gray (#F3F5FA), Dark Charcoal (#18191C), Royal Blue (#3B66F5), Periwinkle (#A6BEFF)
// ============================================================

export const paleta = {
  ink: '#0F172A',          // Texto principal
  inkSoft: '#334155',      // Texto secundario
  muted: '#64748B',        // Metadatos y subtítulos
  paper: '#F3F5FA',        // Fondo general cool-gray
  surface: '#FFFFFF',      // Superficies Bento blancas
  surfaceMuted: '#F3F5FA', // Fondos sutiles de inputs y tablas
  line: '#E5E7EB',         // Bordes ultra-limpios 1px
  lineStrong: '#CBD5E1',   // Bordes acentuados
  brand: '#3B66F5',        // Royal Blue primario
  brandDark: '#2563EB',    // Royal Blue hover
  brandSoft: '#EEF2FF',    // Tinte suave azul
  darkCard: '#18191C',     // Tarjeta oscura acento
  periwinkle: '#A6BEFF',   // Periwinkle secundario
  warn: '#B45309',         // Amber
  warnSoft: '#FEF3C7',
  danger: '#BE123C',       // Rose
  dangerSoft: '#FFE4E6',
  info: '#0369A1',
  infoSoft: '#E0F2FE',
  success: '#15803D',
  successSoft: '#DCFCE7',
  font: "'Plus Jakarta Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
  fontMono: "'Plus Jakarta Sans', 'IBM Plex Mono', ui-monospace, monospace",
}

// Paleta unificada por módulo (sobria: Charcoal #18191C & Royal Blue #3B66F5)
export const colores = {
  clientes:     { main: '#3B66F5', light: '#3B66F515', gradient: 'linear-gradient(135deg, #3B66F5 0%, #2952D9 100%)' },
  crm:          { main: '#3B66F5', light: '#3B66F515', gradient: 'linear-gradient(135deg, #18191C 0%, #272930 100%)' },
  contratos:    { main: '#18191C', light: '#18191C15', gradient: 'linear-gradient(135deg, #18191C 0%, #272930 100%)' },
  personal:     { main: '#3B66F5', light: '#3B66F515', gradient: 'linear-gradient(135deg, #18191C 0%, #272930 100%)' },
  agenda:       { main: '#3B66F5', light: '#3B66F515', gradient: 'linear-gradient(135deg, #3B66F5 0%, #2952D9 100%)' },
  presupuestos: { main: '#3B66F5', light: '#3B66F515', gradient: 'linear-gradient(135deg, #18191C 0%, #272930 100%)' },
  facturacion:  { main: '#3B66F5', light: '#3B66F515', gradient: 'linear-gradient(135deg, #3B66F5 0%, #2952D9 100%)' },
  insumos:      { main: '#18191C', light: '#18191C15', gradient: 'linear-gradient(135deg, #18191C 0%, #272930 100%)' },
  finanzas:     { main: '#3B66F5', light: '#3B66F515', gradient: 'linear-gradient(135deg, #18191C 0%, #272930 100%)' },
  costos:       { main: '#18191C', light: '#18191C15', gradient: 'linear-gradient(135deg, #18191C 0%, #272930 100%)' },
  sueldos:      { main: '#3B66F5', light: '#3B66F515', gradient: 'linear-gradient(135deg, #3B66F5 0%, #2952D9 100%)' },
  proveedores:  { main: '#18191C', light: '#18191C15', gradient: 'linear-gradient(135deg, #18191C 0%, #272930 100%)' },
  reportes:     { main: '#3B66F5', light: '#3B66F515', gradient: 'linear-gradient(135deg, #18191C 0%, #272930 100%)' },
  usuarios:     { main: '#18191C', light: '#18191C15', gradient: 'linear-gradient(135deg, #18191C 0%, #272930 100%)' },
  danger:       { main: '#BE123C', light: '#FFE4E6', gradient: '#BE123C' },
  warning:      { main: '#B45309', light: '#FEF3C7', gradient: '#B45309' },
  info:         { main: '#3B66F5', light: '#EEF2FF', gradient: '#3B66F5' },
}

export const s = {
  cabecera: (fondo) => ({
    background: fondo || 'linear-gradient(135deg, #18191C 0%, #272930 100%)',
    borderRadius: '20px',
    padding: '20px 24px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    boxShadow: '0 12px 32px -12px rgba(24, 25, 28, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.14)'
  }),
  cabeceraTexto: {
    color: '#FFFFFF',
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '-0.02em',
    lineHeight: '1.2'
  },
  cabeceraSubtexto: {
    color: 'rgba(255, 255, 255, 0.78)',
    margin: '4px 0 0',
    fontSize: '12.5px',
    fontWeight: '400'
  },

  btnPrimario: (color) => ({
    background: color || '#3B66F5',
    color: '#FFFFFF',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '999px',
    padding: '8px 18px',
    fontWeight: '600',
    fontSize: '12.5px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    boxShadow: '0 6px 16px -6px rgba(59, 102, 245, 0.45)'
  }),
  btnSecundario: {
    background: '#FFFFFF',
    color: '#334155',
    border: '1px solid #E5E7EB',
    borderRadius: '999px',
    padding: '8px 16px',
    fontWeight: '600',
    fontSize: '12.5px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
  },
  btnPeligro: {
    background: '#FFF1F2',
    color: '#BE123C',
    border: '1px solid #FECDD3',
    borderRadius: '999px',
    padding: '6px 13px',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },

  card: {
    background: '#FFFFFF',
    borderRadius: '20px',
    padding: '22px',
    marginBottom: '18px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
    border: '1px solid #E5E7EB'
  },
  label: {
    display: 'block',
    color: '#334155',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '5px',
    letterSpacing: '-0.01em'
  },
  input: {
    width: '100%',
    padding: '9px 13px',
    boxSizing: 'border-box',
    background: '#F3F5FA',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    color: '#0F172A',
    fontSize: '13.5px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif"
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '14px'
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px'
  },

  tabla: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0',
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums'
  },
  tablaCabecera: () => ({
    background: '#F3F5FA',
    color: '#475569',
    padding: '10px 14px',
    textAlign: 'left',
    fontWeight: '700',
    fontSize: '11px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    borderBottom: '1px solid #E5E7EB'
  }),
  tablaFila: (i) => ({
    background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFD',
    transition: 'background 0.12s ease'
  }),
  tablaCell: {
    padding: '11px 14px',
    color: '#334155',
    borderBottom: '1px solid #F1F5F9',
    fontSize: '13px'
  },
  tablaCellBold: {
    padding: '11px 14px',
    color: '#0F172A',
    fontWeight: '600',
    borderBottom: '1px solid #F1F5F9',
    fontSize: '13px'
  },

  badge: (bg, color) => ({
    background: bg || '#F3F5FA',
    color: color || '#334155',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    letterSpacing: '0.01em'
  }),

  buscador: {
    width: '100%',
    maxWidth: '340px',
    padding: '8px 15px',
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '999px',
    fontSize: '13px',
    outline: 'none',
    color: '#0F172A',
    fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
    transition: 'border-color 0.15s, box-shadow 0.15s'
  },

  empty: {
    padding: '56px 20px',
    textAlign: 'center',
    color: '#64748B',
    fontSize: '13.5px'
  }
}
