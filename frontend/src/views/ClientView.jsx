import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowRight, Calendar, Gauge, Car, Camera, ShieldCheck, CheckCircle2, Users } from 'lucide-react';
import { API_URL, getPicoYPlaca } from '../api';

const fmt = (n) => '$' + (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

const SHOP = {
  name: 'Automotriz Online SD',
  phone: '301 469 7942',
  city: 'Cali, Valle',
  website: 'www.automotrizonlinesd.com',
};

const STATUS_STYLES = {
  'Recepción':        { label: 'Recepción',          bg: 'rgba(124,127,245,.16)', fg: '#b7b9fc' },
  'Proceso':          { label: 'En Proceso',         bg: 'rgba(245,185,66,.16)',  fg: '#f7c565' },
  'Calidad':          { label: 'Control de Calidad', bg: 'rgba(61,220,151,.16)',  fg: '#6be3ac' },
  'Ingresos Rápidos': { label: 'Ingreso Rápido',      bg: 'rgba(124,127,245,.16)', fg: '#b7b9fc' },
  'Entregado':        { label: 'Entregado',          bg: 'rgba(139,147,167,.18)', fg: '#b3b9c9' },
};
const statusOf = (estado) => STATUS_STYLES[estado] || STATUS_STYLES['Recepción'];
const stateColor = { Bueno: '#6be3ac', Regular: '#f7c565', Malo: '#ff8b8b' };

const card = { background: '#131a2c', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: 20 };
const sectionLabel = { fontSize: 12.5, fontWeight: 800, letterSpacing: '.08em', color: '#8992a8', textTransform: 'uppercase' };
const footerStyle = { marginTop: 'auto', padding: '22px 20px 30px', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', textAlign: 'center' };

function Footer() {
  return (
    <div style={footerStyle}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#c7cbdb' }}>{SHOP.name}</div>
      <div style={{ fontSize: 12, color: '#7a8296' }}>{SHOP.city} · {SHOP.phone}</div>
      <div style={{ fontSize: 12, color: '#7a8296' }}>{SHOP.website}</div>
    </div>
  );
}

function BackBar({ label, onClick }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(10,14,24,.85)', backdropFilter: 'blur(14px)' }}>
      <button type="button" onClick={onClick}
        style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, background: 'transparent', border: 'none', color: '#f4f6fb', cursor: 'pointer', padding: '0 8px 0 4px', borderRadius: 10 }}>
        <ChevronLeft size={20} strokeWidth={2.2} />
        <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
      </button>
    </div>
  );
}

