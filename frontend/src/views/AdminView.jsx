import React, { useState, useEffect, useContext, useRef } from 'react';
import { API_URL, BACKEND_URL, getPicoYPlaca } from '../api';
import OrderDetailsModal from './OrderDetailsModal';
import PhotoUploadModal from './PhotoUploadModal';
import CitaModal, { SERVICIOS } from './CitaModal';
import RecordatoriosModal from './RecordatoriosModal';
import { ThemeContext } from '../App';
import { PlusCircle, BarChart3, Camera, X, Car, Trash2, Zap, LayoutDashboard, History, Receipt, CheckCircle, AlertTriangle, ClipboardList, Save, Settings, FileText, Plus, Sparkles, CreditCard, Clock, BadgeCheck, Ban, Search, ChevronDown, Calendar, MessageCircle } from 'lucide-react';
import BillingCycleTab from './BillingCycleTab';

const fmt = (n) => Math.round(parseFloat(n) || 0).toLocaleString('es-CO');
const fmtCompact = (n) => {
  const v = Math.round(parseFloat(n) || 0);
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`;
  if (Math.abs(v) >= 1e3) return `${Math.round(v / 1e3)}K`;
  return String(v);
};
// Muestra "1.234.567" mientras se escribe; el valor guardado en el estado sigue siendo solo dígitos.
const fmtMiles = (digitsOnly) => digitsOnly ? parseInt(digitsOnly, 10).toLocaleString('es-CO') : '';

const COLUMNS = ['Recepción', 'Proceso', 'Calidad', 'Ingresos Rápidos'];
const PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Bancolombia', 'Banco de Bogota', 'Tarjeta'];
const EXPENSE_CATEGORIES = ['Repuestos', 'Insumos', 'Nómina', 'Arriendo', 'Servicios Públicos', 'Herramientas', 'Impuestos', 'Otros'];

const emptyForm = { placa: '', cliente: '', documento: '', telefono: '', correo: '', marca: '', modelo: '', anio: '', kilometraje: '', servicios: '', notas: '' };

const REVISION_CATEGORIES_FALLBACK = ["Suspensión", "Frenos", "Dirección", "Transmisión", "Fugas", "Batería / Eléctrico", "Chequeo Visual Motor", "Niveles", "Otros", "Insumos", "Servicios Especializados"];

export default function AdminView() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ avg: 0, total: 0, active: 0 });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [createdOrderData, setCreatedOrderData] = useState(null);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState([]);
  const [activeTab, setActiveTab] = useState('Kanban');
  const [openMenu, setOpenMenu] = useState(null);
  const navRef = useRef(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ fecha: new Date().toISOString().split('T')[0], concepto: '', monto: '', metodoPago: 'Efectivo', categoria: 'Repuestos' });
  const [quickOrderForm, setQuickOrderForm] = useState({ placa: '', cliente: '', marca: '', modelo: '', anio: '', servicios: '' });
  const [formStatus, setFormStatus] = useState({ text: '', type: '' });
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [todos, setTodos] = useState([]);
  const [citas, setCitas] = useState([]);
  const [citasMonth, setCitasMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [showCitaModal, setShowCitaModal] = useState(null); // null | {mode:'create', fecha} | {mode:'edit', cita}
  const [showRecordatorios, setShowRecordatorios] = useState(false);
  const [newTodo, setNewTodo] = useState('');
  const [formConfig, setFormConfig] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [reportGenerator, setReportGenerator] = useState({ placa: '', secciones: [{ categoria: '', descripcion: '' }] });
  const [reportOrderId, setReportOrderId] = useState('');
  const [allQuotes, setAllQuotes] = useState(true);
  const [selectedQuoteItems, setSelectedQuoteItems] = useState([]);
  const [aiInstructions, setAiInstructions] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState('');
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialDesde, setHistorialDesde] = useState('');
  const [historialHasta, setHistorialHasta] = useState('');
  const [aldBillings, setAldBillings] = useState([]);
  const [cnBillings, setCnBillings] = useState([]);
  const [laAscensionBillings, setLaAscensionBillings] = useState([]);
  const [analyzingExpense, setAnalyzingExpense] = useState(false);
  const expenseImageInputRef = React.useRef(null);
  const [fleetUsers, setFleetUsers] = useState([]);
  const [fleetUserForm, setFleetUserForm] = useState({ nombre: '', empresa: 'ald', usuario: '', password: '' });
  const [fleetUserStatus, setFleetUserStatus] = useState('');
  const [gastosSearch, setGastosSearch] = useState('');
  const [gastosDesde, setGastosDesde] = useState('');
  const [gastosHasta, setGastosHasta] = useState('');
  const [gastosMetodo, setGastosMetodo] = useState('Todos');
  const [gastosCategoria, setGastosCategoria] = useState('Todas');
  const [gastosStatsPeriod, setGastosStatsPeriod] = useState('mes');
  const [gastosAgrupar, setGastosAgrupar] = useState('dia');
  const [gastosStatsDesde, setGastosStatsDesde] = useState('');
  const [gastosStatsHasta, setGastosStatsHasta] = useState('');
  const [deleteExpenseId, setDeleteExpenseId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const IS_FLOTA = (cliente) => /(ald|ayvens)/i.test(cliente || '');
  const IS_CN = (cliente) => /consult.?networks/i.test(cliente || '');
  const IS_LA_ASCENSION = (cliente) => /la\s*ascensi[oó]n/i.test(cliente || '');

  const fetchAldBillings = () => {
    fetch(`${API_URL}/ald_billings`)
      .then(r => r.json()).then(data => setAldBillings(Array.isArray(data) ? data : [])).catch(() => {});
  };
  const fetchCnBillings = () => {
    fetch(`${API_URL}/cn_billings`)
      .then(r => r.json()).then(data => setCnBillings(Array.isArray(data) ? data : [])).catch(() => {});
  };
  const fetchLaAscensionBillings = () => {
    fetch(`${API_URL}/la_ascension_billings`)
      .then(r => r.json()).then(data => setLaAscensionBillings(Array.isArray(data) ? data : [])).catch(() => {});
  };

  const [statsPeriod, setStatsPeriod] = useState('mes');
  const [statsDesde, setStatsDesde] = useState('');
  const [statsHasta, setStatsHasta] = useState('');

  const calcOrderTotal = (o) => {
    const q = o.quotes?.find(q => q.autorizada) || o.quotes?.[0];
    if (!q) return 0;
    return (q.items || []).reduce((sum, i) => {
      const lt = (Number(i.precio) || 0) * (Number(i.cantidad) || 1);
      return sum + lt + (i.aplicaIva ? lt * 0.19 : 0);
    }, 0);
  };

  const calcOrderIva = (o) => {
    const q = o.quotes?.find(q => q.autorizada) || o.quotes?.[0];
    if (!q) return 0;
    return (q.items || []).reduce((sum, i) => {
      const lt = (Number(i.precio) || 0) * (Number(i.cantidad) || 1);
      return sum + (i.aplicaIva ? lt * 0.19 : 0);
    }, 0);
  };

  const getStatsRange = () => {
    const now = new Date();
    if (statsPeriod === 'semana') {
      const dow = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1)); mon.setHours(0,0,0,0);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
      return { desde: mon, hasta: sun };
    }
    if (statsPeriod === 'mes') {
      return { desde: new Date(now.getFullYear(), now.getMonth(), 1), hasta: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) };
    }
    if (statsPeriod === 'año') {
      return { desde: new Date(now.getFullYear(), 0, 1), hasta: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) };
    }
    // personalizado
    return {
      desde: statsDesde ? new Date(statsDesde + 'T00:00:00') : null,
      hasta: statsHasta ? new Date(statsHasta + 'T23:59:59') : null,
    };
  };

  const getNextCorteALD = () => {
    const now = new Date();
    const thisMonth20 = new Date(now.getFullYear(), now.getMonth(), 20);
    const next = now < thisMonth20 ? thisMonth20 : new Date(now.getFullYear(), now.getMonth() + 1, 20);
    const days = Math.ceil((next - now) / 86400000);
    return { date: next, days: days <= 0 ? 0 : days };
  };

  const handleGenerateReport = async () => {
    if (!reportOrderId) return;
    setIsGeneratingReport(true);
    setReportError('');
    try {
      const selectedOrder = orders.find(o => String(o.id) === String(reportOrderId));
      const payload = {
        orderId: reportOrderId,
        allQuotes: allQuotes,
        selectedItems: allQuotes ? [] : selectedQuoteItems,
        notes: aiInstructions
      };

      const res = await fetch(`${BACKEND_URL}/api/generate-ai-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errMsg = 'Error al generar el informe';
        try {
          const err = await res.json();
          errMsg = [err.error, err.details].filter(Boolean).join(' — ') || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      // Download the PDF blob returned by the backend
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Informe_Tecnico_${selectedOrder?.placa || 'Reporte'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      // Reset form and update orders
      fetchOrders();
      setAiInstructions('');
      setReportOrderId('');
      setAllQuotes(true);
      setSelectedQuoteItems([]);
    } catch (e) {
      console.error("Error in handleGenerateReport:", e);
      setReportError(e.message || 'Error en la generación del reporte.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await fetch(`${API_URL}/expenses`);
      if (res.status === 404) {
        setExpenses([]);
        return;
      }
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (e) { 
      console.error(e);
      setExpenses([]);
    }
  };

  const fetchTodos = async () => {
    try {
      const res = await fetch(`${API_URL}/todos`);
      if (res.status === 404) {
        setTodos([]);
        return;
      }
      const data = await res.json();
      setTodos(Array.isArray(data) ? data : []);
    } catch (e) { 
      console.error(e);
      setTodos([]);
    }
  };

  const addTodo = async (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    try {
      await fetch(`${API_URL}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newTodo, completed: false })
      });
      setNewTodo('');
      fetchTodos();
    } catch (e) { console.error(e); }
  };

  const toggleTodo = async (todo) => {
    try {
      await fetch(`${API_URL}/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !todo.completed })
      });
      fetchTodos();
    } catch (e) { console.error(e); }
  };

  const deleteTodo = async (id) => {
    try {
      await fetch(`${API_URL}/todos/${id}`, { method: 'DELETE' });
      fetchTodos();
    } catch (e) { console.error(e); }
  };

  const fetchCitas = async () => {
    try {
      const res = await fetch(`${API_URL}/citas`);
      if (res.status === 404) {
        setCitas([]);
        return;
      }
      const data = await res.json();
      setCitas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setCitas([]);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/orders?_embed=reports&_embed=quotes`);
      const data = await res.json();
      const ordersArr = Array.isArray(data) ? data : [];
      setOrders(ordersArr);
      
      let incomeTotal = 0;
      const entregadas = ordersArr.filter(o => o.estado === 'Entregado');
      
      entregadas.forEach(o => {
        if (o.quotes && Array.isArray(o.quotes)) {
          o.quotes.forEach(q => {
            if (q.items && Array.isArray(q.items)) {
              q.items.forEach(it => {
                const precio = parseFloat(it.precio) || 0;
                const cantidad = parseFloat(it.cantidad) || 0;
                const sub = precio * cantidad;
                incomeTotal += it.aplicaIva ? sub * 1.19 : sub;
              });
            }
          });
        }
      });

      const active = ordersArr.filter(o => o.estado !== 'Entregado').length;
      setStats({ 
        total: Math.round(incomeTotal), 
        avg: entregadas.length > 0 ? incomeTotal / entregadas.length : 0, 
        active 
      });
    } catch (e) { 
      console.error("Error fetching orders for stats:", e); 
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/settings`);
      const data = await res.json();
      // Handle both array and object responses
      let config = Array.isArray(data) ? data.find(s => s.id === 'revision_form') : data;
      
      // If data was an array but revision_form wasn't found, it might be the first element
      if (Array.isArray(data) && !config && data.length > 0) config = data[0];

      if (config && config.categories) {
        setFormConfig(config.categories);
      } else if (data && data.categories) {
        // Direct object response with categories
        setFormConfig(data.categories);
      } else {
        console.error("Configuración no encontrada en settings:", data);
      }
    } catch (e) { 
      console.error("Error al cargar configuración:", e);
    }
  };

  const saveConfig = async (newConfig) => {
    try {
      await fetch(`${API_URL}/settings/revision_form`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: newConfig })
      });
      setFormConfig(newConfig);
      setFormStatus({ text: 'Configuración guardada exitosamente', type: 'success' });
      setTimeout(() => setFormStatus({ text: '', type: '' }), 3000);
    } catch (e) { 
      setFormStatus({ text: 'Error al guardar la configuración', type: 'error' });
    }
  };

  useEffect(() => { fetchOrders(); fetchExpenses(); fetchTodos(); fetchConfig(); fetchAldBillings(); fetchCnBillings(); fetchLaAscensionBillings(); fetchFleetUsers(); fetchCitas(); }, []);
  useEffect(() => {
    const handler = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setOpenMenu(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const deleteOrder = (id) => {
    setOrderToDelete(id);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      await fetch(`${API_URL}/orders/${orderToDelete}`, { method: 'DELETE' });
      setOrderToDelete(null);
      fetchOrders();
    } catch (e) { console.error(e); }
  };

  const moveOrder = async (id, estado) => {
    await fetch(`${API_URL}/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    });
    fetchOrders();
  };

  // Mejora #2: Convertir fotos a Base64 para guardarlas en la orden
  const handlePhotos = (e) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map(f => new Promise((res) => {
      const reader = new FileReader();
      reader.onload = ev => res(ev.target.result);
      reader.readAsDataURL(f);
    }))).then(results => setPhotos(prev => [...prev, ...results]));
  };

  const handleIngresarDesdeCita = (cita) => {
    // El campo "vehiculo" de la cita es un texto libre (Ej. "Mazda 3"); se separa
    // en marca/modelo por la primera palabra como punto de partida, el admin
    // completa/corrige el resto en el formulario de ingreso.
    const [marca, ...resto] = (cita.vehiculo || '').split(' ');
    setForm({
      ...emptyForm,
      placa: cita.placa || '',
      cliente: cita.nombre || '',
      telefono: cita.telefono || '',
      marca: marca || '',
      modelo: resto.join(' '),
      servicios: SERVICIOS[cita.servicio]?.label || cita.servicio || '',
      notas: cita.notas || '',
    });
    setShowCitaModal(null);
    setShowNewOrder(true);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!form.placa) return;
    try {
      const payload = {
        ...form,
        placa: form.placa.toUpperCase(),
        estado: 'Recepción',
        fecha: new Date().toISOString(),
        fotos: photos
      };
      await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setCreatedOrderData(payload);
      setForm(emptyForm);
      setPhotos([]);
      fetchOrders();
    } catch (e) {
      setFormStatus({ text: 'Error al crear la orden', type: 'error' });
    }
  };

  const analyzeExpenseImage = async (file) => {
    if (!file) return;
    setAnalyzingExpense(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${BACKEND_URL}/api/analyze-expense-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type })
      });
      if (!res.ok) throw new Error('Error del servidor');
      const data = await res.json();
      setExpenseForm(prev => ({
        ...prev,
        ...(data.fecha ? { fecha: data.fecha } : {}),
        ...(data.concepto ? { concepto: data.concepto } : {}),
        ...(data.monto ? { monto: String(data.monto) } : {}),
        ...(data.metodoPago ? { metodoPago: data.metodoPago } : {}),
        ...(data.categoria && EXPENSE_CATEGORIES.includes(data.categoria) ? { categoria: data.categoria } : {}),
      }));
    } catch (err) {
      alert('No se pudo analizar la imagen: ' + err.message);
    } finally {
      setAnalyzingExpense(false);
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if(!expenseForm.monto || !expenseForm.concepto) return;
    try {
      await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...expenseForm, monto: parseInt(expenseForm.monto) })
      });
      setExpenseForm({ fecha: new Date().toISOString().split('T')[0], concepto: '', monto: '', metodoPago: 'Efectivo', categoria: 'Repuestos' });
      fetchExpenses();
    } catch (e) { console.error(e); }
  };

  const handleDeleteExpense = async (id) => {
    try {
      await fetch(`${API_URL}/expenses/${id}`, { method: 'DELETE' });
      setDeleteExpenseId(null);
      fetchExpenses();
    } catch (e) { console.error(e); }
  };

  // Minimal renderer for chat replies: **bold**, *italic*, "• " bullets
  const renderChatText = (text) => String(text || '').split('\n').map((line, li) => {
    const parts = [];
    let rest = line;
    let key = 0;
    const regex = /\*\*(.+?)\*\*|\*(.+?)\*/;
    while (rest.length > 0) {
      const m = rest.match(regex);
      if (!m) { parts.push(rest); break; }
      if (m.index > 0) parts.push(rest.slice(0, m.index));
      if (m[1] !== undefined) parts.push(<strong key={key++}>{m[1]}</strong>);
      else parts.push(<em key={key++} style={{ opacity: 0.85 }}>{m[2]}</em>);
      rest = rest.slice(m.index + m[0].length);
    }
    const isBullet = line.trimStart().startsWith('• ');
    return (
      <div key={li} style={{ paddingLeft: isBullet ? '0.9rem' : 0, minHeight: line.trim() === '' ? '0.5rem' : undefined }}>
        {parts}
      </div>
    );
  });

  const handleChatSend = async (text) => {
    const msg = (text ?? chatInput).trim();
    if (!msg || chatLoading) return;
    const newMessages = [...chatMessages, { role: 'user', content: msg }];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat-analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.details].filter(Boolean).join(' — ') || 'Error del servidor');
      setChatMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      const msg = e.message === 'Failed to fetch'
        ? 'No se pudo conectar con el servidor. Los modelos de IA gratuitos tardaron demasiado o el servidor no respondió — intenta de nuevo en unos segundos.'
        : e.message;
      setChatMessages([...newMessages, { role: 'assistant', content: '⚠ Error: ' + msg }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, chatLoading]);

  const updateExpenseCategoria = async (id, categoria) => {
    try {
      await fetch(`${API_URL}/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria }),
      });
      fetchExpenses();
    } catch (e) { console.error(e); }
  };

  const fetchFleetUsers = () => {
    fetch(`${API_URL}/fleet_users`)
      .then(r => r.json()).then(d => setFleetUsers(Array.isArray(d) ? d : [])).catch(() => {});
  };

  const handleFleetUserSubmit = async (e) => {
    e.preventDefault();
    if (!fleetUserForm.nombre || !fleetUserForm.usuario || !fleetUserForm.password) return;
    try {
      await fetch(`${API_URL}/fleet_users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fleetUserForm, id: Date.now() })
      });
      setFleetUserForm({ nombre: '', empresa: 'ald', usuario: '', password: '' });
      setFleetUserStatus('Usuario creado correctamente.');
      setTimeout(() => setFleetUserStatus(''), 3000);
      fetchFleetUsers();
    } catch (e) { console.error(e); }
  };

  const handleDeleteFleetUser = async (id) => {
    await fetch(`${API_URL}/fleet_users/${id}`, { method: 'DELETE' });
    fetchFleetUsers();
  };

  const handleQuickOrder = async (e) => {
    e.preventDefault();
    if(!quickOrderForm.placa) return;
    try {
      const payload = {
        ...quickOrderForm,
        placa: quickOrderForm.placa.toUpperCase(),
        estado: 'Ingresos Rápidos',
        fecha: new Date().toISOString(),
        fotos: []
      };
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const newOrder = await res.json();
      setQuickOrderForm({ placa: '', cliente: '', marca: '', modelo: '', anio: '', servicios: '' });
      setSelectedOrder({ ...newOrder, reports: [], quotes: [] });
      fetchOrders();
    } catch (e) { console.error(e); }
  };

  const colColor = { 'Recepción': '#6366f1', 'Proceso': '#f59e0b', 'Calidad': '#10b981', 'Ingresos Rápidos': '#ec4899' };
  const colBg   = { 'Recepción': 'rgba(99,102,241,0.08)', 'Proceso': 'rgba(245,158,11,0.08)', 'Calidad': 'rgba(16,185,129,0.08)', 'Ingresos Rápidos': 'rgba(236,72,153,0.08)' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{`
        .gasto-label {
          display: block; font-size: 0.95rem; font-weight: 700; color: var(--text);
          margin-bottom: 0.4rem;
        }
        .gasto-main-row {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }
        .gasto-meta-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .gasto-submit-btn-v2 {
          width: 100%; justify-content: center; height: 54px;
          font-size: 1.05rem; gap: 0.5rem;
        }
        @media (max-width: 640px) {
          .gasto-main-row { grid-template-columns: 1fr; margin-bottom: 1rem; }
          .gasto-meta-row { grid-template-columns: 1fr; gap: 0.85rem; margin-bottom: 1.25rem; }
        }
        .gasto-ai-btn { display: flex; align-items: center; gap: 0.4rem; }
        @media (max-width: 480px) {
          .gasto-header-row { flex-direction: column; align-items: flex-start !important; gap: 0.75rem !important; }
          .gasto-ai-btn { width: 100%; justify-content: center; }
        }
        @media (max-width: 640px) {
          .admin-topbar { padding: 0.85rem 1rem !important; }
          .admin-topbar-actions { width: 100%; }
          .admin-topbar-actions .btn-secondary, .admin-topbar-actions .btn-primary {
            flex: 1 1 auto; justify-content: center; padding: 0.55rem 0.7rem; font-size: 0.85rem;
          }
        }
      `}</style>
      {/* Top nav */}
      <div className="admin-topbar" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, flexWrap: 'wrap', rowGap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart3 size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, lineHeight: 1 }}>Panel Admin</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Taller Automotriz</div>
          </div>
        </div>
          <div className="admin-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={toggleTheme} className="theme-toggle" title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} />
            <button className="btn-secondary" style={{ gap: '0.5rem' }} onClick={() => setShowPhotoUpload(true)}>
              <Camera size={16} /> Subir Foto
            </button>
            <button className="btn-primary" style={{ gap: '0.5rem' }} onClick={() => setShowNewOrder(true)}>
              <PlusCircle size={16} /> Nueva Orden
            </button>
          </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem 1.5rem 4rem' }}>
        {/* Stats row — current month with delta vs previous month */}
        {(() => {
          const now = new Date();
          const mIni = new Date(now.getFullYear(), now.getMonth(), 1);
          const mFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          const pIni = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          // Fair comparison: previous month cut at the same day we are today
          const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
          const pFin = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), prevMonthDays), 23, 59, 59, 999);
          const enRango = (f, a, b) => { if (!f) return false; const d = new Date(f); return d >= a && d <= b; };

          const factMes  = orders.filter(o => o.estado === 'Entregado' && enRango(o.fecha, mIni, mFin)).reduce((s, o) => s + calcOrderTotal(o), 0);
          const factPrev = orders.filter(o => o.estado === 'Entregado' && enRango(o.fecha, pIni, pFin)).reduce((s, o) => s + calcOrderTotal(o), 0);
          const gastMes  = expenses.filter(g => enRango(g.fecha, mIni, mFin)).reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
          const gastPrev = expenses.filter(g => enRango(g.fecha, pIni, pFin)).reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
          const ganMes = factMes - gastMes;
          const ganPrev = factPrev - gastPrev;
          const porFacturar = orders.filter(o => o.estado !== 'Entregado').reduce((s, o) => s + calcOrderTotal(o), 0);

          const Delta = ({ cur, prev, invert = false }) => {
            if (!prev) return <div className="sub">Sin datos del mes pasado</div>;
            const pct = ((cur - prev) / Math.abs(prev)) * 100;
            const up = pct >= 0;
            const good = invert ? !up : up;
            return (
              <div className="sub" style={{ color: good ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% vs mismo punto del mes pasado
              </div>
            );
          };

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
              <div className="stat-card">
                <div className="label">Órdenes Activas</div>
                <div className="value" style={{ color: '#818cf8' }}>{stats.active}</div>
                <div className="sub">En progreso actualmente</div>
              </div>
              <div className="stat-card">
                <div className="label">Facturado ({MESES[now.getMonth()]})</div>
                <div className="value">${fmt(factMes)}</div>
                <Delta cur={factMes} prev={factPrev} />
              </div>
              <div className="stat-card">
                <div className="label">Gastos ({MESES[now.getMonth()]})</div>
                <div className="value" style={{ color: 'var(--error)' }}>${fmt(gastMes)}</div>
                <Delta cur={gastMes} prev={gastPrev} invert />
              </div>
              <div className="stat-card">
                <div className="label">Ganancia ({MESES[now.getMonth()]})</div>
                <div className="value" style={{ color: ganMes >= 0 ? '#10b981' : '#ef4444' }}>${fmt(ganMes)}</div>
                <Delta cur={ganMes} prev={ganPrev} />
              </div>
              <div className="stat-card">
                <div className="label">Por Facturar</div>
                <div className="value" style={{ color: '#f59e0b' }}>${fmt(porFacturar)}</div>
                <div className="sub">Dinero en el taller (órdenes activas)</div>
              </div>
            </div>
          );
        })()}

        {/* Compact To-Do List Row */}
        <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '2rem', overflow: 'hidden' }}>
          <div style={{ flexShrink: 0, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <PlusCircle size={16} color="var(--primary)" />
              <h2 style={{ fontSize: '1rem', fontWeight: 800 }}>Tareas Pendientes</h2>
            </div>
            <form onSubmit={addTodo} style={{ display: 'flex', gap: '0.4rem' }}>
              <input type="text" placeholder="Nueva tarea..." value={newTodo} onChange={e => setNewTodo(e.target.value)} style={{ flex: 1, fontSize: '0.9rem', padding: '0.4rem 0.6rem' }} />
              <button type="submit" className="btn-primary" style={{ padding: '0.4rem' }}><PlusCircle size={16} /></button>
            </form>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem', flex: 1, scrollbarWidth: 'none' }}>
            {todos.filter(t => !t.completed).length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>No hay pendientes importantes hoy.</span>
            )}
            {todos.filter(t => !t.completed).map(t => (
              <div key={t.id} style={{ flexShrink: 0, padding: '0.5rem 0.85rem', background: 'var(--bg)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.6rem', border: '1px solid var(--border)', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={t.completed} onChange={() => toggleTodo(t)} style={{ cursor: 'pointer' }} />
                <span style={{ fontSize: '0.92rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{t.text}</span>
                <button onClick={() => deleteTodo(t.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 0, opacity: 0.4 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation — grouped dropdowns */}
            {(() => {
              const NAV_GROUPS = [
                {
                  id: 'operaciones', label: 'Operaciones', icon: <LayoutDashboard size={15} />,
                  items: [
                    { id: 'Kanban',           icon: <LayoutDashboard size={14} />, label: 'Kanban' },
                    { id: 'Historial',        icon: <History size={14} />,         label: 'Historial' },
                    { id: 'Ingresos Rápidos', icon: <Zap size={14} />,             label: 'Ingresos Rápidos' },
                  ]
                },
                {
                  id: 'finanzas', label: 'Finanzas', icon: <Receipt size={15} />,
                  items: [
                    { id: 'ALD',              icon: <CreditCard size={14} />, label: 'ALD / Ayvens' },
                    { id: 'ConsultNetworks',  icon: <CreditCard size={14} />, label: 'Consult Networks' },
                    { id: 'LaAscension',      icon: <CreditCard size={14} />, label: 'La Ascensión' },
                    { id: 'AsistenteIA',      icon: <Sparkles size={14} />,   label: 'Asistente IA' },
                  ]
                },
                {
                  id: 'herramientas', label: 'Herramientas', icon: <Settings size={15} />,
                  items: [
                    { id: 'Informes',      icon: <FileText size={14} />,     label: 'Generar Informe' },
                    { id: 'Formulario',    icon: <ClipboardList size={14} />, label: 'Formulario Técnico' },
                    { id: 'UsuariosFlota', icon: <Car size={14} />,           label: 'Usuarios Flota' },
                  ]
                },
              ];
              return (
                <div ref={navRef} style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {NAV_GROUPS.map(group => {
                    const activeItem = group.items.find(i => i.id === activeTab);
                    const isGroupActive = !!activeItem;
                    const isOpen = openMenu === group.id;
                    return (
                      <div key={group.id} style={{ position: 'relative' }}>
                        <button
                          onClick={() => setOpenMenu(isOpen ? null : group.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.9rem',
                            background: isGroupActive ? 'var(--primary)' : 'transparent',
                            color: isGroupActive ? 'white' : 'var(--text-muted)',
                            border: isGroupActive ? 'none' : '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.88rem', transition: 'all 0.15s',
                            whiteSpace: 'nowrap',
                          }}>
                          {activeItem ? activeItem.icon : group.icon}
                          {activeItem ? activeItem.label : group.label}
                          <ChevronDown size={13} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                        </button>
                        {isOpen && (
                          <div style={{
                            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: 10, padding: '0.3rem',
                            minWidth: 190, zIndex: 200,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                          }}>
                            {group.items.map(item => (
                              <button key={item.id}
                                onClick={() => { setActiveTab(item.id); setOpenMenu(null); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                                  width: '100%', padding: '0.5rem 0.75rem',
                                  background: activeTab === item.id ? 'var(--primary)' : 'transparent',
                                  color: activeTab === item.id ? 'white' : 'var(--text)',
                                  border: 'none', borderRadius: 7,
                                  cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                                  textAlign: 'left', transition: 'background 0.1s',
                                }}>
                                {item.icon} {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '0 0.2rem' }} />
                  <button
                    onClick={() => { setActiveTab('Gastos'); setOpenMenu(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.45rem 0.9rem',
                      background: activeTab === 'Gastos' ? 'var(--primary)' : 'transparent',
                      color: activeTab === 'Gastos' ? 'white' : 'var(--text-muted)',
                      border: activeTab === 'Gastos' ? 'none' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.88rem', transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}>
                    <Receipt size={15} />
                    Gastos
                  </button>
                  <button
                    onClick={() => { setActiveTab('Citas'); setOpenMenu(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.45rem 0.9rem',
                      background: activeTab === 'Citas' ? 'var(--primary)' : 'transparent',
                      color: activeTab === 'Citas' ? 'white' : 'var(--text-muted)',
                      border: activeTab === 'Citas' ? 'none' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.88rem', transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}>
                    <Calendar size={15} />
                    Calendario de Citas
                  </button>
                </div>
              );
            })()}

            {/* Tab Content */}
            {activeTab === 'Kanban' && (() => {
              const { date: corteDate, days: corteDays } = getNextCorteALD();
              const aldVehiculosMes = orders.filter(o => IS_FLOTA(o.cliente) && o.estado !== 'Entregado');
              const vencidas = aldBillings.filter(b => !b.pagado && b.fechaVencimiento && new Date(b.fechaVencimiento) < new Date());
              const corteColor = corteDays <= 3 ? '#ef4444' : corteDays <= 7 ? '#f59e0b' : '#10b981';
              const corteBg = corteDays <= 3 ? 'rgba(239,68,68,0.1)' : corteDays <= 7 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)';
              return (<>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: corteBg, border: `1px solid ${corteColor}`, borderRadius: 10, padding: '0.6rem 1.1rem', flex: '0 0 auto' }}>
                  <Clock size={18} color={corteColor} />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: corteColor, textTransform: 'uppercase', lineHeight: 1 }}>Próximo corte ALD</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: corteColor, lineHeight: 1.3 }}>
                      {corteDays === 0 ? '¡Hoy!' : `${corteDays} día${corteDays !== 1 ? 's' : ''}`}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      20 de {MESES[corteDate.getMonth()]} · {aldVehiculosMes.length} vehículo{aldVehiculosMes.length !== 1 ? 's' : ''} ALD activo{aldVehiculosMes.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                {vencidas.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 10, padding: '0.6rem 1.1rem', cursor: 'pointer', flex: '0 0 auto' }} onClick={() => setActiveTab('ALD')}>
                    <Ban size={18} color="#ef4444" />
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', lineHeight: 1 }}>Pago vencido</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ef4444', lineHeight: 1.3 }}>{vencidas.length} factura{vencidas.length !== 1 ? 's' : ''}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ver en pestaña ALD</div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                {COLUMNS.map(col => (
                  <div key={col} className="kanban-column">
                    <div className="kanban-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: colColor[col], display: 'inline-block' }}></span>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{col}</span>
                      </div>
                      <span style={{ background: colBg[col], color: colColor[col], borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.85rem', fontWeight: 700 }}>
                        {orders.filter(o => o.estado === col).length}
                      </span>
                    </div>

                    {orders.filter(o => o.estado === col).map(o => (
                      <div key={o.id} className="kanban-card" onClick={() => setSelectedOrder(o)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{o.placa}</div>
                              {o.quotes?.some(q => q.autorizada) && (
                                <span title="Trabajo Autorizado" style={{ color: '#10b981', display: 'flex' }}><CheckCircle size={14} /></span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{o.marca} {o.modelo}</div>
                            {getPicoYPlaca(o.placa) && (
                              <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 800, marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <AlertTriangle size={10} /> {getPicoYPlaca(o.placa)}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: '0.82rem', background: o.reports?.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: o.reports?.length > 0 ? '#34d399' : '#fbbf24', padding: '0.2rem 0.5rem', borderRadius: 999, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {o.reports?.length > 0 ? '✓ Revisado' : '⏳ Pdte'}
                          </span>
                        </div>
                        {o.fecha && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={10} /> Ingreso: {new Date(o.fecha).toLocaleDateString('es-CO')}
                          </div>
                        )}
                        {(() => {
                          const items = o.quotes?.[0]?.items || [];
                          const ap = items.filter(it => it.aprobadoFlota === true).length;
                          const rech = items.filter(it => it.aprobadoFlota === false).length;
                          if (ap === 0 && rech === 0) return null;
                          return (
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, marginTop: '0.3rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                              {ap > 0 && <span style={{ color: '#10b981' }}>✅ {ap} ap.</span>}
                              {rech > 0 && <span style={{ color: '#ef4444' }}>❌ {rech} rech.</span>}
                            </div>
                          );
                        })()}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{o.cliente}</span>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <select
                              value={o.estado}
                              onClick={e => e.stopPropagation()}
                              onChange={e => { e.stopPropagation(); moveOrder(o.id, e.target.value); }}
                              style={{ fontSize: '0.85rem', padding: '0.2rem 0.4rem', width: 'auto', borderRadius: 6 }}>
                              {COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
                              <option value="Entregado">Entregar ✅</option>
                            </select>
                            <button onClick={e => { e.stopPropagation(); deleteOrder(o.id); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', padding: '0.2rem' }} title="Eliminar orden">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {orders.filter(o => o.estado === col).length === 0 && (
                      <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>Sin órdenes</div>
                    )}
                  </div>
                ))}
              </div>
              </>);
            })()}

            {activeTab === 'Citas' && (() => {
              const year = citasMonth.getFullYear();
              const month = citasMonth.getMonth();
              const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // lunes=0 ... domingo=6
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const hoy = new Date();
              // Fecha local (no toISOString, que es UTC y en Colombia -horario UTC-5-
              // salta al día siguiente desde las 7pm), para que "Hoy" y el resaltado
              // del día coincidan con la fecha real del usuario.
              const todayStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
              const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

              const citasPorFecha = {};
              citas.forEach(c => {
                if (!citasPorFecha[c.fecha]) citasPorFecha[c.fecha] = [];
                citasPorFecha[c.fecha].push(c);
              });

              const celdas = [];
              for (let i = 0; i < startOffset; i++) celdas.push(null);
              for (let d = 1; d <= daysInMonth; d++) celdas.push(d);

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button className="btn-secondary" onClick={() => setCitasMonth(new Date(year, month - 1, 1))}>‹</button>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 160, textAlign: 'center' }}>{MESES_LARGO[month]} {year}</span>
                      <button className="btn-secondary" onClick={() => setCitasMonth(new Date(year, month + 1, 1))}>›</button>
                      <button className="btn-secondary" onClick={() => setCitasMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoy</button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn-secondary" onClick={() => setShowRecordatorios(true)}>
                        <MessageCircle size={16} /> Recordatorios
                      </button>
                      <button className="btn-primary" onClick={() => setShowCitaModal({ mode: 'create', fecha: todayStr })}>
                        <Plus size={16} /> Nueva Cita
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
                      <div key={d} style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{d}</div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
                    {celdas.map((d, i) => {
                      if (d === null) return <div key={`pad-${i}`} />;
                      const fecha = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const citasDia = (citasPorFecha[fecha] || []).slice().sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
                      const isToday = fecha === todayStr;
                      return (
                        <div key={fecha}
                          onClick={() => setShowCitaModal({ mode: 'create', fecha })}
                          style={{ minHeight: 92, border: `1px solid ${isToday ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8, padding: '0.4rem', cursor: 'pointer', background: 'var(--bg-card)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--primary)' : 'var(--text)', marginBottom: '0.3rem' }}>{d}</div>
                          {citasDia.slice(0, 3).map(c => (
                            <div key={c.id}
                              onClick={e => { e.stopPropagation(); setShowCitaModal({ mode: 'edit', cita: c }); }}
                              title={`${c.nombre} — ${SERVICIOS[c.servicio]?.label || c.servicio}`}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', marginBottom: '0.2rem', padding: '0.15rem 0.3rem', borderRadius: 4, background: 'var(--bg)', cursor: 'pointer' }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: SERVICIOS[c.servicio]?.hex || '#94a3b8', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.placa} {c.hora}</span>
                            </div>
                          ))}
                          {citasDia.length > 3 && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>+{citasDia.length - 3} más</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {activeTab === 'Historial' && (() => {
              const entregadas = orders.filter(o => o.estado === 'Entregado');
              const filtradas = entregadas.filter(o => {
                const matchPlaca = !historialSearch || o.placa?.toUpperCase().includes(historialSearch.toUpperCase());
                const fechaOrden = o.fecha ? new Date(o.fecha) : null;
                const matchDesde = !historialDesde || (fechaOrden && fechaOrden >= new Date(historialDesde));
                const matchHasta = !historialHasta || (fechaOrden && fechaOrden <= new Date(historialHasta + 'T23:59:59'));
                return matchPlaca && matchDesde && matchHasta;
              });
              return (
                <div className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                      Órdenes Entregadas <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '1rem' }}>({filtradas.length}{filtradas.length !== entregadas.length ? ` de ${entregadas.length}` : ''})</span>
                    </h2>
                    {(historialSearch || historialDesde || historialHasta) && (
                      <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }} onClick={() => { setHistorialSearch(''); setHistorialDesde(''); setHistorialHasta(''); }}>
                        Limpiar filtros
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 180px', minWidth: 150 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Buscar placa</label>
                      <input
                        type="text"
                        placeholder="Ej: ABC123"
                        value={historialSearch}
                        onChange={e => setHistorialSearch(e.target.value.toUpperCase())}
                        style={{ width: '100%', fontWeight: 700, letterSpacing: 1 }}
                      />
                    </div>
                    <div style={{ flex: '1 1 150px', minWidth: 140 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Desde</label>
                      <input type="date" value={historialDesde} onChange={e => setHistorialDesde(e.target.value)} style={{ width: '100%' }} />
                    </div>
                    <div style={{ flex: '1 1 150px', minWidth: 140 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Hasta</label>
                      <input type="date" value={historialHasta} onChange={e => setHistorialHasta(e.target.value)} style={{ width: '100%' }} />
                    </div>
                  </div>

                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Placa</th>
                        <th>Cliente</th>
                        <th>Vehículo</th>
                        <th>Ingreso</th>
                        <th>Entrega</th>
                        <th>Método Pago</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.length === 0 && (
                        <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          {entregadas.length === 0 ? 'No hay órdenes entregadas.' : 'Sin resultados para los filtros aplicados.'}
                        </td></tr>
                      )}
                      {filtradas.map(o => {
                        return (
                        <tr key={o.id}>
                          <td style={{ fontWeight: 700 }}>{o.placa}</td>
                          <td>{o.cliente}</td>
                          <td>{o.marca} {o.modelo}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                            {o.fecha ? new Date(o.fecha).toLocaleDateString('es-CO') : '—'}
                          </td>
                          <td style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                            {o.fechaEntrega
                              ? <span style={{ color: '#10b981', fontWeight: 700 }}>{new Date(o.fechaEntrega).toLocaleDateString('es-CO')}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td><span className="badge badge-blue" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', border: 'none' }}>{o.metodoPago || 'Efectivo'}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.9rem' }} onClick={() => setSelectedOrder(o)}>Ver Detalle</button>
                              <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.9rem', color: 'var(--error)' }} onClick={() => deleteOrder(o.id)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {activeTab === 'Formulario' && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Configuración del Formulario</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Edita las categorías e ítems que aparecen en la revisión preventiva para los técnicos</p>
                  </div>
                  <button className="btn-primary" onClick={() => saveConfig(formConfig)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Save size={18} /> Guardar Cambios
                  </button>
                </div>

                {formStatus.text && <div className={`toast toast-${formStatus.type}`} style={{ marginBottom: '1.5rem' }}>{formStatus.text}</div>}

                {!formConfig ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando configuración...</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {Object.entries(formConfig).map(([cat, items]) => (
                      <div key={cat} className="card" style={{ padding: '1.25rem', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>{cat}</h3>
                          <button onClick={() => {
                            if(window.confirm(`¿Eliminar la categoría "${cat}" y todos sus ítems?`)) {
                              const newCfg = { ...formConfig };
                              delete newCfg[cat];
                              setFormConfig(newCfg);
                            }
                          }} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }} title="Eliminar categoría">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                              <span style={{ fontSize: '1rem' }}>{item}</span>
                              <button onClick={() => {
                                const newItems = items.filter((_, i) => i !== idx);
                                setFormConfig({ ...formConfig, [cat]: newItems });
                              }} style={{ opacity: 0.5, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)' }}>
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <input 
                              type="text" 
                              placeholder="Nuevo ítem..." 
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    setFormConfig({ ...formConfig, [cat]: [...items, val] });
                                    e.target.value = '';
                                  }
                                }
                              }}
                              style={{ flex: 1, fontSize: '0.9rem', padding: '0.4rem' }} 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="card" style={{ padding: '1.25rem', border: '2px dashed var(--border)', background: 'transparent', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, textAlign: 'center', color: 'var(--text-muted)' }}>Nueva Categoría</h3>
                      <input 
                        type="text" 
                        placeholder="Ej: Iluminación o Interiores" 
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        style={{ padding: '0.6rem' }}
                      />
                      <button className="btn-secondary" style={{ fontWeight: 700 }} onClick={() => {
                        if (newCategoryName.trim()) {
                          setFormConfig({ ...formConfig, [newCategoryName.trim()]: [] });
                          setNewCategoryName('');
                        }
                      }}>Añadir Categoría</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(() => {
              const BILLING_TABS = {
                ALD: {
                  clientFilter: IS_FLOTA, billings: aldBillings, collection: 'ald_billings',
                  onRefreshBillings: fetchAldBillings, title: 'Flotas (ALD / Ayvens)',
                  emptyMsg: 'No hay vehículos de flota entregados aún.', noCutDate: false, paymentDays: 30,
                },
                ConsultNetworks: {
                  clientFilter: IS_CN, billings: cnBillings, collection: 'cn_billings',
                  onRefreshBillings: fetchCnBillings, title: 'Consult Networks',
                  emptyMsg: 'No hay vehículos de Consult Networks entregados aún.', noCutDate: true, paymentDays: 30,
                },
                LaAscension: {
                  clientFilter: IS_LA_ASCENSION, billings: laAscensionBillings, collection: 'la_ascension_billings',
                  onRefreshBillings: fetchLaAscensionBillings, title: 'La Ascensión',
                  emptyMsg: 'No hay vehículos de La Ascensión entregados aún.', noCutDate: true, paymentDays: 15,
                },
              };
              const cfg = BILLING_TABS[activeTab];
              if (!cfg) return null;
              return (
                <BillingCycleTab
                  orders={orders}
                  clientFilter={cfg.clientFilter}
                  billings={cfg.billings}
                  collection={cfg.collection}
                  onRefreshBillings={cfg.onRefreshBillings}
                  onRefreshOrders={fetchOrders}
                  title={cfg.title}
                  emptyMsg={cfg.emptyMsg}
                  noCutDate={cfg.noCutDate}
                  paymentDays={cfg.paymentDays}
                  onOrderClick={setSelectedOrder}
                />
              );
            })()}

            {activeTab === 'UsuariosFlota' && (
              <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Add user form */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Nuevo usuario de flota</h2>
                  {fleetUserStatus && <div className="toast toast-success" style={{ marginBottom: '1rem' }}>{fleetUserStatus}</div>}
                  <form onSubmit={handleFleetUserSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Nombre</label>
                        <input required placeholder="Ej. Ayvens Manager" value={fleetUserForm.nombre} onChange={e => setFleetUserForm({...fleetUserForm, nombre: e.target.value})} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Empresa</label>
                        <select value={fleetUserForm.empresa} onChange={e => setFleetUserForm({...fleetUserForm, empresa: e.target.value})} style={{ width: '100%' }}>
                          <option value="ald">ALD / Ayvens</option>
                          <option value="cn">Consult Networks</option>
                          <option value="both">Ambas</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Usuario</label>
                        <input required placeholder="usuario_login" value={fleetUserForm.usuario} onChange={e => setFleetUserForm({...fleetUserForm, usuario: e.target.value.toLowerCase().replace(/\s/g, '_')})} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Contraseña</label>
                        <input required type="password" placeholder="••••••" value={fleetUserForm.password} onChange={e => setFleetUserForm({...fleetUserForm, password: e.target.value})} style={{ width: '100%' }} />
                      </div>
                      <button type="submit" className="btn-primary" style={{ height: 38, whiteSpace: 'nowrap' }}>+ Crear usuario</button>
                    </div>
                  </form>
                </div>

                {/* Users table */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Usuarios activos ({fleetUsers.length})</h2>
                  {fleetUsers.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay usuarios de flota configurados.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr><th>Nombre</th><th>Empresa</th><th>Usuario</th><th>Contraseña</th><th></th></tr>
                      </thead>
                      <tbody>
                        {fleetUsers.map(u => (
                          <tr key={u.id}>
                            <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                            <td>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 99,
                                background: u.empresa === 'ald' ? 'rgba(245,158,11,0.15)' : u.empresa === 'cn' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)',
                                color: u.empresa === 'ald' ? '#f59e0b' : u.empresa === 'cn' ? 'var(--primary)' : '#10b981' }}>
                                {u.empresa === 'ald' ? 'ALD / Ayvens' : u.empresa === 'cn' ? 'Consult Networks' : 'Ambas'}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{u.usuario}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{'•'.repeat(Math.min((u.password||'').length, 8))}</td>
                            <td>
                              <button onClick={() => handleDeleteFleetUser(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', display: 'flex', padding: '0.2rem' }} title="Eliminar usuario">
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <strong>Acceso:</strong> Los usuarios de flota ingresan por la pantalla de login seleccionando "Portal Flotas" con su usuario y contraseña.
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Gastos' && (() => {
              // ── Stats range ──────────────────────────────────────────
              const getGastosStatsRange = () => {
                const now = new Date();
                if (gastosStatsPeriod === 'hoy') {
                  const desde = new Date(now); desde.setHours(0,0,0,0);
                  const hasta = new Date(now); hasta.setHours(23,59,59,999);
                  return { desde, hasta };
                }
                if (['7d','30d','90d'].includes(gastosStatsPeriod)) {
                  const days = parseInt(gastosStatsPeriod);
                  const hasta = new Date(now); hasta.setHours(23,59,59,999);
                  const desde = new Date(now); desde.setDate(desde.getDate() - (days - 1)); desde.setHours(0,0,0,0);
                  return { desde, hasta };
                }
                if (gastosStatsPeriod === 'semana') {
                  const day = now.getDay() || 7;
                  const desde = new Date(now); desde.setDate(now.getDate() - day + 1); desde.setHours(0,0,0,0);
                  const hasta = new Date(desde); hasta.setDate(desde.getDate() + 6); hasta.setHours(23,59,59,999);
                  return { desde, hasta };
                }
                if (gastosStatsPeriod === 'mes') {
                  return { desde: new Date(now.getFullYear(), now.getMonth(), 1), hasta: new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999) };
                }
                if (gastosStatsPeriod === 'año') {
                  return { desde: new Date(now.getFullYear(), 0, 1), hasta: new Date(now.getFullYear(), 11, 31, 23,59,59,999) };
                }
                return { desde: gastosStatsDesde ? new Date(gastosStatsDesde) : null, hasta: gastosStatsHasta ? new Date(gastosStatsHasta+'T23:59:59') : null };
              };
              const { desde: sDesde, hasta: sHasta } = getGastosStatsRange();
              const inStatRange = f => { if (!f) return false; const d = new Date(f); return (!sDesde || d >= sDesde) && (!sHasta || d <= sHasta); };
              const ordenesPeriodo    = orders.filter(o => o.estado === 'Entregado' && inStatRange(o.fecha));
              const gastosPeriodo     = expenses.filter(g => inStatRange(g.fecha));
              const ingresosPeriodo   = ordenesPeriodo.reduce((s, o) => s + calcOrderTotal(o), 0);
              const gastosTotalPeriodo= gastosPeriodo.reduce((s, g) => s + (parseFloat(g.monto)||0), 0);
              const ganancia          = ingresosPeriodo - gastosTotalPeriodo;
              const ticketProm        = ordenesPeriodo.length > 0 ? ingresosPeriodo / ordenesPeriodo.length : 0;
              const ivaPeriodo        = ordenesPeriodo.reduce((s, o) => s + calcOrderIva(o), 0);
              const margenPct         = ingresosPeriodo > 0 ? (ganancia / ingresosPeriodo) * 100 : null;

              // ── Previous period (for % deltas) ────────────────────────
              const getPrevGastosRange = () => {
                const now2 = new Date();
                if (gastosStatsPeriod === 'mes') {
                  // Compare against the same elapsed portion of the previous month
                  const prevDays = new Date(now2.getFullYear(), now2.getMonth(), 0).getDate();
                  return { desde: new Date(now2.getFullYear(), now2.getMonth()-1, 1), hasta: new Date(now2.getFullYear(), now2.getMonth()-1, Math.min(now2.getDate(), prevDays), 23,59,59,999) };
                }
                if (gastosStatsPeriod === 'año') return { desde: new Date(now2.getFullYear()-1, 0, 1), hasta: new Date(now2.getFullYear()-1, now2.getMonth(), now2.getDate(), 23,59,59,999) };
                if (gastosStatsPeriod === 'semana' && sDesde) { const d = new Date(sDesde); d.setDate(d.getDate()-7); const h = new Date(sDesde.getTime()-1); return { desde: d, hasta: h }; }
                if (sDesde && sHasta) { const len = sHasta - sDesde; return { desde: new Date(sDesde.getTime()-len-1), hasta: new Date(sDesde.getTime()-1) }; }
                return { desde: null, hasta: null };
              };
              const { desde: pDesde, hasta: pHasta } = getPrevGastosRange();
              const inPrevRange = f => { if (!f || !pDesde || !pHasta) return false; const d = new Date(f); return d >= pDesde && d <= pHasta; };
              const ordenesPrev  = orders.filter(o => o.estado === 'Entregado' && inPrevRange(o.fecha));
              const ingresosPrev = ordenesPrev.reduce((s, o) => s + calcOrderTotal(o), 0);
              const gastosPrev   = expenses.filter(g => inPrevRange(g.fecha)).reduce((s, g) => s + (parseFloat(g.monto)||0), 0);
              const gananciaPrev = ingresosPrev - gastosPrev;
              const ticketPrev   = ordenesPrev.length > 0 ? ingresosPrev / ordenesPrev.length : 0;

              // ── Breakdown by category ─────────────────────────────────
              const catTotals = {};
              gastosPeriodo.forEach(g => { const c = g.categoria || 'Sin categoría'; catTotals[c] = (catTotals[c] || 0) + (parseFloat(g.monto) || 0); });
              const catList = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
              const catMax = catList.length > 0 ? catList[0][1] : 1;

              // ── Top clients & services (accent/case-insensitive merge) ─
              const normKey = s => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
              const clienteTotals = {};
              ordenesPeriodo.forEach(o => {
                const name = (o.cliente || '—').trim();
                const k = normKey(name);
                if (!clienteTotals[k]) clienteTotals[k] = { name, total: 0 };
                clienteTotals[k].total += calcOrderTotal(o);
              });
              const topClientes = Object.values(clienteTotals).sort((a, b) => b.total - a.total).slice(0, 5).map(c => [c.name, c.total]);

              const servTotals = {};
              ordenesPeriodo.forEach(o => {
                const q = o.quotes?.find(q => q.autorizada) || o.quotes?.[0];
                (q?.items || []).forEach(it => {
                  const d = (it.descripcion || '').trim();
                  if (!d) return;
                  const k = normKey(d);
                  if (!servTotals[k]) servTotals[k] = { name: d, count: 0, total: 0 };
                  servTotals[k].count += Number(it.cantidad) || 1;
                  servTotals[k].total += (Number(it.precio) || 0) * (Number(it.cantidad) || 1);
                });
              });
              const topServicios = Object.values(servTotals).sort((a, b) => b.total - a.total).slice(0, 5).map(s => [s.name, s]);

              const deltaPct = (cur, prev) => (prev && prev !== 0) ? ((cur - prev) / Math.abs(prev)) * 100 : null;

              // ── Balances by payment method, scoped to the selected period ──
              const balancesPeriodo = {};
              PAYMENT_METHODS.forEach(m => {
                const ingresos = ordenesPeriodo
                  .filter(o => o.metodoPago === m || (!o.metodoPago && m === 'Efectivo'))
                  .reduce((s, o) => s + calcOrderTotal(o), 0);
                const egresos = gastosPeriodo
                  .filter(g => g.metodoPago === m)
                  .reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
                balancesPeriodo[m] = Math.round(ingresos - egresos);
              });

              // ── Trend buckets (follows the selected period + grouping) ──
              const trendBuckets = (() => {
                if (!sDesde || !sHasta) return [];
                const buckets = [];
                if (gastosAgrupar === 'mes') {
                  let d = new Date(sDesde.getFullYear(), sDesde.getMonth(), 1);
                  while (d <= sHasta && buckets.length < 48) {
                    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
                    buckets.push({ start: new Date(d), end, label: `${MESES[d.getMonth()].slice(0,3)} ${String(d.getFullYear()).slice(2)}`, ingresos: 0, gastos: 0 });
                    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
                  }
                } else if (gastosAgrupar === 'semana') {
                  let d = new Date(sDesde); const dow = d.getDay() || 7; d.setDate(d.getDate() - dow + 1); d.setHours(0,0,0,0);
                  while (d <= sHasta && buckets.length < 80) {
                    const end = new Date(d); end.setDate(end.getDate() + 6); end.setHours(23,59,59,999);
                    buckets.push({ start: new Date(d), end, label: `${d.getDate()} ${MESES[d.getMonth()].slice(0,3).toLowerCase()}`, ingresos: 0, gastos: 0 });
                    d = new Date(d); d.setDate(d.getDate() + 7);
                  }
                } else {
                  let d = new Date(sDesde); d.setHours(0,0,0,0);
                  while (d <= sHasta && buckets.length < 190) {
                    const end = new Date(d); end.setHours(23,59,59,999);
                    buckets.push({ start: new Date(d), end, label: `${d.getDate()}/${d.getMonth()+1}`, ingresos: 0, gastos: 0 });
                    d = new Date(d); d.setDate(d.getDate() + 1);
                  }
                }
                orders.filter(o => o.estado === 'Entregado' && o.fecha).forEach(o => {
                  const t = new Date(o.fecha);
                  const b = buckets.find(x => t >= x.start && t <= x.end);
                  if (b) b.ingresos += calcOrderTotal(o);
                });
                expenses.forEach(g => {
                  if (!g.fecha) return;
                  const t = new Date(g.fecha);
                  const b = buckets.find(x => t >= x.start && t <= x.end);
                  if (b) b.gastos += parseFloat(g.monto) || 0;
                });
                buckets.forEach(b => { b.utilidad = b.ingresos - b.gastos; });
                return buckets;
              })();
              const trendHasData = trendBuckets.some(b => b.ingresos > 0 || b.gastos > 0);

              // ── Printable period report ─────────────────────────────────
              const generarReporte = () => {
                const fmtDate = d => d ? d.toLocaleDateString('es-CO') : '—';
                const periodo = `${fmtDate(sDesde)} — ${fmtDate(sHasta)}`;
                const kpiRow = (l, v) => `<tr><td>${l}</td><td style="text-align:right;font-weight:700">${v}</td></tr>`;
                const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Reporte Financiero — Taller Automotriz</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a202c; margin: 2rem auto; max-width: 800px; padding: 0 1.5rem; }
  h1 { font-size: 1.4rem; margin-bottom: 0.2rem; }
  .muted { color: #718096; font-size: 0.85rem; }
  h2 { font-size: 1rem; margin: 1.8rem 0 0.6rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.3rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  td, th { padding: 0.45rem 0.6rem; border-bottom: 1px solid #edf2f7; }
  th { text-align: left; background: #f7fafc; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: #4a5568; }
  .pos { color: #059669; } .neg { color: #dc2626; }
  .print-btn { position: fixed; top: 1rem; right: 1rem; padding: 0.6rem 1.2rem; background: #1a202c; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; }
  @media print { .print-btn { display: none; } body { margin: 0.5rem; } }
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨 Imprimir / PDF</button>
<h1>Reporte Financiero — Taller Automotriz</h1>
<div class="muted">Período: ${periodo} &nbsp;·&nbsp; Generado: ${new Date().toLocaleString('es-CO')}</div>

<h2>Resumen del período</h2>
<table>
${kpiRow('Vehículos atendidos (entregados)', ordenesPeriodo.length)}
${kpiRow('Ingresos', '$' + fmt(ingresosPeriodo))}
${kpiRow('Gastos', '$' + fmt(gastosTotalPeriodo))}
${kpiRow('Utilidad neta', `<span class="${ganancia >= 0 ? 'pos' : 'neg'}">$${fmt(ganancia)}</span>`)}
${kpiRow('Margen', margenPct == null ? '—' : margenPct.toFixed(1) + '%')}
${kpiRow('Ticket promedio', '$' + fmt(ticketProm))}
${kpiRow('IVA generado (DIAN)', '$' + fmt(ivaPeriodo))}
</table>

<h2>Tendencia (${gastosAgrupar === 'dia' ? 'por día' : gastosAgrupar === 'semana' ? 'por semana' : 'por mes'})</h2>
<table><thead><tr><th>Fecha</th><th style="text-align:right">Ingresos</th><th style="text-align:right">Gastos</th><th style="text-align:right">Utilidad</th></tr></thead><tbody>
${trendBuckets.filter(b => b.ingresos > 0 || b.gastos > 0).map(b => `<tr><td>${b.label}</td><td style="text-align:right">$${fmt(b.ingresos)}</td><td style="text-align:right">$${fmt(b.gastos)}</td><td style="text-align:right" class="${b.utilidad >= 0 ? 'pos' : 'neg'}">$${fmt(b.utilidad)}</td></tr>`).join('')}
</tbody></table>

<h2>Top clientes del período</h2>
<table><tbody>
${topClientes.map(([c, t], i) => `<tr><td>${i+1}. ${c}</td><td style="text-align:right;font-weight:700">$${fmt(t)}</td></tr>`).join('') || '<tr><td class="muted">Sin datos</td></tr>'}
</tbody></table>

<h2>Servicios más vendidos</h2>
<table><tbody>
${topServicios.map(([s, d2]) => `<tr><td>${s} <span class="muted">×${d2.count}</span></td><td style="text-align:right;font-weight:700">$${fmt(d2.total)}</td></tr>`).join('') || '<tr><td class="muted">Sin datos</td></tr>'}
</tbody></table>

<h2>Gastos por categoría</h2>
<table><tbody>
${catList.map(([c, t]) => `<tr><td>${c}</td><td style="text-align:right;font-weight:700">$${fmt(t)} <span class="muted">(${gastosTotalPeriodo > 0 ? ((t/gastosTotalPeriodo)*100).toFixed(0) : 0}%)</span></td></tr>`).join('') || '<tr><td class="muted">Sin gastos en el período</td></tr>'}
</tbody></table>

<h2>Saldos por método de pago (del período)</h2>
<table><tbody>
${PAYMENT_METHODS.map(m => `<tr><td>${m}</td><td style="text-align:right;font-weight:700" class="${(balancesPeriodo[m]||0) >= 0 ? 'pos' : 'neg'}">$${fmt(balancesPeriodo[m]||0)}</td></tr>`).join('')}
</tbody></table>
</body></html>`;
                const w = window.open('', '_blank');
                if (!w) { alert('Permite las ventanas emergentes para generar el reporte.'); return; }
                w.document.write(html);
                w.document.close();
              };

              // ── Expenses table filters ────────────────────────────────
              const qG = gastosSearch.trim().toLowerCase();
              const filteredExpenses = expenses
                .filter(g => gastosMetodo === 'Todos' || g.metodoPago === gastosMetodo)
                .filter(g => gastosCategoria === 'Todas' || (g.categoria || 'Sin categoría') === gastosCategoria)
                .filter(g => !qG || (g.concepto||'').toLowerCase().includes(qG))
                .filter(g => {
                  if (!g.fecha) return !gastosDesde && !gastosHasta;
                  const d = new Date(g.fecha);
                  if (gastosDesde && d < new Date(gastosDesde)) return false;
                  if (gastosHasta && d > new Date(gastosHasta+'T23:59:59')) return false;
                  return true;
                })
                .sort((a,b) => new Date(b.fecha||0) - new Date(a.fecha||0));
              const filteredTotal = filteredExpenses.reduce((s,g) => s+(parseFloat(g.monto)||0), 0);
              const hasGastoFilters = qG || gastosDesde || gastosHasta || gastosMetodo !== 'Todos' || gastosCategoria !== 'Todas';

              const exportGastosCsv = () => {
                const rows = [
                  ['Fecha', 'Concepto', 'Categoría', 'Método de Pago', 'Monto'],
                  ...filteredExpenses.map(g => [
                    g.fecha ? new Date(g.fecha).toLocaleDateString('es-CO') : '',
                    (g.concepto || '').replace(/"/g, '""'),
                    g.categoria || 'Sin categoría',
                    g.metodoPago || '',
                    parseFloat(g.monto) || 0,
                  ]),
                ];
                const csv = '﻿' + rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `gastos_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

                  {/* ── ROW 1: Quick entry + AI scan ─────────────────── */}
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <div className="gasto-header-row" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', gap:'0.75rem' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.65rem' }}>
                        <div style={{ width:38, height:38, borderRadius:10, background:'rgba(99,102,241,0.12)', color:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Receipt size={19} />
                        </div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Registrar un Gasto</h2>
                      </div>
                      <input type="file" accept="image/*" ref={expenseImageInputRef} style={{ display:'none' }} onChange={e => { analyzeExpenseImage(e.target.files[0]); e.target.value=''; }} />
                      <button type="button" className="gasto-ai-btn" onClick={() => expenseImageInputRef.current?.click()} disabled={analyzingExpense}
                        style={{ padding:'0.55rem 1.1rem', background: analyzingExpense ? 'var(--bg)' : 'rgba(99,102,241,0.1)', color:'var(--primary)', border:'1.5px dashed var(--primary)', borderRadius:'var(--radius-sm)', cursor: analyzingExpense ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:'0.88rem', opacity: analyzingExpense ? 0.7 : 1, whiteSpace:'nowrap' }}>
                        <Sparkles size={15} />{analyzingExpense ? 'Analizando...' : 'Tomar Foto del Recibo'}
                      </button>
                    </div>
                    <form onSubmit={handleExpenseSubmit}>
                      <div className="gasto-main-row">
                        <div className="gasto-concepto-field">
                          <label className="gasto-label">¿Qué compraste?</label>
                          <input type="text" required placeholder="Ej. Aceite de motor, repuestos..." value={expenseForm.concepto} onChange={e => setExpenseForm({...expenseForm, concepto: e.target.value})} style={{ width:'100%', fontSize:'1.05rem' }} />
                        </div>
                        <div className="gasto-monto-field">
                          <label className="gasto-label">¿Cuánto costó?</label>
                          <div style={{ position:'relative' }}>
                            <span style={{ position:'absolute', left:'1rem', top:'50%', transform:'translateY(-50%)', fontSize:'1.3rem', fontWeight:800, color:'var(--success)', pointerEvents:'none' }}>$</span>
                            <input type="text" inputMode="numeric" required placeholder="0" className="price-input"
                              value={fmtMiles(expenseForm.monto)}
                              onChange={e => setExpenseForm({ ...expenseForm, monto: e.target.value.replace(/\D/g, '') })}
                              style={{ width:'100%', paddingLeft:'2.15rem', fontSize:'1.3rem', fontWeight:800 }} />
                          </div>
                        </div>
                      </div>

                      <div className="gasto-meta-row">
                        <div>
                          <label className="gasto-label">Fecha</label>
                          <input type="date" required value={expenseForm.fecha} onChange={e => setExpenseForm({...expenseForm, fecha: e.target.value})} style={{ width:'100%' }} />
                        </div>
                        <div>
                          <label className="gasto-label">Categoría</label>
                          <select value={expenseForm.categoria} onChange={e => setExpenseForm({...expenseForm, categoria: e.target.value})} style={{ width:'100%' }}>
                            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="gasto-label">Método de Pago</label>
                          <select value={expenseForm.metodoPago} onChange={e => setExpenseForm({...expenseForm, metodoPago: e.target.value})} style={{ width:'100%' }}>
                            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      </div>

                      <button type="submit" className="btn-primary gasto-submit-btn-v2">
                        <PlusCircle size={20} /> Guardar Gasto
                      </button>
                    </form>
                  </div>

                  {/* ── ROW 2: Stats ─────────────────────────────────── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Period pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Estadísticas:</span>
                      {[
                        {k:'hoy',l:'Hoy',g:'dia'},{k:'7d',l:'7 días',g:'dia'},{k:'30d',l:'30 días',g:'dia'},{k:'90d',l:'90 días',g:'semana'},
                        {k:'mes',l:'Este mes',g:'dia'},{k:'año',l:'Este año',g:'mes'},{k:'personalizado',l:'Personalizado',g:'dia'},
                      ].map(p => (
                        <button key={p.k} onClick={() => { setGastosStatsPeriod(p.k); setGastosAgrupar(p.g); }}
                          style={{ padding:'0.28rem 0.8rem', borderRadius:20, border:'1px solid var(--border)', background: gastosStatsPeriod===p.k ? 'var(--primary)' : 'transparent', color: gastosStatsPeriod===p.k ? 'white' : 'var(--text-muted)', fontWeight:600, fontSize:'0.82rem', cursor:'pointer' }}>
                          {p.l}
                        </button>
                      ))}
                      <button onClick={() => generarReporte()}
                        style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.35rem 1rem', borderRadius:'var(--radius-sm)', border:'none', background:'var(--text)', color:'var(--bg-card)', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', whiteSpace:'nowrap' }}>
                        <FileText size={13} /> Generar reporte
                      </button>
                      {gastosStatsPeriod === 'personalizado' && (
                        <>
                          <input type="date" value={gastosStatsDesde} onChange={e => setGastosStatsDesde(e.target.value)} style={{ fontSize:'0.82rem', padding:'0.28rem 0.5rem', width:140 }} />
                          <span style={{ color:'var(--text-muted)' }}>—</span>
                          <input type="date" value={gastosStatsHasta} onChange={e => setGastosStatsHasta(e.target.value)} style={{ fontSize:'0.82rem', padding:'0.28rem 0.5rem', width:140 }} />
                        </>
                      )}
                    </div>

                    {/* KPI cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '1rem' }}>
                      {[
                        { label: 'Vehículos atendidos', value: ordenesPeriodo.length, prev: ordenesPrev.length, color: 'var(--primary)', display: n => n },
                        { label: 'Ingresos', value: ingresosPeriodo, prev: ingresosPrev, color: '#10b981', display: n => `$${fmt(n)}` },
                        { label: 'Gastos', value: gastosTotalPeriodo, prev: gastosPrev, invert: true, color: '#ef4444', display: n => `$${fmt(n)}` },
                        { label: 'Ganancia neta', value: ganancia, prev: gananciaPrev, color: ganancia >= 0 ? '#10b981' : '#ef4444', display: n => `$${fmt(n)}` },
                        { label: 'Margen', value: margenPct, color: (margenPct ?? 0) >= 0 ? '#10b981' : '#ef4444', display: n => n == null ? '—' : `${n.toFixed(0)}%` },
                        { label: 'Ticket promedio', value: ticketProm, prev: ticketPrev, color: '#f59e0b', display: n => `$${fmt(n)}` },
                        { label: 'IVA generado', value: ivaPeriodo, color: '#818cf8', display: n => `$${fmt(n)}`, sub: 'Para declaración DIAN' },
                      ].map(s => {
                        const d = s.prev !== undefined ? deltaPct(s.value, s.prev) : null;
                        const good = d != null ? (s.invert ? d < 0 : d >= 0) : null;
                        const displayVal = String(s.display(s.value));
                        return (
                          <div key={s.label} className="card" style={{ padding: '1rem 1.25rem', minWidth: 0 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing:'0.05em', marginBottom: '0.4rem' }}>{s.label}</div>
                            <div style={{ fontSize: displayVal.length > 13 ? '0.98rem' : displayVal.length > 10 ? '1.18rem' : '1.45rem', fontWeight: 900, color: s.color, whiteSpace: 'nowrap' }} title={displayVal}>{displayVal}</div>
                            {d != null && (
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, marginTop: '0.3rem', color: good ? '#10b981' : '#ef4444' }}>
                                {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(0)}% vs período anterior
                              </div>
                            )}
                            {d == null && s.sub && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{s.sub}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Category breakdown + balances by payment method */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                      <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>¿En qué se va la plata? <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.8rem' }}>(gastos del período)</span></h3>
                        {catList.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin gastos en este período.</p>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {catList.map(([cat, total]) => (
                            <div key={cat}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                                <span style={{ fontWeight: 600 }}>{cat}</span>
                                <span style={{ fontWeight: 700, color: 'var(--error)' }}>${fmt(total)} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({gastosTotalPeriodo > 0 ? ((total/gastosTotalPeriodo)*100).toFixed(0) : 0}%)</span></span>
                              </div>
                              <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(total/catMax)*100}%`, background: '#ef4444', borderRadius: 4, transition: 'width 0.3s' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Saldos por método de pago <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.8rem' }}>(del período)</span></h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {PAYMENT_METHODS.map(m => {
                            const saldo = balancesPeriodo[m] || 0;
                            return (
                              <div key={m} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.8rem', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m}</span>
                                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: saldo >= 0 ? '#10b981' : '#ef4444' }}>${fmt(saldo)}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>Ingresos de órdenes entregadas menos gastos del período seleccionado, según método de pago registrado.</p>
                      </div>
                    </div>

                    {/* Top clients + top services */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                      <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Top clientes <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.8rem' }}>(ingresos del período)</span></h3>
                        {topClientes.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin órdenes entregadas en este período.</p>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {topClientes.map(([cliente, total], i) => (
                            <div key={cliente} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.8rem', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: 20, height: 20, borderRadius: '50%', background: i === 0 ? '#f59e0b' : 'var(--border)', color: i === 0 ? '#fff' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>{i+1}</span>
                                {cliente}
                              </span>
                              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>${fmt(total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Servicios más vendidos <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.8rem' }}>(del período)</span></h3>
                        {topServicios.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin datos en este período.</p>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {topServicios.map(([serv, data]) => (
                            <div key={serv} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.8rem', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{serv}</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981', whiteSpace: 'nowrap' }}>${fmt(data.total)} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.72rem' }}>×{data.count}</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Trend line chart (follows selected period) */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'0.5rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Tendencia del período</h3>
                        <div style={{ display:'flex', gap:'0.3rem' }}>
                          {[{k:'dia',l:'Día'},{k:'semana',l:'Semana'},{k:'mes',l:'Mes'}].map(g => (
                            <button key={g.k} onClick={() => setGastosAgrupar(g.k)}
                              style={{ padding:'0.22rem 0.7rem', borderRadius:20, border:'1px solid var(--border)', background: gastosAgrupar===g.k ? 'var(--primary)' : 'transparent', color: gastosAgrupar===g.k ? 'white' : 'var(--text-muted)', fontWeight:600, fontSize:'0.76rem', cursor:'pointer' }}>
                              {g.l}
                            </button>
                          ))}
                        </div>
                      </div>
                      {!trendHasData ? (
                        <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', textAlign:'center', padding:'2rem 0' }}>Sin movimientos en este período.</p>
                      ) : (() => {
                        const W = 800, H = 240, pL = 48, pR = 12, pT = 12, pB = 26;
                        const maxY = Math.max(...trendBuckets.map(b => Math.max(b.ingresos, b.gastos, b.utilidad)), 1);
                        const minY = Math.min(0, ...trendBuckets.map(b => b.utilidad));
                        const xAt = i => pL + (trendBuckets.length === 1 ? (W-pL-pR)/2 : i * (W-pL-pR) / (trendBuckets.length-1));
                        const yAt = v => pT + (H-pT-pB) * (1 - (v - minY) / ((maxY - minY) || 1));
                        const pts = key => trendBuckets.map((b,i) => `${xAt(i)},${yAt(b[key])}`).join(' ');
                        const gridVals = [0.25, 0.5, 0.75, 1].map(f => minY + f * (maxY - minY));
                        const labStep = Math.max(1, Math.ceil(trendBuckets.length / 8));
                        return (
                          <>
                            <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto' }}>
                              {gridVals.map((v, i) => (
                                <g key={i}>
                                  <line x1={pL} x2={W-pR} y1={yAt(v)} y2={yAt(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
                                  <text x={pL-6} y={yAt(v)+3} textAnchor="end" fontSize="10" fill="var(--text-muted)">{fmtCompact(v)}</text>
                                </g>
                              ))}
                              {minY < 0 && <line x1={pL} x2={W-pR} y1={yAt(0)} y2={yAt(0)} stroke="var(--text-muted)" strokeWidth="1" />}
                              <polyline points={pts('ingresos')} fill="none" stroke="#10b981" strokeWidth="2" />
                              <polyline points={pts('gastos')} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5 4" />
                              <polyline points={pts('utilidad')} fill="none" stroke="#818cf8" strokeWidth="2.5" />
                              {trendBuckets.length <= 31 && trendBuckets.map((b, i) => (
                                <g key={'d'+i}>
                                  <circle cx={xAt(i)} cy={yAt(b.ingresos)} r="3" fill="#10b981"><title>{`${b.label} — Ingresos: $${fmt(b.ingresos)}`}</title></circle>
                                  <circle cx={xAt(i)} cy={yAt(b.gastos)} r="3" fill="#ef4444"><title>{`${b.label} — Gastos: $${fmt(b.gastos)}`}</title></circle>
                                  <circle cx={xAt(i)} cy={yAt(b.utilidad)} r="3" fill="#818cf8"><title>{`${b.label} — Utilidad: $${fmt(b.utilidad)}`}</title></circle>
                                </g>
                              ))}
                              {trendBuckets.map((b, i) => (i % labStep === 0) ? (
                                <text key={'x'+i} x={xAt(i)} y={H-8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{b.label}</text>
                              ) : null)}
                            </svg>
                            <div style={{ display:'flex', gap:'1.25rem', marginTop:'0.5rem', fontSize:'0.78rem', flexWrap:'wrap' }}>
                              <span style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}><span style={{ width:14, height:3, background:'#10b981', display:'inline-block', borderRadius:2 }}/> Ingresos</span>
                              <span style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}><span style={{ width:14, height:3, background:'#ef4444', display:'inline-block', borderRadius:2 }}/> Gastos</span>
                              <span style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}><span style={{ width:14, height:3, background:'#818cf8', display:'inline-block', borderRadius:2 }}/> Utilidad</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── ROW 3: Expense table with filters ────────────── */}
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'0.5rem' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                        <h2 style={{ fontSize:'1rem', fontWeight:700, margin:0 }}>Historial de Gastos</h2>
                        <span style={{ fontSize:'0.82rem', color:'var(--text-muted)', fontWeight:600 }}>
                          {filteredExpenses.length} registro{filteredExpenses.length!==1?'s':''} · <span style={{ color:'var(--error)', fontWeight:700 }}>${fmt(filteredTotal)}</span>
                        </span>
                        {hasGastoFilters && (
                          <button onClick={() => { setGastosSearch(''); setGastosDesde(''); setGastosHasta(''); setGastosMetodo('Todos'); setGastosCategoria('Todas'); }}
                            style={{ display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.76rem', color:'var(--text-muted)', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:99, padding:'0.2rem 0.55rem', cursor:'pointer', fontWeight:600 }}>
                            <X size={11} /> Limpiar
                          </button>
                        )}
                      </div>
                      {/* Method pills */}
                      <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' }}>
                        {['Todos', ...PAYMENT_METHODS].map(m => (
                          <button key={m} onClick={() => setGastosMetodo(m)}
                            style={{ padding:'0.25rem 0.7rem', border:'1px solid var(--border)', borderRadius:99, cursor:'pointer', fontSize:'0.78rem', fontWeight:600, background: gastosMetodo===m ? 'var(--primary)' : 'var(--card-bg)', color: gastosMetodo===m ? '#fff' : 'var(--text-muted)', transition:'all 0.15s' }}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Search + date row */}
                    <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.1rem', flexWrap:'wrap' }}>
                      <div style={{ position:'relative', flex:'1 1 200px', minWidth:180 }}>
                        <Search size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
                        <input type="text" placeholder="Buscar concepto..." value={gastosSearch} onChange={e => setGastosSearch(e.target.value)}
                          style={{ width:'100%', paddingLeft:'1.9rem', paddingRight: gastosSearch ? '1.9rem' : undefined, boxSizing:'border-box' }} />
                        {gastosSearch && (
                          <button onClick={() => setGastosSearch('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}>
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <label style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)', whiteSpace:'nowrap' }}>Desde</label>
                        <input type="date" value={gastosDesde} onChange={e => setGastosDesde(e.target.value)} style={{ width:135 }} />
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <label style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)', whiteSpace:'nowrap' }}>Hasta</label>
                        <input type="date" value={gastosHasta} onChange={e => setGastosHasta(e.target.value)} style={{ width:135 }} />
                      </div>
                      <select value={gastosCategoria} onChange={e => setGastosCategoria(e.target.value)} style={{ fontSize:'0.82rem', width:'auto', maxWidth:190, flex:'0 0 auto' }}>
                        <option value="Todas">Todas las categorías</option>
                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="Sin categoría">Sin categoría</option>
                      </select>
                      <button onClick={exportGastosCsv} style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.8rem', fontWeight:600, padding:'0.4rem 0.8rem', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--text)', whiteSpace:'nowrap', flex:'0 0 auto' }}>
                        <FileText size={13} /> Exportar CSV
                      </button>
                    </div>

                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Concepto</th>
                          <th>Categoría</th>
                          <th>Método</th>
                          <th style={{ textAlign:'right' }}>Monto</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExpenses.length === 0 && (
                          <tr><td colSpan="6" style={{ textAlign:'center', color:'var(--text-muted)', padding:'2rem 0' }}>Sin gastos para este filtro.</td></tr>
                        )}
                        {filteredExpenses.map(g => (
                          <tr key={g.id}>
                            <td style={{ whiteSpace:'nowrap', color:'var(--text-muted)', fontSize:'0.85rem' }}>{g.fecha ? new Date(g.fecha).toLocaleDateString('es-CO') : '—'}</td>
                            <td style={{ fontWeight:600 }}>{g.concepto}</td>
                            <td>
                              <select value={g.categoria || ''} onChange={e => updateExpenseCategoria(g.id, e.target.value)}
                                title="Cambiar categoría"
                                style={{ fontSize:'0.76rem', fontWeight:700, padding:'0.2rem 0.4rem', borderRadius:8, whiteSpace:'nowrap', cursor:'pointer', width:'auto', maxWidth:150,
                                  background: g.categoria ? 'rgba(245,158,11,0.1)' : 'var(--bg)',
                                  color: g.categoria ? '#f59e0b' : 'var(--text-muted)',
                                  border: g.categoria ? '1px solid rgba(245,158,11,0.3)' : '1px dashed var(--border)' }}>
                                <option value="" disabled>Sin categoría</option>
                                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td><span style={{ fontSize:'0.78rem', fontWeight:700, background:'rgba(99,102,241,0.1)', color:'var(--primary)', padding:'0.2rem 0.55rem', borderRadius:99 }}>{g.metodoPago}</span></td>
                            <td style={{ textAlign:'right', fontWeight:800, color:'var(--error)', whiteSpace:'nowrap' }}>${fmt(g.monto)}</td>
                            <td style={{ textAlign:'center' }}>
                              {deleteExpenseId === g.id ? (
                                <div style={{ display:'flex', gap:'0.35rem', justifyContent:'center' }}>
                                  <button onClick={() => handleDeleteExpense(g.id)} style={{ fontSize:'0.75rem', padding:'0.2rem 0.5rem', background:'var(--error)', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontWeight:700 }}>Confirmar</button>
                                  <button onClick={() => setDeleteExpenseId(null)} style={{ fontSize:'0.75rem', padding:'0.2rem 0.5rem', background:'var(--bg)', color:'var(--text-muted)', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer' }}>Cancelar</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteExpenseId(g.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:'0.2rem', display:'flex', alignItems:'center' }} title="Eliminar">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              );
            })()}

            {activeTab === 'AsistenteIA' && (
              <div className="card" style={{ padding: 0, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 340px)', minHeight: 480, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(99,102,241,0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Asistente IA del Taller</h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Pregunta lo que quieras sobre tus órdenes, ingresos y gastos. Solo lee la información, no la modifica.</p>
                  </div>
                  {chatMessages.length > 0 && (
                    <button onClick={() => setChatMessages([])} style={{ marginLeft: 'auto', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 99, padding: '0.25rem 0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Nueva conversación
                    </button>
                  )}
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {chatMessages.length === 0 && !chatLoading && (
                    <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 480 }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Prueba con una de estas preguntas:</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                        {[
                          '¿Cuánto he facturado este mes?',
                          '¿Cuál es mi mejor cliente?',
                          '¿En qué estoy gastando más?',
                          '¿Qué vehículos llevan más tiempo en el taller?',
                          '¿Cómo va julio comparado con junio?',
                        ].map(q => (
                          <button key={q} onClick={() => handleChatSend(q)}
                            style={{ fontSize: '0.82rem', fontWeight: 600, padding: '0.45rem 0.9rem', background: 'rgba(99,102,241,0.08)', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 99, cursor: 'pointer' }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '80%', padding: '0.7rem 1rem', borderRadius: 14, fontSize: '0.9rem', lineHeight: 1.55, wordBreak: 'break-word',
                        background: m.role === 'user' ? 'var(--primary)' : 'var(--bg)',
                        color: m.role === 'user' ? '#fff' : 'var(--text)',
                        border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                        borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                        borderBottomLeftRadius: m.role === 'user' ? 14 : 4,
                        whiteSpace: m.role === 'user' ? 'pre-wrap' : undefined,
                      }}>
                        {m.role === 'user' ? m.content : renderChatText(m.content)}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ padding: '0.7rem 1rem', borderRadius: 14, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div className="spinner" style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        Analizando la información...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={e => { e.preventDefault(); handleChatSend(); }}
                  style={{ display: 'flex', gap: '0.6rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
                  <input type="text" placeholder="Escribe tu pregunta..." value={chatInput} onChange={e => setChatInput(e.target.value)}
                    style={{ flex: 1, fontSize: '0.95rem', padding: '0.7rem 1rem' }} disabled={chatLoading} />
                  <button type="submit" className="btn-primary" disabled={chatLoading || !chatInput.trim()}
                    style={{ padding: '0 1.4rem', opacity: chatLoading || !chatInput.trim() ? 0.6 : 1 }}>
                    Enviar
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'Ingresos Rápidos' && (
              <div className="card" style={{ padding: '1.5rem', maxWidth: 600, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem' }}>
                    <Zap size={24} />
                  </div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Generador de Orden Exprés</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.5rem' }}>Crea una orden rápida para cotizar o facturar inmediatamente.</p>
                </div>
                <form onSubmit={handleQuickOrder}>
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Placa</label>
                      <input required placeholder="AAA123" value={quickOrderForm.placa} onChange={e => setQuickOrderForm({...quickOrderForm, placa: e.target.value.toUpperCase()})} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Cliente</label>
                      <input required placeholder="Nombre" value={quickOrderForm.cliente} onChange={e => setQuickOrderForm({...quickOrderForm, cliente: e.target.value})} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Marca</label>
                      <input required placeholder="Ej. Toyota" value={quickOrderForm.marca} onChange={e => setQuickOrderForm({...quickOrderForm, marca: e.target.value})} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Modelo / Año</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input required placeholder="Corolla" value={quickOrderForm.modelo} onChange={e => setQuickOrderForm({...quickOrderForm, modelo: e.target.value})} style={{ flex: 2 }} />
                        <input placeholder="Año" type="number" value={quickOrderForm.anio} onChange={e => setQuickOrderForm({...quickOrderForm, anio: e.target.value})} style={{ flex: 1 }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Servicios / Observaciones (opcional)</label>
                    <textarea placeholder="Detalle rápido de la revisión o servicio..." value={quickOrderForm.servicios} onChange={e => setQuickOrderForm({...quickOrderForm, servicios: e.target.value})} style={{ width: '100%', minHeight: 60 }}></textarea>
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1rem' }}>Crear y Facturar / Cotizar</button>
                </form>
              </div>
            )}

            {activeTab === 'Informes' && (
              <div className="card" style={{ padding: '2.5rem', maxWidth: 850, margin: '0 auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(79,70,229,0.15))', color: 'var(--primary)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', boxShadow: '0 8px 16px -4px rgba(99,102,241,0.2)' }}>
                    <Sparkles size={32} style={{ color: 'var(--primary)' }} />
                  </div>
                  <h2 style={{ fontSize: '1.65rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--text), var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Generador de Informe Técnico con IA
                  </h2>
                  <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.98rem' }}>
                    Redacta diagnósticos automotrices de alta precisión mediante IA y descárgalos en una plantilla premium de PDF.
                  </p>
                </div>

                {reportError && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', color: 'var(--error)', padding: '1rem', borderRadius: 12, marginBottom: '1.5rem', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={16} />
                    <strong>Error:</strong> {reportError}
                  </div>
                )}

                {/* Step 1: Selector of Plate / Order */}
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    1. Seleccionar Vehículo / Orden de Servicio
                  </label>
                  <select 
                    value={reportOrderId} 
                    onChange={e => {
                      const ordId = e.target.value;
                      setReportOrderId(ordId);
                      setAllQuotes(true);
                      const selectedOrd = orders.find(o => String(o.id) === String(ordId));
                      const q = selectedOrd?.quotes?.[0];
                      if (q && q.items) {
                        setSelectedQuoteItems(q.items.map(item => item.descripcion));
                      } else {
                        setSelectedQuoteItems([]);
                      }
                    }}
                    style={{ width: '100%', padding: '0.9rem 1.2rem', fontSize: '1.1rem', fontWeight: 700, borderRadius: 12, border: '2px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  >
                    <option value="">-- Escoger Placa / Orden --</option>
                    {orders.filter(o => o.estado !== 'Entregado').map(o => (
                      <option key={o.id} value={o.id}>
                        {o.placa} - {o.marca} {o.modelo} ({o.cliente})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Expandable vehicle info card once selected */}
                {reportOrderId && (() => {
                  const selectedOrder = orders.find(o => String(o.id) === String(reportOrderId));
                  if (!selectedOrder) return null;
                  const quote = selectedOrder.quotes?.[0];
                  const hasQuote = quote && quote.items && quote.items.length > 0;

                  return (
                    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                      {/* Technical Sheet grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '1.25rem', borderRadius: 12, marginBottom: '2rem' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cliente</div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.15rem' }}>{selectedOrder.cliente}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vehículo</div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.15rem' }}>{selectedOrder.marca} {selectedOrder.modelo} ({selectedOrder.anio || 'N/A'})</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kilometraje</div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.15rem' }}>{selectedOrder.kilometraje ? parseInt(selectedOrder.kilometraje).toLocaleString() : 'N/A'} KM</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ingreso</div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedOrder.motivoIngreso || selectedOrder.servicios || 'Mantenimiento Gral.'}</div>
                        </div>
                      </div>

                      {/* Step 2: Quote filter checklist */}
                      <div style={{ marginBottom: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          2. Filtrado de ítems de la Cotización
                        </label>

                        {!hasQuote ? (
                          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px dashed rgba(245,158,11,0.3)', color: '#fbbf24', padding: '1rem 1.25rem', borderRadius: 12, fontSize: '0.9rem' }}>
                            💡 **Aviso:** Esta orden no posee una cotización asociada. El informe se redactará enfocándose en los datos generales y observaciones que agregues abajo.
                          </div>
                        ) : (
                          <div>
                            {/* Toggle Selector for All vs Specific */}
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
                              <button 
                                type="button"
                                onClick={() => {
                                  setAllQuotes(true);
                                  setSelectedQuoteItems(quote.items.map(item => item.descripcion));
                                }}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: 10, border: '1px solid var(--border)', background: allQuotes ? 'var(--primary)' : 'transparent', color: allQuotes ? 'white' : 'var(--text)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem' }}
                              >
                                Toda la Cotización
                              </button>
                              <button 
                                type="button"
                                onClick={() => setAllQuotes(false)}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: 10, border: '1px solid var(--border)', background: !allQuotes ? 'var(--primary)' : 'transparent', color: !allQuotes ? 'white' : 'var(--text)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem' }}
                              >
                                Seleccionar ítems específicos
                              </button>
                            </div>

                            {/* Checklist list shown only if specific option is active */}
                            {!allQuotes && (
                              <div style={{ animation: 'fadeIn 0.25s ease-out', border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(0,0,0,0.1)', padding: '1rem', maxHeight: 220, overflowY: 'auto' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem', fontWeight: 600 }}>
                                  Marca los ítems que deseas que la IA analice para el informe técnico:
                                </div>
                                {quote.items.map((item, idx) => {
                                  const isChecked = selectedQuoteItems.includes(item.descripcion);
                                  return (
                                    <label 
                                      key={idx} 
                                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.8rem', background: isChecked ? 'rgba(99,102,241,0.06)' : 'transparent', borderRadius: 8, cursor: 'pointer', transition: 'background-color 0.2s', marginBottom: '0.25rem', userSelect: 'none' }}
                                    >
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={() => {
                                          if (isChecked) {
                                            setSelectedQuoteItems(selectedQuoteItems.filter(i => i !== item.descripcion));
                                          } else {
                                            setSelectedQuoteItems([...selectedQuoteItems, item.descripcion]);
                                          }
                                        }}
                                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                                      />
                                      <div style={{ flex: 1, fontSize: '0.9rem' }}>
                                        <span style={{ fontWeight: 600, color: isChecked ? 'var(--primary)' : 'var(--text)' }}>
                                          {item.descripcion}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                          (Cant: {item.cantidad} - ${parseFloat(item.precio).toLocaleString('es-CO')})
                                        </span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Step 3: Instructions to AI */}
                      <div style={{ marginBottom: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          3. Indicaciones / Enfoque para la IA
                        </label>
                        <textarea 
                          placeholder="Ej. Enfatizar el desgaste severo en el tensor de correa para evitar roturas mecánicas graves en vía. Escribir en tono de urgencia técnica."
                          value={aiInstructions}
                          onChange={e => setAiInstructions(e.target.value)}
                          style={{ width: '100%', minHeight: 100, padding: '1rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '0.92rem', color: 'var(--text)', resize: 'vertical' }}
                        />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                          Usa este campo para guiar a la IA sobre qué puntos destacar o qué tono formal o preventivo adoptar.
                        </div>
                      </div>

                      {/* Submit / Generate button */}
                      <button 
                        type="button"
                        disabled={isGeneratingReport || (!allQuotes && selectedQuoteItems.length === 0)}
                        onClick={handleGenerateReport}
                        className="btn-primary"
                        style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', fontWeight: 800, gap: '0.75rem', borderRadius: 12, justifyContent: 'center', height: 'auto', opacity: isGeneratingReport ? 0.75 : 1, transition: 'all 0.2s', cursor: isGeneratingReport ? 'not-allowed' : 'pointer', border: 'none', background: 'var(--primary)', color: 'white' }}
                      >
                        {isGeneratingReport ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className="spinner" style={{ width: 20, height: 20, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <span>IA Generando Informe Técnico y PDF...</span>
                          </div>
                        ) : (
                          <>
                            <Sparkles size={20} />
                            <span>Generar Informe Técnico IA (PDF Oficial)</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>


      {/* New Order Modal */}
      {showNewOrder && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 640 }}>
            {createdOrderData ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✅</div>
                <h2 style={{ fontWeight: 800, fontSize: '1.6rem', marginBottom: '0.5rem' }}>¡Orden Creada!</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.05rem' }}>El vehículo <strong>{createdOrderData.placa}</strong> ha sido ingresado al sistema.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <a href={`https://wa.me/57${createdOrderData.telefono}?text=${encodeURIComponent(`Buenos dias! Confirmamos recepcion del vehiculo de placas ${createdOrderData.placa}, puedes ver mas detalles del servicio aqui https://appagent.up.railway.app/cliente`)}`}
                     target="_blank" rel="noreferrer"
                     className="btn-success" style={{ padding: '0.85rem', width: '100%', justifyContent: 'center', fontSize: '1.05rem', textDecoration: 'none' }}>
                    📱 Notificar al Cliente (WhatsApp)
                  </a>
                  <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '1rem' }} onClick={() => { setShowNewOrder(false); setCreatedOrderData(null); }}>
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontWeight: 700, fontSize: '1.2rem' }}>📋 Ingresar Vehículo</h2>
                  <button onClick={() => { setShowNewOrder(false); setPhotos([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                </div>

                {formStatus.text && <div className={`toast toast-${formStatus.type}`}>{formStatus.text}</div>}

                <form onSubmit={handleCreateOrder}>
                  <p className="section-title">Vehículo</p>
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <input required placeholder="Placa (Ej. AAA123)" value={form.placa} onChange={e => setForm({...form, placa: e.target.value.toUpperCase()})} />
                <input required placeholder="Kilometraje" type="number" value={form.kilometraje} onChange={e => setForm({...form, kilometraje: e.target.value})} />
                <input required placeholder="Marca" value={form.marca} onChange={e => setForm({...form, marca: e.target.value})} />
                <input required placeholder="Modelo" value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} />
                <input required placeholder="Año" type="number" value={form.anio} onChange={e => setForm({...form, anio: e.target.value})} style={{ gridColumn: '1 / -1' }} />
              </div>

              <p className="section-title">Cliente</p>
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <input required placeholder="Nombre completo" value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} />
                <input placeholder="CC / NIT" value={form.documento} onChange={e => setForm({...form, documento: e.target.value})} />
                <input required placeholder="Teléfono" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
                <input placeholder="Correo electrónico" type="email" value={form.correo} onChange={e => setForm({...form, correo: e.target.value})} />
              </div>

              <p className="section-title">Servicio</p>
              <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <textarea required placeholder="Servicios a realizar" value={form.servicios} onChange={e => setForm({...form, servicios: e.target.value})} style={{ minHeight: 70 }} />
                <textarea placeholder="Notas / Observaciones" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} style={{ minHeight: 55 }} />
              </div>

              {/* Mejora #2: Fotos de ingreso */}
              <p className="section-title">Fotos de Ingreso</p>
              <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: '1rem', textAlign: 'center', cursor: 'pointer', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.95rem', transition: 'border-color 0.2s' }}>
                📷 Haz clic para seleccionar fotos (o arrastra aquí)
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotos} />
              </label>
              {photos.length > 0 && (
                <div className="img-grid" style={{ marginBottom: '1.25rem' }}>
                  {photos.map((src, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={src} className="img-thumb" alt={`foto-${i}`} />
                      <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', color: 'white', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowNewOrder(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>Guardar Orden</button>
              </div>
            </form>
            </>
            )}
          </div>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailsModal order={selectedOrder} onClose={() => { setSelectedOrder(null); fetchOrders(); }} />
      )}

      {showPhotoUpload && (
        <PhotoUploadModal onClose={() => setShowPhotoUpload(false)} onSuccess={fetchOrders} />
      )}

      {showCitaModal && (
        <CitaModal
          mode={showCitaModal.mode}
          cita={showCitaModal.cita}
          initialFecha={showCitaModal.fecha}
          onClose={() => setShowCitaModal(null)}
          onSuccess={fetchCitas}
          onIngresar={handleIngresarDesdeCita}
        />
      )}

      {showRecordatorios && (
        <RecordatoriosModal citas={citas} onClose={() => setShowRecordatorios(false)} onRefresh={fetchCitas} />
      )}

      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Trash2 size={28} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>¿Eliminar Orden?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Esta acción eliminará la orden de servicio permanentemente. ¿Deseas continuar?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setOrderToDelete(null)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--error)', borderColor: 'var(--error)', color: 'white' }} onClick={confirmDeleteOrder}>Sí, Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
