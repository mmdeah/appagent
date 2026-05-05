import React, { useState, useEffect, useContext } from 'react';
import { API_URL } from '../api';
import { ThemeContext } from '../App';
import PhotoUploadModal from './PhotoUploadModal';
import { Wrench, Car, ChevronRight, ClipboardList, ArrowLeft, PlusCircle, SendHorizonal, Camera } from 'lucide-react';

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
  const num = parseFloat(n) || 0;
  return num.toLocaleString('es-CO', { minimumFractionDigits: 0 });
};

const StateBtn = ({ current, value, label }) => {
  const classes = {
    Bueno: current === 'Bueno' ? 'state-btn good' : 'state-btn',
    Regular: current === 'Regular' ? 'state-btn warn' : 'state-btn',
    Malo: current === 'Malo' ? 'state-btn bad' : 'state-btn',
  };
  return <button type="button" className={classes[value]}>{label}</button>;
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

  useEffect(() => {
    fetch(`${API_URL}/orders`)
      .then(res => res.json())
      .then(data => { setOrders(data.filter(o => o.estado !== 'Entregado')); setLoading(false); })
      .catch(() => setLoading(false));
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
      setTimeout(() => { setSelectedOrder(null); setReportData({}); setScannerCodes([{ prefix: 'P', code: '', description: '' }]); setPrecioDiagnostico(''); setStatusMsg({ text: '', type: '' }); }, 2000);
    } catch (e) {
      setStatusMsg({ text: '✗ Error al subir el reporte', type: 'error' });
    }
  };

  const estadoBadge = (estado) => {
    const map = { 'Recepción': 'badge-blue', 'Proceso': 'badge-yellow', 'Calidad': 'badge-green', 'Entregado': 'badge-red' };
    return <span className={`badge ${map[estado] || 'badge-blue'}`}>{estado}</span>;
  };

  if (!selectedOrder) {
    return (<>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div className="tech-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wrench size={18} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, lineHeight: 1 }}>Panel Técnico</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{orders.length} vehículo{orders.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <button onClick={toggleTheme} className="theme-toggle" title="Cambiar tema" />
          <button className="btn-secondary" style={{ gap: '0.5rem' }} onClick={() => setShowPhotoUpload(true)}>
            <Camera size={16} /> Subir Foto
          </button>
        </div>

        <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4rem' }}>Cargando órdenes...</p>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: '4rem', color: 'var(--text-muted)' }}>
              <ClipboardList size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No hay órdenes de servicio actualmente.</p>
            </div>
          ) : (
            <div className="tech-vehicle-grid">
              {orders.map(o => (
                <div key={o.id} className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => setSelectedOrder(o)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Car size={18} color="#818cf8" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{o.placa}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{o.marca} {o.modelo} {o.anio}</div>
                      </div>
                    </div>
                    <ChevronRight size={18} color="var(--text-muted)" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {estadoBadge(o.estado)}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(o.fecha).toLocaleDateString('es-CO')}
                    </span>
                  </div>
                  {o.servicios && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', lineHeight: 1.5 }}>
                      {o.servicios.length > 80 ? o.servicios.substring(0, 80) + '...' : o.servicios}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    {showPhotoUpload && (
      <PhotoUploadModal onClose={() => setShowPhotoUpload(false)} onSuccess={() => {}} />
    )}
  </>);
}

  return (<>
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="tech-header">
        <button className="btn-secondary" onClick={() => setSelectedOrder(null)}>
          <ArrowLeft size={16} /> Volver
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>Revisión: {selectedOrder.placa}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {selectedOrder.marca} {selectedOrder.modelo} {selectedOrder.anio}
            {selectedOrder.kilometraje ? ` · ${fmt(selectedOrder.kilometraje)} km` : ''}
          </div>
        </div>
        <button className="btn-success" onClick={submitReport} style={{ gap: '0.5rem' }}>
          <SendHorizonal size={16} /> Enviar
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem' }}>
        {statusMsg.text && (
          <div className={`toast toast-${statusMsg.type}`}>{statusMsg.text}</div>
        )}

        {(selectedOrder.servicios || selectedOrder.notas) && (
          <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--primary)', padding: '1rem 1.5rem' }}>
            {selectedOrder.servicios && (
              <div style={{ marginBottom: selectedOrder.notas ? '0.75rem' : '0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Servicios a Realizar</div>
                <div style={{ fontSize: '0.9rem' }}>{selectedOrder.servicios}</div>
              </div>
            )}
            {selectedOrder.notas && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Notas de Orden</div>
                <div style={{ fontSize: '0.9rem' }}>{selectedOrder.notas}</div>
              </div>
            )}
          </div>
        )}

        {Object.entries(categories).map(([category, items]) => (
          <div key={category} className="card" style={{ marginBottom: '1rem' }}>
            <p className="section-title">{category}</p>
            {items.map(item => {
              const key = `${category}-${item}`;
              const data = reportData[key];
              const isGood = data?.state === 'Bueno';
              const isWarn = data?.state === 'Regular';
              const isBad = data?.state === 'Malo';
              return (
                <div key={item}>
                  <div className="item-row">
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item}</span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button type="button"
                        className={isGood ? 'state-btn good' : 'state-btn'}
                        onClick={() => handleItemStateChange(category, item, 'Bueno')}>✓ Bueno</button>
                      <button type="button"
                        className={isWarn ? 'state-btn warn' : 'state-btn'}
                        onClick={() => handleItemStateChange(category, item, 'Regular')}>— Regular</button>
                      <button type="button"
                        className={isBad ? 'state-btn bad' : 'state-btn'}
                        onClick={() => handleItemStateChange(category, item, 'Malo')}>✗ Malo</button>
                    </div>
                  </div>

                  {/* Mejora #5: solo pedir info adicional si es Regular o Malo */}
                  {(isWarn || isBad) && (
                    <div className="item-details">
                      <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Mano de Obra ($):
                        <input type="text" className="price-input" placeholder="0" value={data?.manoObra ? fmt(data.manoObra) : ''}
                          onChange={e => handleDetail(category, item, 'manoObra', e.target.value.replace(/\D/g, ''))}
                          style={{ marginTop: '0.3rem' }} />
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                          <input type="checkbox"

                            checked={data?.requiereRepuesto || false}
                            onChange={e => handleDetail(category, item, 'requiereRepuesto', e.target.checked)} />
                          Requiere Repuesto
                        </label>
                        <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                          <input type="checkbox"
                            checked={data?.recibeReparacion || false}
                            onChange={e => handleDetail(category, item, 'recibeReparacion', e.target.checked)} />
                          Recibe Reparación
                        </label>
                      </div>
                      {data?.recibeReparacion && (
                        <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
                          Valor Reparación ($) — dejar vacío si Admin lo define:
                          <input type="text" className="price-input" placeholder="Pendiente (Admin)" value={data?.valorReparacion ? fmt(data.valorReparacion) : ''}
                            onChange={e => handleDetail(category, item, 'valorReparacion', e.target.value.replace(/\D/g, ''))}
                            style={{ marginTop: '0.3rem' }} />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Escáner */}
        <div className="card">
          <p className="section-title">Escáner / Electrónico</p>
          {scannerCodes.map((code, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={code.prefix} style={{ width: 'auto', flex: '0 0 auto' }}
                onChange={e => { const n = [...scannerCodes]; n[index].prefix = e.target.value; setScannerCodes(n); }}>
                {['P','B','C','U'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <input type="text" maxLength={4} placeholder="0000" style={{ width: 80, fontFamily: 'monospace', flex: '0 0 auto' }}
                value={code.code}
                onChange={e => { const v = e.target.value.replace(/\D/g,''); const n=[...scannerCodes]; n[index].code=v; setScannerCodes(n); }} />
              <input type="text" placeholder="Descripción de la falla" style={{ flex: 1, minWidth: 180 }}
                value={code.description}
                onChange={e => { const n=[...scannerCodes]; n[index].description=e.target.value; setScannerCodes(n); }} />
            </div>
          ))}
          <button className="btn-secondary" style={{ fontSize: '0.82rem' }}
            onClick={() => setScannerCodes([...scannerCodes, { prefix: 'P', code: '', description: '' }])}>
            <PlusCircle size={14} /> Añadir código DTC
          </button>

          {/* Precio diagnóstico si hay códigos */}
          {scannerCodes.some(c => c.code.trim().length > 0) && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>💡 Servicio: Diagnóstico Código de Avería</div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Precio del servicio de diagnóstico ($):
                <input type="text" className="price-input"
                  placeholder="Ej. 80.000"
                  value={precioDiagnostico}
                  onChange={e => setPrecioDiagnostico(e.target.value.replace(/\D/g,'') ? parseInt(e.target.value.replace(/\D/g,'')).toLocaleString('es-CO') : '')}
                  style={{ marginTop: '0.4rem' }} />
              </label>
            </div>
          )}
        </div>

        {statusMsg.text && (
          <div className={`toast toast-${statusMsg.type}`}>{statusMsg.text}</div>
        )}

        <button className="btn-success" style={{ width: '100%', padding: '1rem', fontSize: '1.05rem', justifyContent: 'center' }} onClick={submitReport}>
          <SendHorizonal size={18} /> Subir Revisión
        </button>
        </div>
      </div>
    </div>

    {showPhotoUpload && (
      <PhotoUploadModal onClose={() => setShowPhotoUpload(false)} onSuccess={() => {}} />
    )}
  </>);
}
