import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

const categories = {
  "Suspensión": [
    "Amortiguadores Del.", "Amortiguadores Tras.", "Bujes de Tijera", "Tijeras", "Lágrimas",
    "Soporte de Amortiguadores", "Bujes Barra Estabilizadora", "Soportes de Motor", "Rótulas"
  ],
  "Frenos": [
    "Pastillas Del.", "Pastillas Tras.", "Discos Del.", "Discos Tras.", "Líquido de Frenos",
    "Freno de Mano", "Mangueras de Freno", "Bomba de Freno", "Cilindro de Freno",
    "Campanas Traseras", "Bandas Traseras"
  ],
  "Dirección": [
    "Caja de Dirección", "Terminales", "Axiales", "Bomba de Dirección", "Aceite Hidráulico", "Holgura Volante"
  ],
  "Transmisión": [
    "Puntas", "Cardán", "Embrague", "Empaque Caja de Cambios", "Guardapolvos"
  ],
  "Fugas": [
    "Fuga Aceite Motor", "Fuga Transmisión", "Fuga Dirección", "Fuga Refrigerante", "Fuga Combustible", "Fuga Frenos"
  ],
  "Batería": [
    "Batería", "Alternador", "Motor de Arranque"
  ],
  "Chequeo Visual Motor": [
    "Correa Distribución", "Correa Accesorios", "Aceite Motor", "Cableado Visible", "Empaque tapavalvulas",
    "Empaque de Carter", "Reten Delantero Cigueñal", "Reten Trasero Cigueñal", "Tapacadena", "Sensor"
  ],
  "Refrigeración": [
    "Refrigerante", "Tapa Radiador", "Mangueras", "Termostato", "Ventilador / Clutch",
    "Radiador (fugas/daño)", "Bomba de Agua", "Deposito Refrigerante"
  ],
  "Visual Exterior / Luces": [
    "Luces Delanteras", "Luces Traseras", "Direccionales", "Luz de Freno", "Llantas (desgaste)", "Cristales / Limpiadores"
  ]
};

