import React, { useState, useEffect, useContext } from 'react';
import { API_URL, getPicoYPlaca } from '../api';
import { ThemeContext } from '../App';
import PhotoUploadModal from './PhotoUploadModal';
import { 
  Wrench, 
  Car, 
  ChevronRight, 
  ClipboardList, 
  ArrowLeft, 
  PlusCircle, 
  SendHorizonal, 
  Camera,
  AlertTriangle,
  Info,
  Search,
  History,
  CheckCircle
} from 'lucide-react';

const fmt = (n) => {
  if (n === null || n === undefined || n === '') return '';
  const num = parseFloat(n.toString().replace(/\D/g, '')) || 0;
  return num.toLocaleString('es-CO', { minimumFractionDigits: 0 });
};

const REVISION_CATEGORIES = {
  "Suspensión": ["Amortiguadores Del.", "Amortiguadores Tras.", "Bujes de Tijera", "Tijeras", "Lágrimas", "Soporte de Amortiguadores", "Bujes Barra Estabilizadora", "Soportes de Motor", "Rótulas"],
  "Frenos": ["Pastillas Del.", "Pastillas Tras.", "Discos Del.", "Discos Tras.", "Líquido de Frenos", "Freno de Mano", "Mangueras de Freno", "Bomba de Freno", "Cilindro de Freno", "Campanas Traseras", "Bandas Traseras"],
  "Dirección": ["Caja de Dirección", "Terminales", "Axiales", "Bomba de Dirección", "Aceite Hidráulico", "Holgura Volante"],
  "Transmisión": ["Puntas", "Cardán", "Embrague", "Empaque Caja de Cambios", "Guardapolvos"],
  "Fugas": ["Fuga Aceite Motor", "Fuga Transmisión", "Fuga Dirección", "Fuga Refrigerante", "Fuga Combustible", "Fuga Frenos"],
  "Batería / Eléctrico": ["Batería", "Alternador", "Motor de Arranque"],
  "Chequeo Visual Motor": ["Correa Distribución", "Correa Accesorios", "Aceite Motor", "Cableado Visible", "Empaque tapavalvulas", "Empaque de Carter", "Reten Delantero Cigueñal", "Reten Trasero Cigueñal", "Tapacadena", "Sensor"],
  "Niveles": ["Aceite Motor", "Líquido Frenos", "Líquido Dirección", "Refrigerante", "Agua Limpiaparabrisas"],
  "Otros": ["Luces", "Limpiaparabrisas", "Pito", "Espejos", "Vidrios", "Tapicería", "Llantas (Estado)", "Llantas (Presión)"],
  "Insumos": ["Silicona", "Utiles de Aseo", "Prensa", "Pegante Shellac", "Cableado / Conexiones Electricas"],
  "Servicios Especializados": ["Diagnostico Profundo en", "Sincronizacion", "Mantenimiento de Frenos", "Escaner / Calibracion"]
};

const DIAGNOSTICO_AREAS = ["Suspensión", "Frenos", "Motor", "Caja de Cambios", "Clutch / Embrague", "Sistema de Refrigeración", "Inyección", "Sistema Eléctrico"];

