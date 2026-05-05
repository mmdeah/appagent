const API_URL = '/api';

export const api = {
  // Service Orders
  getOrders: async () => {
    const res = await fetch(`${API_URL}/serviceOrders`);
    return res.json();
  },
  getOrderById: async (id) => {
    const res = await fetch(`${API_URL}/serviceOrders/${id}`);
    return res.json();
  },
  createOrder: async (data) => {
    const res = await fetch(`${API_URL}/serviceOrders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, id: `ord-${Date.now()}`, createdAt: new Date().toISOString() })
    });
    return res.json();
  },
  updateOrder: async (id, data) => {
    const res = await fetch(`${API_URL}/serviceOrders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  deleteOrder: async (id) => {
    const res = await fetch(`${API_URL}/serviceOrders/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Reports
  getReports: async () => {
    const res = await fetch(`${API_URL}/reports`);
    return res.json();
  },
  getReportByOrderId: async (orderId) => {
    const res = await fetch(`${API_URL}/reports?serviceOrderId=${orderId}`);
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
  },
  saveReport: async (data) => {
    if (data.id) {
      const res = await fetch(`${API_URL}/reports/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    } else {
      const res = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, id: `rep-${Date.now()}` })
      });
      return res.json();
    }
  },

  // Quotes
  getQuotes: async () => {
    const res = await fetch(`${API_URL}/quotes`);
    return res.json();
  },
  getQuoteByOrderId: async (orderId) => {
    const res = await fetch(`${API_URL}/quotes?serviceOrderId=${orderId}`);
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
  },
  saveQuote: async (data) => {
    if (data.id) {
      const res = await fetch(`${API_URL}/quotes/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    } else {
      const res = await fetch(`${API_URL}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, id: `quo-${Date.now()}` })
      });
      return res.json();
    }
  }
};
