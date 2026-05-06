import React, { useState, useEffect, useContext } from 'react';
import { API_URL } from '../api';
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

// Formateador de números seguro
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
        [key]: { 
          ...current, 
          state, 
          category, 
          item,
          requiereRepuesto: state === 'Malo' ? true : current.requiereRepuesto
        } 
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
      }, 2000);
    } catch (e) {
      setStatusMsg({ text: '✗ Error al subir el reporte', type: 'error' });
    }
  };

  const finishWork = async (orderId) => {
    try {
      await fetch(`${API_URL}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Calidad' })
      });
      fetchOrders();
      setStatusMsg({ text: '✓ Trabajo terminado. Pasado a Calidad.', type: 'success' });
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
    } catch (e) { console.error(e); }
  };

  // VISTA PRINCIPAL (GRID 50/50)
  if (!selectedOrder) {
    const pendingOrders = orders.filter(o => o.estado !== 'Proceso' && o.estado !== 'Calidad');
    const authorizedOrders = orders.filter(o => o.estado === 'Proceso' && o.quotes?.some(q => q.autorizada));

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
        {/* Header */}
        <div className="tech-header" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Wrench size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, lineHeight: 1 }}>Panel Técnico</h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{orders.length} vehículos en taller</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={toggleTheme} className="theme-toggle" title="Cambiar tema" />
            <button className="btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => setShowPhotoUpload(true)}>
              <Camera size={18} /> <span className="hide-on-mobile">Subir Foto</span>
            </button>
          </div>
        </div>

        {/* Content Grid */}
        <div style={{ padding: '2rem', maxWidth: 1600, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2.5rem' }}>
          
          {/* Columna: REVISIONES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--primary)' }}>
              <ClipboardList size={20} color="var(--primary)" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Revisiones Pendientes</h2>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '4rem' }}>Cargando datos...</div>
            ) : pendingOrders.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '4rem', opacity: 0.6, borderStyle: 'dashed' }}>
                <p>No hay vehículos esperando revisión.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                {pendingOrders.map(o => (
                  <div key={o.id} className="card card-hover" style={{ cursor: 'pointer', padding: '1.5rem', borderLeft: '6px solid var(--primary)' }} onClick={() => setSelectedOrder(o)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                      <div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{o.placa}</div>
                        <div style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{o.marca} {o.modelo}</div>
                      </div>
                      <div style={{ background: 'var(--primary)', color: 'white', padding: '0.4rem 0.8rem', borderRadius: 8, fontWeight: 900, fontSize: '1.1rem' }}>
                        {o.kilometraje ? `${fmt(o.kilometraje)} KM` : 'S/K'}
                      </div>
                    </div>
                    
                    {o.notas && (
                      <div style={{ padding: '1rem', background: 'var(--warning)', color: '#000', borderRadius: 8, marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                        <AlertTriangle size={20} flexShrink={0} />
                        <div>
                          <div style={{ fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Notas de Recepción:</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.3 }}>{o.notas}</div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        TOCAR PARA INICIAR REVISIÓN <ChevronRight size={16} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Columna: TRABAJOS AUTORIZADOS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--success)' }}>
              <Wrench size={20} color="var(--success)" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trabajos Autorizados</h2>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '4rem' }}>Cargando datos...</div>
            ) : authorizedOrders.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '4rem', opacity: 0.6, borderStyle: 'dashed' }}>
                <p>No hay trabajos autorizados actualmente.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                {authorizedOrders.map(o => {
                  const quote = o.quotes.find(q => q.autorizada);
                  return (
                    <div key={o.id} className="card" style={{ padding: '2rem', borderLeft: '10px solid var(--success)', boxShadow: 'var(--shadow-lg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                        <div>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{o.placa}</div>
                          <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 700 }}>{o.marca} {o.modelo}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'flex-end' }}>
                          <div style={{ background: '#3b82f6', color: 'white', padding: '0.5rem 1rem', borderRadius: 10, fontWeight: 900, fontSize: '1.25rem' }}>
                            {o.kilometraje ? `${fmt(o.kilometraje)} KM` : 'S/K'}
                          </div>
                          <button className="btn-success" onClick={() => finishWork(o.id)} style={{ padding: '0.75rem 1.25rem', fontSize: '1rem', fontWeight: 800, borderRadius: 10 }}>
                            <SendHorizonal size={18} /> TERMINAR
                          </button>
                        </div>
                      </div>

                      {o.servicios && (
                        <div style={{ marginBottom: '1rem', padding: '0.8rem 1rem', background: 'rgba(99,102,241,0.1)', borderLeft: '4px solid var(--primary)', borderRadius: '4px 8px 8px 4px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Servicios Solicitados:</div>
                          <div style={{ fontSize: '1rem', fontWeight: 600 }}>{o.servicios}</div>
                        </div>
                      )}

                      {o.notas && (
                        <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'var(--danger)', color: 'white', borderRadius: 12, display: 'flex', gap: '1rem' }}>
                          <Info size={24} flexShrink={0} />
                          <div>
                            <div style={{ fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.3rem' }}>🚩 Observación Crítica:</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.4 }}>{o.notas}</div>
                          </div>
                        </div>
                      )}

                      <div style={{ background: 'var(--surface2)', borderRadius: 16, padding: '1.5rem', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                          📋 Tareas a Realizar
                        </div>
                        <ul style={{ paddingLeft: '1.5rem', display: 'grid', gap: '0.8rem' }}>
                          {quote.items.map((it, idx) => (
                            <li key={idx} style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>
                              <span style={{ color: 'var(--success)', marginRight: '0.75rem' }}>•</span>
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

        {showPhotoUpload && (
          <PhotoUploadModal onClose={() => setShowPhotoUpload(false)} onSuccess={() => {}} />
        )}
      </div>
    );
  }

  // VISTA DE REPORTE (FORMULARIO)
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header Formulario */}
      <div className="tech-header">
        <button className="btn-secondary" onClick={() => setSelectedOrder(null)}>
          <ArrowLeft size={18} /> <span className="hide-on-mobile">Volver</span>
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: '1.2rem', lineHeight: 1 }}>{selectedOrder.placa}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedOrder.marca} {selectedOrder.modelo}</div>
        </div>
        <button className="btn-success" onClick={submitReport} style={{ gap: '0.5rem' }}>
          <SendHorizonal size={18} /> <span className="hide-on-mobile">Enviar Reporte</span>
        </button>
      </div>

      <div style={{ maxWidth: 850, margin: '0 auto', padding: '2rem' }}>
        {statusMsg.text && (
          <div className={`toast toast-${statusMsg.type}`} style={{ marginBottom: '2rem' }}>{statusMsg.text}</div>
        )}

        {/* Info Contextual en el Formulario */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {selectedOrder.kilometraje && (
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #3b82f6', marginBottom: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase' }}>Kilometraje</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{fmt(selectedOrder.kilometraje)} KM</div>
            </div>
          )}
          {selectedOrder.notas && (
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--warning)', marginBottom: 0, background: 'rgba(245,158,11,0.05)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--warning)', textTransform: 'uppercase' }}>Notas Importantes</div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedOrder.notas}</div>
            </div>
          )}
        </div>

        {/* Servicios Solicitados */}
        {selectedOrder.servicios && (
          <div className="card" style={{ borderLeft: '4px solid var(--primary)', background: 'rgba(99,102,241,0.05)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Servicios Solicitados</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedOrder.servicios}</div>
          </div>
        )}

        {/* Categorías de Inspección */}
        {Object.entries(categories).map(([category, items]) => (
          <div key={category} className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              {category}
            </h3>
            {items.map(item => {
              const key = `${category}-${item}`;
              const data = reportData[key];
              const isGood = data?.state === 'Bueno';
              const isWarn = data?.state === 'Regular';
              const isBad = data?.state === 'Malo';
              return (
                <div key={item} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 600, flex: 1 }}>{item}</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className={isGood ? 'state-btn good' : 'state-btn'} onClick={() => handleItemStateChange(category, item, 'Bueno')}>Bueno</button>
                      <button type="button" className={isWarn ? 'state-btn warn' : 'state-btn'} onClick={() => handleItemStateChange(category, item, 'Regular')}>Regular</button>
                      <button type="button" className={isBad ? 'state-btn bad' : 'state-btn'} onClick={() => handleItemStateChange(category, item, 'Malo')}>Malo</button>
                    </div>
                  </div>

                  {(isWarn || isBad) && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg)', borderRadius: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                        Mano de Obra Estimada ($):
                        <input type="text" className="price-input" placeholder="0" value={data?.manoObra ? fmt(data.manoObra) : ''}
                          onChange={e => handleDetail(category, item, 'manoObra', e.target.value.replace(/\D/g, ''))}
                          style={{ marginTop: '0.4rem' }} />
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', justifyContent: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                          <input type="checkbox" checked={data?.requiereRepuesto || false} onChange={e => handleDetail(category, item, 'requiereRepuesto', e.target.checked)} />
                          Requiere Repuesto
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                          <input type="checkbox" checked={data?.recibeReparacion || false} onChange={e => handleDetail(category, item, 'recibeReparacion', e.target.checked)} />
                          Recibe Reparación
                        </label>
                      </div>
                      {data?.recibeReparacion && (
                        <label style={{ fontSize: '0.85rem', fontWeight: 700, gridColumn: '1 / -1' }}>
                          Valor Reparación ($):
                          <input type="text" className="price-input" placeholder="Pendiente Admin" value={data?.valorReparacion ? fmt(data.valorReparacion) : ''}
                            onChange={e => handleDetail(category, item, 'valorReparacion', e.target.value.replace(/\D/g, ''))}
                            style={{ marginTop: '0.4rem' }} />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Escáner DTC */}
        <div className="card">
          <h3 className="section-title">Escáner / Códigos de Falla</h3>
          {scannerCodes.map((code, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={code.prefix} style={{ width: 70 }} onChange={e => { const n = [...scannerCodes]; n[index].prefix = e.target.value; setScannerCodes(n); }}>
                {['P','B','C','U'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <input type="text" maxLength={4} placeholder="0000" style={{ width: 100, fontWeight: 800, textAlign: 'center' }}
                value={code.code}
                onChange={e => { const v = e.target.value.replace(/\D/g,''); const n=[...scannerCodes]; n[index].code=v; setScannerCodes(n); }} />
              <input type="text" placeholder="Descripción de la falla" style={{ flex: 1, minWidth: 200 }}
                value={code.description}
                onChange={e => { const n=[...scannerCodes]; n[index].description=e.target.value; setScannerCodes(n); }} />
            </div>
          ))}
          <button className="btn-secondary" onClick={() => setScannerCodes([...scannerCodes, { prefix: 'P', code: '', description: '' }])}>
            <PlusCircle size={16} /> Añadir DTC
          </button>
        </div>

        <button className="btn-success" style={{ width: '100%', padding: '1.5rem', fontSize: '1.2rem', fontWeight: 900, marginTop: '2rem', borderRadius: 16 }} onClick={submitReport}>
          SUBIR REPORTE DE REVISIÓN
        </button>
      </div>

      {showPhotoUpload && (
        <PhotoUploadModal onClose={() => setShowPhotoUpload(false)} onSuccess={() => {}} />
      )}
    </div>
  );
}