export default function TechnicianView() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reportData, setReportData] = useState({});
  const [scannerCodes, setScannerCodes] = useState([{ prefix: 'P', code: '', description: '' }]);
  const [precioDiagnostico, setPrecioDiagnostico] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [showChecklist, setShowChecklist] = useState(null);
  const [checklist, setChecklist] = useState({ pruebaRuta: false, limpio: false, herramientas: false });
  
  const [activeTab, setActiveTab] = useState('Pendientes');
  const [pastReports, setPastReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingPastReport, setViewingPastReport] = useState(null);

  const fetchOrders = () => {
    setLoading(true);
    fetch(`${API_URL}/orders?_embed=quotes`)
      .then(res => res.json())
      .then(data => { 
        setOrders(data.filter(o => o.estado !== 'Entregado')); 
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  };

  const fetchPastReports = () => {
    fetch(`${API_URL}/reports?_expand=order&_sort=fecha&_order=desc`)
      .then(res => res.json())
      .then(data => setPastReports(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchOrders();
    fetchPastReports();
  }, []);

  const handleItemStateChange = (category, item, state) => {
    setReportData(prev => {
      const key = `${category}-${item}`;
      const current = prev[key] || {};
      if (current.state === state) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { 
        ...prev, 
        [key]: { ...current, state, category, item, requiereRepuesto: state === 'Malo' ? true : current.requiereRepuesto } 
      };
    });
  };

  const handleDetail = (category, item, field, value) => {
    setReportData(prev => ({
      ...prev,
      [`${category}-${item}`]: { ...prev[`${category}-${item}`], [field]: value }
    }));
  };

  const submitReport = async () => {
    const items = Object.values(reportData);
    const validCodes = scannerCodes.filter(c => c.code.length > 0);
    const payload = {
      orderId: selectedOrder.id,
      items,
      scannerCodes: validCodes,
      precioDiagnostico: validCodes.length > 0 ? (parseFloat(precioDiagnostico.replace(/\D/g,'')) || 0) : 0,
      fecha: new Date().toISOString()
    };
    try {
      await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setStatusMsg({ text: '✓ Reporte subido exitosamente', type: 'success' });
      setTimeout(() => { 
        setSelectedOrder(null); 
        setReportData({}); 
        setScannerCodes([{ prefix: 'P', code: '', description: '' }]); 
        setPrecioDiagnostico(''); 
        setStatusMsg({ text: '', type: '' }); 
        fetchOrders();
        fetchPastReports();
      }, 2000);
    } catch (e) { setStatusMsg({ text: '✗ Error al subir el reporte', type: 'error' }); }
  };

  const confirmFinishWork = async () => {
    const orderId = showChecklist;
    try {
      await fetch(`${API_URL}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          estado: 'Calidad',
          checklistFinal: { ...checklist, fecha: new Date().toISOString() }
        })
      });
      setShowChecklist(null);
      setChecklist({ pruebaRuta: false, limpio: false, herramientas: false });
      fetchOrders();
      setStatusMsg({ text: '✓ Trabajo terminado y verificado. Pasado a Calidad.', type: 'success' });
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
    } catch (e) { console.error(e); }
  };

  const pendingOrders = orders.filter(o => o.estado !== 'Proceso' && o.estado !== 'Calidad');
  const authorizedOrders = orders.filter(o => o.estado === 'Proceso' && o.quotes?.some(q => q.autorizada));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      
      {selectedOrder ? (
        <div style={{ paddingBottom: '2rem' }}>
          <div className="tech-header">
            <button className="btn-secondary" onClick={() => setSelectedOrder(null)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.95rem' }}>
              <ArrowLeft size={16} /> Volver
            </button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 900, fontSize: '1.2rem', lineHeight: 1 }}>{selectedOrder.placa}</div>
              <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{selectedOrder.marca} {selectedOrder.modelo}</div>
            </div>
            <button className="btn-success" onClick={submitReport} style={{ padding: '0.4rem 0.8rem', fontSize: '0.95rem' }}>
              <SendHorizonal size={16} /> Enviar
            </button>
          </div>

          <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem' }}>
            {statusMsg.text && <div className={`toast toast-${statusMsg.type}`} style={{ marginBottom: '1rem' }}>{statusMsg.text}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {selectedOrder.kilometraje && (
                <div className="card" style={{ padding: '0.75rem', borderLeft: '4px solid #3b82f6', marginBottom: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase' }}>KM</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{fmt(selectedOrder.kilometraje)}</div>
                </div>
              )}
              {selectedOrder.notas && (
                <div className="card" style={{ padding: '0.75rem', borderLeft: '4px solid var(--warning)', marginBottom: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--warning)', textTransform: 'uppercase' }}>Notas</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedOrder.notas}</div>
                </div>
              )}
            </div>

            {selectedOrder.servicios && (
              <div className="card" style={{ borderLeft: '4px solid var(--primary)', padding: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Servicios Solicitados</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedOrder.servicios}</div>
              </div>
            )}

            {Object.entries(REVISION_CATEGORIES).map(([category, items]) => (
              <div key={category} className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>{category}</h3>
                {items.map(item => {
                  const key = `${category}-${item}`;
                  const data = reportData[key];

                  if (category === 'Insumos') {
                    const isSelected = data?.state === 'Necesario';
                    return (
                      <div key={item} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', flex: 1 }}>
                            <input type="checkbox" checked={isSelected} onChange={e => handleItemStateChange(category, item, e.target.checked ? 'Necesario' : null)} style={{ width: 18, height: 18 }} />
                            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{item}</span>
                          </label>
                          {isSelected && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>CANT:</span>
                              <input type="number" min="1" style={{ width: 60, padding: '0.3rem', textAlign: 'center' }} value={data?.cantidad || 1} onChange={e => handleDetail(category, item, 'cantidad', parseInt(e.target.value) || 1)} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (category === 'Servicios Especializados') {
                    const isSelected = data?.state === 'Realizar';
                    const isDiagnostico = item === 'Diagnostico Profundo en';
                    return (
                      <div key={item} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={isSelected} onChange={e => handleItemStateChange(category, item, e.target.checked ? 'Realizar' : null)} style={{ width: 18, height: 18 }} />
                            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{item}</span>
                          </label>
                          {isSelected && isDiagnostico && (
                            <select value={data?.area || ''} onChange={e => handleDetail(category, item, 'area', e.target.value)} style={{ padding: '0.3rem', fontSize: '0.85rem', borderRadius: 6, flex: 1, minWidth: 120 }}>
                              <option value="">-- Seleccionar Área --</option>
                              {DIAGNOSTICO_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                          )}
                          {isSelected && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>VALOR ($):</span>
                              <input type="text" className="price-input" style={{ width: 110, padding: '0.3rem' }} value={data?.manoObra ? fmt(data.manoObra) : ''} onChange={e => handleDetail(category, item, 'manoObra', e.target.value.replace(/\D/g, ''))} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const isGood = data?.state === 'Bueno';
                  const isWarn = data?.state === 'Regular';
                  const isBad = data?.state === 'Malo';
                  return (
                    <div key={item} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{item}</span>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button type="button" className={isGood ? 'state-btn good' : 'state-btn'} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }} onClick={() => handleItemStateChange(category, item, 'Bueno')}>Bueno</button>
                          <button type="button" className={isWarn ? 'state-btn warn' : 'state-btn'} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }} onClick={() => handleItemStateChange(category, item, 'Regular')}>Regular</button>
                          <button type="button" className={isBad ? 'state-btn bad' : 'state-btn'} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }} onClick={() => handleItemStateChange(category, item, 'Malo')}>Malo</button>
                        </div>
                      </div>
                      {(isWarn || isBad) && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg)', borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Mano de Obra ($):<input type="text" className="price-input" value={data?.manoObra ? fmt(data.manoObra) : ''} onChange={e => handleDetail(category, item, 'manoObra', e.target.value.replace(/\D/g, ''))} /></label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', fontWeight: 600 }}><input type="checkbox" checked={data?.requiereRepuesto || false} onChange={e => handleDetail(category, item, 'requiereRepuesto', e.target.checked)} />Repuesto</label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', fontWeight: 600 }}><input type="checkbox" checked={data?.recibeReparacion || false} onChange={e => handleDetail(category, item, 'recibeReparacion', e.target.checked)} />Reparación</label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="card" style={{ padding: '1rem' }}>
              <h3 className="section-title" style={{ fontSize: '0.8rem' }}>Escáner DTC</h3>
              {scannerCodes.map((code, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
                  <select value={code.prefix} style={{ width: 50, padding: '0.3rem' }} onChange={e => { const n = [...scannerCodes]; n[index].prefix = e.target.value; setScannerCodes(n); }}>{['P','B','C','U'].map(l => <option key={l} value={l}>{l}</option>)}</select>
                  <input type="text" maxLength={4} placeholder="0000" style={{ width: 70, fontWeight: 800, textAlign: 'center', padding: '0.3rem' }} value={code.code} onChange={e => { const v = e.target.value.replace(/\D/g,''); const n=[...scannerCodes]; n[index].code=v; setScannerCodes(n); }} />
                  <input type="text" placeholder="Falla" style={{ flex: 1, padding: '0.3rem' }} value={code.description} onChange={e => { const n=[...scannerCodes]; n[index].description=e.target.value; setScannerCodes(n); }} />
                </div>
              ))}
              <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.4rem' }} onClick={() => setScannerCodes([...scannerCodes, { prefix: 'P', code: '', description: '' }])}>+ DTC</button>
            </div>

            <button className="btn-success" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 900, marginTop: '1.5rem', borderRadius: 12, display: 'block' }} onClick={submitReport}>SUBIR REVISIÓN</button>
          </div>
        </div>
      ) : viewingPastReport ? (
        <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
          <button className="btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => setViewingPastReport(null)}>
            <ArrowLeft size={16} /> Volver al Historial
          </button>
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Reporte Técnico</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(viewingPastReport.fecha).toLocaleString('es-CO')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vehículo</span>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{viewingPastReport.order?.placa}</div>
                <div style={{ fontSize: '0.9rem' }}>{viewingPastReport.order?.marca} {viewingPastReport.order?.modelo}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cliente</span>
                <div style={{ fontWeight: 600 }}>{viewingPastReport.order?.cliente}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {Object.entries(viewingPastReport.items.reduce((acc, it) => { if (!acc[it.category]) acc[it.category] = []; acc[it.category].push(it); return acc; }, {})).map(([cat, items]) => (
              <div key={cat} className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{cat}</h3>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {items.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <div><div style={{ fontWeight: 600 }}>{it.item} {it.area && <span style={{ color: 'var(--primary)' }}>({it.area})</span>}</div>{it.cantidad && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cantidad: {it.cantidad}</div>}</div>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: it.state === 'Bueno' ? 'var(--success)' : it.state === 'Malo' ? 'var(--error)' : 'var(--warning)' }}>{it.state?.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {viewingPastReport.scannerCodes?.length > 0 && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '1rem' }}>Códigos de Escáner</h3>
                {viewingPastReport.scannerCodes.map((c, i) => (
                  <div key={i} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                    <strong>{c.prefix}{c.code}:</strong> {c.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="tech-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <Wrench size={18} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, lineHeight: 1 }}>Panel Técnico</h1>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{orders.length} vehículos en taller</p>
              </div>
            </div>
            <div className="tech-header-actions">
              <button onClick={toggleTheme} className="theme-toggle" title="Cambiar tema" />
              <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '1rem' }} onClick={() => setShowPhotoUpload(true)}>
                <Camera size={14} /> Foto
              </button>
            </div>
          </div>

          <div style={{ padding: '1rem', maxWidth: 1600, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--card-bg)', padding: '0.3rem', borderRadius: 10, border: '1px solid var(--border)', maxWidth: 400 }}>
              <button onClick={() => setActiveTab('Pendientes')} style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', background: activeTab === 'Pendientes' ? 'var(--primary)' : 'transparent', color: activeTab === 'Pendientes' ? 'white' : 'var(--text-muted)', transition: '0.2s' }}>Pendientes</button>
              <button onClick={() => setActiveTab('Historial')} style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', background: activeTab === 'Historial' ? 'var(--primary)' : 'transparent', color: activeTab === 'Historial' ? 'white' : 'var(--text-muted)', transition: '0.2s' }}>Historial</button>
            </div>

            {statusMsg.text && <div className={`toast toast-${statusMsg.type}`} style={{ marginBottom: '1.5rem' }}>{statusMsg.text}</div>}

            {activeTab === 'Pendientes' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertTriangle size={14} color="var(--warning)" /> Revision Pendiente ({pendingOrders.length})</h2>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {pendingOrders.map(o => (
                      <div key={o.id} className="card card-hover" style={{ cursor: 'pointer', padding: '1.25rem', borderLeft: '4px solid var(--primary)' }} onClick={() => setSelectedOrder(o)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 900, lineHeight: 1 }}>{o.placa}</div>
                            <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600 }}>{o.marca} {o.modelo}</div>
                            {getPicoYPlaca(o.placa) && <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 800, marginTop: '0.2rem' }}>⚠️ {getPicoYPlaca(o.placa)}</div>}
                          </div>
                          <div style={{ background: 'var(--primary)', color: 'white', padding: '0.3rem 0.6rem', borderRadius: 6, fontWeight: 900 }}>{o.kilometraje ? `${fmt(o.kilometraje)} KM` : 'S/K'}</div>
                        </div>
                        {o.servicios && <div style={{ padding: '0.6rem', background: 'rgba(99,102,241,0.1)', borderRadius: 6, fontSize: '1rem', fontWeight: 600 }}>{o.servicios}</div>}
                      </div>
                    ))}
                    {pendingOrders.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, borderStyle: 'dashed' }}>Vacio</div>}
                  </div>
                </div>
                <div>
                  <h2 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={14} color="var(--success)" /> En Trabajo ({authorizedOrders.length})</h2>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {authorizedOrders.map(o => (
                      <div key={o.id} className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--success)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 900, lineHeight: 1 }}>{o.placa}</div>
                            <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600 }}>{o.marca} {o.modelo}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="btn-secondary" onClick={() => setSelectedOrder(o)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', fontWeight: 800 }}>Reportar</button>
                            <button className="btn-success" onClick={() => setShowChecklist(o.id)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', fontWeight: 800 }}>Terminar</button>
                          </div>
                        </div>
                        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>
                          {o.quotes?.find(q => q.autorizada)?.items?.map(i => i.descripcion).join(', ')}
                        </div>
                      </div>
                    ))}
                    {authorizedOrders.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, borderStyle: 'dashed' }}>Vacio</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
                <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                  <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input placeholder="Buscar placa..." value={searchQuery} onChange={e => setSearchQuery(e.target.value.toUpperCase())} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem' }} />
                </div>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {pastReports.filter(r => r.order?.placa.includes(searchQuery)).map(r => (
                    <div key={r.id} className="card order-card" style={{ padding: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setViewingPastReport(r)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span className="plate-tag">{r.order?.placa}</span>
                        <div><div style={{ fontWeight: 800 }}>{r.order?.marca} {r.order?.modelo}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(r.fecha).toLocaleDateString()}</div></div>
                      </div>
                      <ChevronRight size={18} color="var(--text-muted)" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showPhotoUpload && <PhotoUploadModal onClose={() => setShowPhotoUpload(false)} onSuccess={() => {}} />}
      {showChecklist && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 450, textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '1rem' }}>Control de Salida</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
              {[['pruebaRuta', '¿Prueba de ruta?'], ['limpio', '¿Vehículo limpio?'], ['herramientas', '¿Herramientas fuera?']].map(([k, l]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--surface2)', borderRadius: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={checklist[k]} onChange={e => setChecklist({ ...checklist, [k]: e.target.checked })} /><span style={{ fontWeight: 700 }}>{l}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}><button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowChecklist(null)}>Cancelar</button><button className="btn-success" style={{ flex: 1 }} disabled={!checklist.pruebaRuta || !checklist.limpio || !checklist.herramientas} onClick={confirmFinishWork}>Confirmar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