export default function ClientView() {
  const [screen, setScreen] = useState('search'); // search | results | detail
  const [query, setQuery] = useState('');
  const [placa, setPlaca] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [networkError, setNetworkError] = useState(false);
  const [loading, setLoading] = useState(false);

  const normalizePlate = (v) => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  const submitSearch = async (e) => {
    e.preventDefault();
    const p = normalizePlate(query);
    if (!p || loading) return;
    setLoading(true); setNetworkError(false);
    try {
      const res = await fetch(`${API_URL}/orders?placa=${p}&_embed=reports&_embed=quotes`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
      setPlaca(p);
      setScreen('results');
    } catch {
      setOrders([]);
      setPlaca(p);
      setNetworkError(true);
      setScreen('results');
    } finally {
      setLoading(false);
    }
  };

  const selectOrder = (o) => { setSelectedOrder(o); setScreen('detail'); };
  const backToResults = () => { setSelectedOrder(null); setScreen('results'); };
  const backToSearch = () => { setScreen('search'); setQuery(''); setPlaca(''); setOrders([]); setSelectedOrder(null); setNetworkError(false); };

  const wrapperStyle = {
    width: '100%', minHeight: '100vh', background: '#0a0e18', display: 'flex', justifyContent: 'center',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif", color: '#f4f6fb', WebkitFontSmoothing: 'antialiased',
  };
  const columnStyle = { width: '100%', maxWidth: 480, minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' };

  // ── Pantalla de búsqueda ──────────────────────────────────────────
  if (screen === 'search') {
    return (
      <div style={wrapperStyle}>
        <div style={columnStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 20px 0' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#6d70f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#fff', flexShrink: 0 }}>
                {SHOP.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: '#f4f6fb', lineHeight: 1.25 }}>{SHOP.name}</div>
                <div style={{ fontSize: 12.5, color: '#8992a8', marginTop: 1 }}>Taller automotriz · {SHOP.city}</div>
              </div>
            </div>

            <div style={{ padding: '36px 22px 4px' }}>
              <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 10px', lineHeight: 1.25 }}>Consulta el estado de tu vehículo</h1>
              <p style={{ fontSize: 14.5, color: '#9aa3b8', margin: 0, lineHeight: 1.55 }}>Ingresa el número de placa para ver en qué va el servicio de tu carro en el taller.</p>
            </div>

            <div style={{ padding: '24px 22px 0' }}>
              <form onSubmit={submitSearch} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#131a2c', border: '1px solid rgba(255,255,255,.09)', borderRadius: 18, padding: '6px 8px 6px 18px' }}>
                <Search size={19} color="#6b7488" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value.toUpperCase())}
                  placeholder="AAA123"
                  autoFocus
                  style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#f4f6fb', fontSize: 19, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '10px 0', fontFamily: 'inherit' }}
                />
                <button type="submit" disabled={loading}
                  style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: '#6d70f2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'default' : 'pointer', flexShrink: 0, opacity: normalizePlate(query) ? 1 : 0.45 }}>
                  <ArrowRight size={19} strokeWidth={2.2} />
                </button>
              </form>
              {loading && <p style={{ fontSize: 12.5, color: '#6b7488', marginTop: 10 }}>Buscando...</p>}
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', margin: '32px 22px 0', padding: '22px 2px', borderTop: '1px solid rgba(255,255,255,.08)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 9, padding: '0 6px' }}>
                <ShieldCheck size={20} strokeWidth={1.8} color="#8992a8" />
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#dfe2ee', lineHeight: 1.35 }}>Amplia garantía</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,.08)' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 9, padding: '0 6px' }}>
                <CheckCircle2 size={20} strokeWidth={1.8} color="#8992a8" />
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#dfe2ee', lineHeight: 1.35 }}>Técnicos certificados</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,.08)' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 9, padding: '0 6px' }}>
                <Users size={20} strokeWidth={1.8} color="#8992a8" />
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#dfe2ee', lineHeight: 1.35 }}>+1.200 vehículos atendidos</div>
              </div>
            </div>

            <Footer />
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla de resultados ────────────────────────────────────────
  if (screen === 'results') {
    const hasResults = orders.length > 0;
    return (
      <div style={wrapperStyle}>
        <div style={columnStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <BackBar label="Buscar otra placa" onClick={backToSearch} />

            <div style={{ padding: '22px 20px 6px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.09em', color: '#6b7488', textTransform: 'uppercase' }}>Resultados para</div>
              <h1 style={{ fontSize: 31, fontWeight: 800, letterSpacing: '-.02em', margin: '5px 0 4px' }}>{placa}</h1>
              <div style={{ fontSize: 14, color: '#9aa3b8' }}>
                {hasResults ? `${orders.length} orden${orders.length !== 1 ? 'es' : ''} encontrada${orders.length !== 1 ? 's' : ''}` : ' '}
              </div>
            </div>

            {hasResults ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 20px 20px' }}>
                {orders.map(o => {
                  const st = statusOf(o.estado);
                  const fechaLarga = o.fecha ? new Date(o.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';
                  const summary = o.servicios ? (o.servicios.length > 55 ? o.servicios.slice(0, 55) + '...' : o.servicios) : (o.notas || 'Sin descripción');
                  return (
                    <div key={o.id} onClick={() => selectOrder(o)}
                      style={{ display: 'flex', gap: 14, background: '#131a2c', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, padding: 16, cursor: 'pointer' }}>
                      <div style={{ width: 46, height: 46, borderRadius: 13, background: st.bg, color: st.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Car size={22} strokeWidth={1.8} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 15.5, fontWeight: 700, color: '#f4f6fb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.marca} {o.modelo} {o.anio}</span>
                          <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 999, background: st.bg, color: st.fg }}>{st.label}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#9aa3b8', marginTop: 5 }}>Ingreso: {fechaLarga}</div>
                        <div style={{ fontSize: 12.5, color: '#6b7488', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</div>
                      </div>
                      <ChevronRight size={18} color="#4a536b" strokeWidth={2.2} style={{ flexShrink: 0, alignSelf: 'center' }} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 32px', gap: 14 }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: '#131a2c', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={28} color="#6b7488" strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f4f6fb' }}>
                  {networkError ? 'Error de conexión' : 'No encontramos órdenes'}
                </div>
                <div style={{ fontSize: 13.5, color: '#8992a8', lineHeight: 1.5, maxWidth: 280 }}>
                  {networkError
                    ? 'No pudimos conectar con el servidor. Intenta de nuevo en un momento.'
                    : `No hay resultados para la placa "${placa}". Verifica el número e intenta de nuevo.`}
                </div>
              </div>
            )}

            <Footer />
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla de detalle ───────────────────────────────────────────
  const order = selectedOrder;
  // Usa siempre el reporte/cotización más reciente por fecha, no el primero del arreglo
  // (una orden puede acumular más de uno si se subió/guardó varias veces).
  const report = (order?.reports || []).slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
  const quote = (order?.quotes || []).slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
  const totals = quote?.items?.reduce((acc, it) => {
    const lt = (parseFloat(it.precio) || 0) * (parseFloat(it.cantidad) || 0);
    acc.sub += lt;
    if (it.aplicaIva) acc.iva += lt * 0.19;
    return acc;
  }, { sub: 0, iva: 0 }) || { sub: 0, iva: 0 };
  const st = statusOf(order.estado);
  const dateShort = order.fecha ? new Date(order.fecha).toLocaleDateString('es-CO') : 'N/A';
  const kmText = order.kilometraje ? `${(parseFloat(order.kilometraje) || 0).toLocaleString('es-CO')} km` : 'N/A';
  const picoPlaca = getPicoYPlaca(order.placa);
  const badItems = report?.items?.filter(it => it.state !== 'Bueno') || [];
  const orderNo = `ORD-${String(order.id).substring(0, 8).toUpperCase()}`;

  return (<>
    <div style={wrapperStyle}>
      <div style={columnStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <BackBar label="Ver todas las órdenes" onClick={backToResults} />

          <div style={{ padding: '18px 20px 0' }}>
            <div style={{ borderRadius: 18, padding: 20, background: '#10141f', border: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#6b7488', textTransform: 'uppercase', marginBottom: 5 }}>Orden N.° {orderNo}</div>
                  <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>{order.placa}</h1>
                  <div style={{ fontSize: 15, color: '#aab1c9', marginTop: 4 }}>{order.marca} {order.modelo} {order.anio}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 999, background: st.bg, color: st.fg }}>{st.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,.09)', borderRadius: 10, padding: '7px 11px', fontSize: 12.5, color: '#c7cbdb' }}>
                  <Calendar size={14} strokeWidth={2} />{dateShort}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,.09)', borderRadius: 10, padding: '7px 11px', fontSize: 12.5, color: '#c7cbdb' }}>
                  <Gauge size={14} strokeWidth={2} />{kmText}
                </div>
              </div>
            </div>
          </div>

          {order.fotos?.length > 0 && (
            <div style={{ padding: '16px 20px 0' }}>
              <div style={card}>
                <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 14, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                  <Camera size={13} /> Fotos de Recepción
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                  {order.fotos.map((src, i) => (
                    <img key={i} src={src} alt={`foto-${i}`} onClick={() => setLightboxSrc(src)}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: '16px 20px 0' }}>
            <div style={card}>
              <div style={{ ...sectionLabel, paddingBottom: 14, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,.07)' }}>Datos del vehículo</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 20, columnGap: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: '#6b7488', textTransform: 'uppercase' }}>Placa</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f4f6fb', marginTop: 4 }}>{order.placa}</div>
                  {picoPlaca && <div style={{ fontSize: 11.5, fontWeight: 800, color: '#f7c565', marginTop: 3 }}>⚠️ {picoPlaca}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: '#6b7488', textTransform: 'uppercase' }}>Marca</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f4f6fb', marginTop: 4 }}>{order.marca}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: '#6b7488', textTransform: 'uppercase' }}>Modelo</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f4f6fb', marginTop: 4 }}>{order.modelo}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: '#6b7488', textTransform: 'uppercase' }}>Año</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f4f6fb', marginTop: 4 }}>{order.anio}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: '#6b7488', textTransform: 'uppercase' }}>Kilometraje</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f4f6fb', marginTop: 4 }}>{kmText}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: '#6b7488', textTransform: 'uppercase' }}>Fecha ingreso</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f4f6fb', marginTop: 4 }}>{dateShort}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: '#6b7488', textTransform: 'uppercase' }}>Estado</div>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', padding: '5px 11px', borderRadius: 999, background: st.bg, color: st.fg }}>{st.label}</span>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: '#6b7488', textTransform: 'uppercase' }}>Servicios a realizar</div>
                  {order.servicios ? (
                    <span style={{ display: 'inline-block', marginTop: 7, fontSize: 13, fontWeight: 600, color: '#b7b9fc', background: 'rgba(124,127,245,.14)', borderRadius: 8, padding: '6px 10px' }}>{order.servicios}</span>
                  ) : (
                    <div style={{ fontSize: 14.5, color: '#8992a8', marginTop: 4 }}>Ninguno</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: '#6b7488', textTransform: 'uppercase' }}>Notas / observaciones</div>
                  <div style={{ fontSize: 14, color: '#c7cbdb', lineHeight: 1.55, marginTop: 5 }}>{order.notas || 'Sin observaciones'}</div>
                </div>
              </div>
            </div>
          </div>

          {report && (
            <div style={{ padding: '16px 20px 0' }}>
              <div style={card}>
                <div style={{ paddingBottom: 14, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                  <div style={sectionLabel}>Reporte de Inspección</div>
                  <div style={{ fontSize: 12.5, color: '#6b7488', marginTop: 4 }}>Diagnóstico general de tu vehículo (sin incluir precios)</div>
                </div>
                {badItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                    {badItems.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,.04)', borderRadius: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{it.item}</span>
                          <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7488' }}>{it.category}</span>
                        </div>
                        <span style={{ flexShrink: 0, color: stateColor[it.state] || '#c7cbdb', fontWeight: 700, fontSize: 12.5 }}>
                          {it.state || (it.category === 'Insumos' ? 'Necesario' : it.category === 'Servicios Especializados' ? 'Realizar' : '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#6be3ac', fontSize: 14, marginTop: 14 }}>✓ Todo en buen estado según la revisión.</p>
                )}
                {report.scannerCodes?.filter(c => c.code).length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7488', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Códigos de escáner</p>
                    {report.scannerCodes.filter(c => c.code).map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'rgba(255,139,139,.08)', border: '1px solid rgba(255,139,139,.2)', borderRadius: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#ff8b8b' }}>{c.prefix}{c.code}</span>
                        <span style={{ color: '#9aa3b8', fontSize: 13 }}>{c.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {quote?.items?.length > 0 && (
            <div style={{ padding: '16px 20px 0' }}>
              <div style={card}>
                <div style={{ paddingBottom: 14, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                  <div style={sectionLabel}>Cotización de servicios</div>
                  <div style={{ fontSize: 12.5, color: '#6b7488', marginTop: 4 }}>Detalle de repuestos y mano de obra autorizados</div>
                </div>

                {quote.items.map((it, i) => {
                  const lt = (parseFloat(it.precio) || 0) * (parseFloat(it.cantidad) || 0);
                  const t = it.aplicaIva ? lt * 1.19 : lt;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#eef0f7', lineHeight: 1.4 }}>{it.descripcion || '—'}</div>
                        <div style={{ fontSize: 12, color: '#6b7488', marginTop: 3 }}>{it.cantidad} × {fmt(it.precio)}</div>
                      </div>
                      <div style={{ flexShrink: 0, fontSize: 14, fontWeight: 700, color: '#f4f6fb' }}>{fmt(t)}</div>
                    </div>
                  );
                })}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.09)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#9aa3b8' }}>
                    <span>Subtotal</span><span style={{ color: '#dfe2ee' }}>{fmt(totals.sub)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#9aa3b8' }}>
                    <span>IVA (19%)</span><span style={{ color: '#dfe2ee' }}>{fmt(totals.iva)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.09)' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f4f6fb' }}>Total</span>
                    <span style={{ fontSize: 25, fontWeight: 800, color: '#9a9dfc' }}>{fmt(totals.sub + totals.iva)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(61,220,151,.08)', border: '1px solid rgba(61,220,151,.18)' }}>
                  <ShieldCheck size={16} strokeWidth={2} color="#6be3ac" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: '#a9ecc9', fontWeight: 600, lineHeight: 1.4 }}>Repuestos y mano de obra con amplia garantía</span>
                </div>
                <div style={{ fontSize: 11, color: '#5b6478', textAlign: 'center', marginTop: 12 }}>Valores expresados en pesos colombianos (COP)</div>
              </div>
            </div>
          )}

          <div style={{ ...footerStyle, marginTop: 24, padding: '22px 20px 34px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#c7cbdb' }}>{SHOP.name}</div>
            <div style={{ fontSize: 12, color: '#7a8296' }}>{SHOP.city} · {SHOP.phone}</div>
            <div style={{ fontSize: 12, color: '#7a8296' }}>{SHOP.website}</div>
          </div>
        </div>
      </div>
    </div>

    {lightboxSrc && (
      <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
        <button onClick={() => setLightboxSrc(null)}
          style={{ position: 'fixed', top: '1rem', right: '1.5rem', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', color: 'white', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          ×
        </button>
        <img src={lightboxSrc} alt="foto ampliada" onClick={e => e.stopPropagation()} />
      </div>
    )}
  </>);
}
