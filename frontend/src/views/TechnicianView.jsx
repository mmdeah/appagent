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
  Info
} from 'lucide-react';

const categories = {
  "Suspensión": ["Amortiguadores Del.", "Amortiguadores Tras.", "Bujes de Tijera", "Tijeras", "Lágrimas", "Soporte de Amortiguadores", "Bujes Barra Estabilizadora", "Soportes de Motor", "Rótulas"],
  "Frenos": ["Pastillas Del.", "Pastillas Tras.", "Discos Del.", "Discos Tras.", "Líquido de Frenos", "Freno de Mano", "Mangueras de Freno", "Bomba de Freno", "Cilindro de Freno", "Campanas Traseras", "Bandas Traseras"],
  "Dirección": ["Caja de Dirección", "Terminales", "Axiales", "Bomba de Dirección", "Aceite Hidráulico", "Holgura Volante"],
  "Transmisión": ["Puntas", "Cardán", "Embrague", "Empaque Caja de Cambios", "Guardapolvos"],
  "Fugas": ["Fuga Aceite Motor", "Fuga Transmisión", "Fuga Dirección", "Fuga Refrigerante", "Fuga Combustible", "Fuga Frenos"],
  "Batería / Eléctrico": ["Batería", "Alternador", "Motor de Arranque"],
  "Chequeo Visual Motor": ["Correa Distribución", "Correa Accesorios", "Aceite Motor", "Cableado Visible", "Empaque tapavalvulas", "Empaque de Carter", "Reten Delantero Cigueñal", "Reten Trasero Cigueñal", "Tapacadena", "Sensor"],
  "Refrigeración": ["Refrigerante", "Tapa Radiador", "Mangueras", "Termostato", "Ventilador / Clutch", "Radiador (fugas/daño)", "Bomba de Agua", "Deposito Refrigerante"],
  "Visual Exterior / Luces": ["Luces Delanteras", "Luces Traseras", "Direccionales", "Luz de Freno", "Llantas (desgaste)", "Cristales / Limpiadores"]
};