export default function TechnicianView() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Form State
  const [reportData, setReportData] = useState({});
  const [scannerCodes, setScannerCodes] = useState([{ prefix: 'P', code: '', description: '' }]);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    // Fetch orders in process or reception
    fetch(`${API_URL}/orders?estado=Proceso`)
      .then(res => res.json())
      .then(data => setOrders(data));
  }, []);

  const handleItemStateChange = (category, item, state) => {
    setReportData(prev => {
      const current = prev[`${category}-${item}`] || {};
      if (current.state === state) {
        // Toggle off
        const newState = { ...prev };
        delete newState[`${category}-${item}`];
        return newState;
      }
      return {
        ...prev,
        [`${category}-${item}`]: { ...current, state, category, item }
      };
    });
  };

  const handleItemDetailChange = (category, item, field, value) => {
    setReportData(prev => ({
      ...prev,
      [`${category}-${item}`]: {
        ...prev[`${category}-${item}`],
        [field]: value
      }
    }));
  };

  const submitReport = async () => {
    // Clean data, save only marked items
    const items = Object.values(reportData);
    const validScannerCodes = scannerCodes.filter(c => c.code.length === 4);
    
    const payload = {
      orderId: selectedOrder.id,
      items,
      scannerCodes: validScannerCodes,
      fecha: new Date().toISOString()
    };

    try {
      await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setStatusMsg({ text: 'Reporte subido exitosamente.', type: 'success' });
      setTimeout(() => {
        setSelectedOrder(null);
        setReportData({});
        setStatusMsg({ text: '', type: '' });
      }, 2000);
    } catch (e) {
      console.error(e);
      setStatusMsg({ text: 'Error al subir el reporte. Inténtalo de nuevo.', type: 'error' });
    }
  };

  if (!selectedOrder) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Panel del Técnico</h1>
        <h2>Vehículos en Taller</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {orders.map(o => (
            <div key={o.id} className="card" style={{ width: '300px', cursor: 'pointer' }} onClick={() => setSelectedOrder(o)}>
              <h3>{o.placa}</h3>
              <p>{o.marca} {o.modelo}</p>
            </div>
          ))}
          {orders.length === 0 && <p>No hay vehículos en proceso.</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={() => setSelectedOrder(null)} className="btn-secondary" style={{ marginBottom: '1rem' }}>
        &larr; Volver
      </button>
      <h1>Revisión: {selectedOrder.placa}</h1>
      <p style={{ marginBottom: '2rem' }}>{selectedOrder.marca} {selectedOrder.modelo}</p>

      {/* Dynamic Form */}
      {Object.entries(categories).map(([category, items]) => (
        <div key={category} className="card">
          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', marginBottom: '1rem' }}>{category}</h3>
          {items.map(item => {
            const key = `${category}-${item}`;
            const data = reportData[key];
            return (
              <div key={item} style={{ marginBottom: '1rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{item}</strong>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => handleItemStateChange(category, item, 'Bueno')}
                      style={{ background: data?.state === 'Bueno' ? '#10b981' : '#e2e8f0', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                    >✓</button>
                    <button 
                      onClick={() => handleItemStateChange(category, item, 'Regular')}
                      style={{ background: data?.state === 'Regular' ? '#f59e0b' : '#e2e8f0', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                    >—</button>
                    <button 
                      onClick={() => handleItemStateChange(category, item, 'Malo')}
                      style={{ background: data?.state === 'Malo' ? '#ef4444' : '#e2e8f0', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                    >X</button>
                  </div>
                </div>
                
                {data?.state && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
                    <label>
                      <input 
                        type="checkbox" 
                        checked={data.requiereRepuesto || false} 
                        onChange={(e) => handleItemDetailChange(category, item, 'requiereRepuesto', e.target.checked)}
                      /> Requiere Repuesto
                    </label>
                    <label>
                      <input 
                        type="checkbox" 
                        checked={data.recibeReparacion || false} 
                        onChange={(e) => handleItemDetailChange(category, item, 'recibeReparacion', e.target.checked)}
                      /> Recibe Reparación
                    </label>
                    <label>
                      Mano de Obra ($): 
                      <input 
                        type="number" 
                        style={{ width: '100%', padding: '0.25rem' }} 
                        value={data.manoObra || ''} 
                        onChange={(e) => handleItemDetailChange(category, item, 'manoObra', e.target.value)}
                      />
                    </label>
                    {data.recibeReparacion && (
                      <label>
                        Valor Reparación ($): 
                        <input 
                          type="number" 
                          placeholder="Pendiente (Admin)"
                          style={{ width: '100%', padding: '0.25rem' }} 
                          value={data.valorReparacion || ''} 
                          onChange={(e) => handleItemDetailChange(category, item, 'valorReparacion', e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div className="card">
        <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Escáner / Electrónico</h3>
        {scannerCodes.map((code, index) => (
          <div key={index} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select 
              value={code.prefix} 
              onChange={e => {
                const newCodes = [...scannerCodes];
                newCodes[index].prefix = e.target.value;
                setScannerCodes(newCodes);
              }}
              style={{ padding: '0.5rem' }}
            >
              <option value="P">P</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="U">U</option>
            </select>
            <input 
              type="text" 
              maxLength={4}
              placeholder="0000" 
              style={{ padding: '0.5rem', width: '80px', fontFamily: 'monospace' }}
              value={code.code}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, ''); // only numbers
                const newCodes = [...scannerCodes];
                newCodes[index].code = val;
                setScannerCodes(newCodes);
              }}
            />
            <input 
              type="text" 
              placeholder="Descripción de la falla" 
              style={{ padding: '0.5rem', flex: 1, minWidth: '200px' }}
              value={code.description}
              onChange={e => {
                const newCodes = [...scannerCodes];
                newCodes[index].description = e.target.value;
                setScannerCodes(newCodes);
              }}
            />
          </div>
        ))}
        <button 
          className="btn-secondary" 
          onClick={() => setScannerCodes([...scannerCodes, { prefix: 'P', code: '', description: '' }])}
        >
          Añadir otro código DTC
        </button>
      </div>

      {statusMsg.text && (
        <div style={{ padding: '1rem', marginBottom: '1rem', borderRadius: '8px', background: statusMsg.type === 'success' ? '#d1fae5' : '#fee2e2', color: statusMsg.type === 'success' ? '#065f46' : '#991b1b', textAlign: 'center', fontWeight: 'bold' }}>
          {statusMsg.text}
        </div>
      )}

      <button className="btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.2rem' }} onClick={submitReport}>
        Subir Revisión
      </button>
    </div>
  );
}