const fmt = (n) => {
  if (n === null || n === undefined || n === '') return '';
  const num = parseFloat(n.toString().replace(/\D/g, '')) || 0;
  return num.toLocaleString('es-CO', { minimumFractionDigits: 0 });
};

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

  useEffect(() => {
    fetchOrders();
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
      setTimeout(() => { setSelectedOrder(null); setReportData({}); setScannerCodes([{ prefix: 'P', code: '', description: '' }]); setPrecioDiagnostico(''); setStatusMsg({ text: '', type: '' }); fetchOrders(); }, 2000);
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
      {!selectedOrder ? (
        <>
          <div className="tech-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <Wrench size={18} />
              </div>
              <div>
                <h1 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, lineHeight: 1 }}>Panel Técnico</h1>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{orders.length} vehículos</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <button onClick={toggleTheme} className="theme-toggle" title="Cambiar tema" />
              <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }} onClick={() => setShowPhotoUpload(true)}>
                <Camera size={14} /> Foto
              </button>
            </div>
          </div>

        <div style={{ padding: '1.5rem', maxWidth: 1600, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          
          {/* REVISIONES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.4rem', borderBottom: '2px solid var(--primary)' }}>
              <ClipboardList size={18} color="var(--primary)" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>Revisiones Pendientes</h2>
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</div> : pendingOrders.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, borderStyle: 'dashed' }}>Vacio</div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {pendingOrders.map(o => (
                  <div key={o.id} className="card card-hover" style={{ cursor: 'pointer', padding: '1rem 1.25rem', borderLeft: '4px solid var(--primary)' }} onClick={() => setSelectedOrder(o)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{o.placa}</div>
                        <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600 }}>{o.marca} {o.modelo}</div>
                        {getPicoYPlaca(o.placa) && (
                          <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 800, marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <AlertTriangle size={10} /> {getPicoYPlaca(o.placa)}
                          </div>
                        )}
                      </div>
                      <div style={{ background: 'var(--primary)', color: 'white', padding: '0.3rem 0.6rem', borderRadius: 6, fontWeight: 900, fontSize: '1rem' }}>
                        {o.kilometraje ? `${fmt(o.kilometraje)} KM` : 'S/K'}
                      </div>
                    </div>
                    {o.servicios && (
                      <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(99,102,241,0.1)', borderLeft: '3px solid var(--primary)', borderRadius: 6, marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--primary)' }}>Servicios:</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600 }}>{o.servicios}</div>
                      </div>
                    )}
                    {o.notas && (
                      <div style={{ padding: '0.6rem 0.8rem', background: 'var(--warning)', color: '#000', borderRadius: 6, display: 'flex', gap: '0.5rem' }}>
                        <AlertTriangle size={16} flexShrink={0} />
                        <div>
                          <div style={{ fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase' }}>Notas:</div>
                          <div style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.2 }}>{o.notas}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TRABAJOS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.4rem', borderBottom: '2px solid var(--success)' }}>
              <Wrench size={18} color="var(--success)" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>Trabajos Autorizados</h2>
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</div> : authorizedOrders.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, borderStyle: 'dashed' }}>Vacio</div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {authorizedOrders.map(o => {
                  const quote = o.quotes.find(q => q.autorizada);
                  return (
                    <div key={o.id} className="card" style={{ padding: '1.25rem', borderLeft: '6px solid var(--success)', boxShadow: 'var(--shadow)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{o.placa}</div>
                          <div style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 700 }}>{o.marca} {o.modelo}</div>
                          {getPicoYPlaca(o.placa) && (
                            <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 800, marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <AlertTriangle size={12} /> {getPicoYPlaca(o.placa)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                          <div style={{ background: '#3b82f6', color: 'white', padding: '0.4rem 0.8rem', borderRadius: 8, fontWeight: 900, fontSize: '1rem' }}>
                            {o.kilometraje ? `${fmt(o.kilometraje)} KM` : 'S/K'}
                          </div>
                          <button className="btn-success" onClick={() => setShowChecklist(o.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.95rem', fontWeight: 800, borderRadius: 8 }}>
                            TERMINAR
                          </button>
                        </div>
                      </div>

                      {o.servicios && (
                        <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(99,102,241,0.1)', borderLeft: '3px solid var(--primary)', borderRadius: '4px' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Servicios:</div>
                          <div style={{ fontSize: '1rem', fontWeight: 600 }}>{o.servicios}</div>
                        </div>
                      )}

                      {o.notas && (
                        <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.8rem', background: 'var(--danger)', color: 'white', borderRadius: 8, display: 'flex', gap: '0.5rem' }}>
                          <Info size={16} flexShrink={0} />
                          <div>
                            <div style={{ fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase' }}>Nota:</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.2 }}>{o.notas}</div>
                          </div>
                        </div>
                      )}

                      <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '1rem', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>📋 Tareas:</div>
                        <ul style={{ paddingLeft: '1.25rem', display: 'grid', gap: '0.4rem' }}>
                          {quote.items.map((it, idx) => (
                            <li key={idx} style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>
                              <span style={{ color: 'var(--success)', marginRight: '0.4rem' }}>•</span>
                              {it.cantidad}x {it.descripcion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </>
    ) : (
        <div style={{ paddingBottom: '2rem' }}>
          <div className="tech-header">
        <button className="btn-secondary" onClick={() => setSelectedOrder(null)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.95rem' }}>
          <ArrowLeft size={16} /> Volver
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', lineHeight: 1 }}>{selectedOrder.placa}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{selectedOrder.marca} {selectedOrder.modelo}</div>
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
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase' }}>KM</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{fmt(selectedOrder.kilometraje)}</div>
            </div>
          )}
          {selectedOrder.notas && (
            <div className="card" style={{ padding: '0.75rem', borderLeft: '4px solid var(--warning)', marginBottom: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--warning)', textTransform: 'uppercase' }}>Notas</div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedOrder.notas}</div>
            </div>
          )}
        </div>

        {selectedOrder.servicios && (
          <div className="card" style={{ borderLeft: '4px solid var(--primary)', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Servicios Solicitados</div>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedOrder.servicios}</div>
          </div>
        )}

        {Object.entries(categories).map(([category, items]) => (
          <div key={category} className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>{category}</h3>
            {items.map(item => {
              const key = `${category}-${item}`;
              const data = reportData[key];
              const isGood = data?.state === 'Bueno';
              const isWarn = data?.state === 'Regular';
              const isBad = data?.state === 'Malo';
              return (
                <div key={item} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 600 }}>{item}</span>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button type="button" className={isGood ? 'state-btn good' : 'state-btn'} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleItemStateChange(category, item, 'Bueno')}>Bueno</button>
                      <button type="button" className={isWarn ? 'state-btn warn' : 'state-btn'} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleItemStateChange(category, item, 'Regular')}>Regular</button>
                      <button type="button" className={isBad ? 'state-btn bad' : 'state-btn'} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleItemStateChange(category, item, 'Malo')}>Malo</button>
                    </div>
                  </div>
                  {(isWarn || isBad) && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg)', borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Mano de Obra ($):<input type="text" className="price-input" value={data?.manoObra ? fmt(data.manoObra) : ''} onChange={e => handleDetail(category, item, 'manoObra', e.target.value.replace(/\D/g, ''))} /></label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 600 }}><input type="checkbox" checked={data?.requiereRepuesto || false} onChange={e => handleDetail(category, item, 'requiereRepuesto', e.target.checked)} />Repuesto</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 600 }}><input type="checkbox" checked={data?.recibeReparacion || false} onChange={e => handleDetail(category, item, 'recibeReparacion', e.target.checked)} />Reparación</label>
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
          <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem' }} onClick={() => setScannerCodes([...scannerCodes, { prefix: 'P', code: '', description: '' }])}>+ DTC</button>
        </div>

        <button className="btn-success" style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 900, marginTop: '1.5rem', borderRadius: 12, maxWidth: 900, margin: '1.5rem auto 0', display: 'block' }} onClick={submitReport}>SUBIR REVISIÓN</button>
        </div>
      </div>
    )}

      {showPhotoUpload && <PhotoUploadModal onClose={() => setShowPhotoUpload(false)} onSuccess={() => {}} />}

      {showChecklist && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 450, textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>Control de Salida</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Verifica los siguientes puntos antes de pasar a calidad:</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left', marginBottom: '2rem' }}>
              {[
                ['pruebaRuta', '¿Prueba de ruta realizada?'],
                ['limpio', '¿Vehículo limpio?'],
                ['herramientas', '¿Herramientas fuera del vehículo?']
              ].map(([key, label]) => (
                <label key={key} style={{ 
                  display: 'flex', alignItems: 'center', gap: '1rem', 
                  padding: '1rem', background: 'var(--surface2)', borderRadius: 12,
                  cursor: 'pointer', border: checklist[key] ? '2px solid var(--success)' : '2px solid transparent'
                }}>
                  <input 
                    type="checkbox" 
                    checked={checklist[key]} 
                    onChange={e => setChecklist({ ...checklist, [key]: e.target.checked })} 
                  />
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>{label}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowChecklist(null)}>Cancelar</button>
              <button 
                className="btn-success" 
                style={{ flex: 1 }} 
                disabled={!checklist.pruebaRuta || !checklist.limpio || !checklist.herramientas}
                onClick={confirmFinishWork}
              >
                CONFIRMAR TODO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
