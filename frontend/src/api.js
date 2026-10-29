/**
 * Central API Service for Rawther Biriyani App
 * Supports live FastAPI backend, custom VITE_API_BASE_URL,
 * and built-in offline/demo fallback when deployed statically on Netlify.
 */

import defaultMenuData from './data/defaultMenu.json';
import { RESTAURANT_CONFIG } from './config';

const RAW_API_HOST = import.meta.env.VITE_API_BASE_URL || '';
const API_BASE = RAW_API_HOST ? `${RAW_API_HOST.replace(/\/$/, '')}/api` : '/api';

export const getFullImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads') && RAW_API_HOST) {
    return `${RAW_API_HOST.replace(/\/$/, '')}${url}`;
  }
  return url;
};

export const getAuthToken = () => localStorage.getItem('token');
export const getAuthRole = () => localStorage.getItem('role');
export const getAuthUsername = () => localStorage.getItem('username');

export const setAuthSession = (token, role, username) => {
  localStorage.setItem('token', token);
  localStorage.setItem('role', role);
  localStorage.setItem('username', username);
};

export const clearAuthSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('username');
};

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Local storage fallback helpers for Netlify standalone deployment
const getLocalMenu = () => {
  try {
    const saved = localStorage.getItem('rawther_custom_menu');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return defaultMenuData;
};

export const notifyLocalMenuChange = () => {
  try {
    localStorage.setItem('rawther_menu_version', Date.now().toString());
  } catch (e) {}
  try {
    const bc = new BroadcastChannel('rawther_menu_sync');
    bc.postMessage({ type: 'MENU_UPDATED', timestamp: Date.now() });
    bc.close();
  } catch (e) {}
};

const saveLocalMenu = (menu) => {
  try {
    localStorage.setItem('rawther_custom_menu', JSON.stringify(menu));
    notifyLocalMenuChange();
  } catch (e) {}
};

async function handleResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const error = new Error('API server returned HTML instead of JSON. Backend is not reachable at /api.');
    error.status = 404;
    throw error;
  }

  if (!response.ok) {
    let errorMsg = `Error ${response.status}: ${response.statusText}`;
    try {
      const data = await response.json();
      if (data && data.detail) {
        errorMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch (e) {
      // not json
    }
    const error = new Error(errorMsg);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// Config
export const fetchConfig = async () => {
  try {
    const res = await fetch(`${API_BASE}/config`);
    return await handleResponse(res);
  } catch (err) {
    return {
      restaurant_name: RESTAURANT_CONFIG.restaurantName,
      currency_symbol: RESTAURANT_CONFIG.currencySymbol,
      rate_limit_orders_per_minute: RESTAURANT_CONFIG.rateLimitPerMinute
    };
  }
};

// Menu (Public)
export const fetchMenu = async (includeHidden = false) => {
  try {
    const res = await fetch(`${API_BASE}/menu?include_hidden=${includeHidden}`);
    return await handleResponse(res);
  } catch (err) {
    console.info("Using embedded menu data (standalone/Netlify mode):", err.message);
    const menu = getLocalMenu();
    if (includeHidden) return menu;
    return menu.map(cat => ({
      ...cat,
      items: (cat.items || []).filter(item => !item.is_hidden)
    }));
  }
};

// Table validation
export const validateTableApi = async (table, token) => {
  try {
    let url = `${API_BASE}/tables/validate?table=${table}`;
    if (token) url += `&token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    return await handleResponse(res);
  } catch (err) {
    return {
      valid: true,
      exists: true,
      table_number: parseInt(table, 10),
      token: token || 'demo_token'
    };
  }
};

// Place Order
export const placeOrderApi = async (orderPayload) => {
  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
    return await handleResponse(res);
  } catch (err) {
    // If server responded with a client-side error (400, 429, etc.), throw it directly to UI
    if (err.status && err.status >= 400 && err.status < 500) {
      throw err;
    }
    const menu = getLocalMenu();
    const newOrder = {
      id: Math.floor(1000 + Math.random() * 9000),
      table_id: orderPayload.table_number || 1,
      table_number: orderPayload.table_number || 1,
      status: 'received',
      reject_reason: null,
      note: orderPayload.note || null,
      total: 0,
      created_at: new Date().toISOString(),
      items: (orderPayload.items || []).map(i => {
        let foundName = 'Delicious Item';
        let foundPrice = 150;
        let variantLabel = null;

        for (const cat of menu) {
          const item = (cat.items || []).find(it => it.id === i.menu_item_id);
          if (item) {
            foundName = item.name;
            foundPrice = item.base_price || 150;
            if (i.variant_id && item.variants) {
              const v = item.variants.find(va => va.id === i.variant_id);
              if (v) {
                foundPrice = v.price;
                variantLabel = v.label;
              }
            }
            break;
          }
        }

        return {
          id: Math.floor(Math.random() * 100000),
          menu_item_id: i.menu_item_id,
          variant_id: i.variant_id,
          item_name: foundName,
          variant_label: variantLabel,
          quantity: i.quantity,
          unit_price: foundPrice,
          subtotal: foundPrice * i.quantity,
          note: i.note
        };
      })
    };
    newOrder.total = newOrder.items.reduce((s, it) => s + it.subtotal, 0);

    // Save demo order to localStorage
    try {
      const orders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
      orders.unshift(newOrder);
      localStorage.setItem('demo_orders', JSON.stringify(orders));
    } catch (e) {}

    return newOrder;
  }
};

// Track Order
export const fetchOrderById = async (orderId) => {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}`);
    return await handleResponse(res);
  } catch (err) {
    const orders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
    const found = orders.find(o => String(o.id) === String(orderId));
    if (found) return found;
    return {
      id: orderId,
      table_number: 1,
      status: 'preparing',
      total: 340,
      created_at: new Date().toISOString(),
      items: []
    };
  }
};

// Auth
export const loginApi = async (username, password) => {
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return await handleResponse(res);
  } catch (err) {
    if ((username === 'admin' && password === 'admin123') || (username === 'rawadmin' && password === 'rawadmin786')) {
      return { access_token: 'demo_token_admin', role: 'admin', username };
    }
    if ((username === 'staff' && password === 'staff123') || (username === 'rawchef' && password === 'rawchef786')) {
      return { access_token: 'demo_token_staff', role: 'staff', username };
    }
    throw new Error('Incorrect username or password');
  }
};

// Staff / Kitchen Orders
export const fetchOrders = async (statusFilter = null, tableNumber = null) => {
  try {
    let url = `${API_BASE}/orders?`;
    if (statusFilter && statusFilter !== 'all') url += `status_filter=${statusFilter}&`;
    if (tableNumber) url += `table_number=${tableNumber}&`;
    const res = await fetch(url, { headers: authHeaders() });
    return await handleResponse(res);
  } catch (err) {
    let orders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
    if (orders.length === 0) {
      orders = [
        {
          id: 101,
          table_number: 7,
          status: 'received',
          note: 'Please provide extra raitha and onions',
          total: 480,
          created_at: new Date(Date.now() - 3 * 60000).toISOString(),
          items: [
            { id: 1, item_name: 'Chicken Biriyani', quantity: 2, unit_price: 160, subtotal: 320, note: 'Mild spicy' },
            { id: 2, item_name: 'Chicken Chilli Biriyani', quantity: 1, unit_price: 160, subtotal: 160, note: null }
          ]
        }
      ];
      localStorage.setItem('demo_orders', JSON.stringify(orders));
    }
    if (statusFilter && statusFilter !== 'all') {
      orders = orders.filter(o => o.status === statusFilter);
    }
    if (tableNumber) {
      orders = orders.filter(o => o.table_number === parseInt(tableNumber, 10));
    }
    return orders;
  }
};

export const updateOrderStatusApi = async (orderId, status, rejectReason = null) => {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({ status, reject_reason: rejectReason })
    });
    return await handleResponse(res);
  } catch (err) {
    const orders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
    const idx = orders.findIndex(o => String(o.id) === String(orderId));
    if (idx !== -1) {
      orders[idx].status = status;
      if (rejectReason) orders[idx].reject_reason = rejectReason;
      localStorage.setItem('demo_orders', JSON.stringify(orders));
      return orders[idx];
    }
    return { id: orderId, status, reject_reason: rejectReason };
  }
};

export const fetchTableBill = async (tableNumber) => {
  try {
    const res = await fetch(`${API_BASE}/tables/${tableNumber}/bill`, {
      headers: authHeaders()
    });
    return await handleResponse(res);
  } catch (err) {
    const orders = JSON.parse(localStorage.getItem('demo_orders') || '[]')
      .filter(o => o.table_number === parseInt(tableNumber, 10) && o.status !== 'rejected');
    const itemsMap = {};
    let grandTotal = 0;
    for (const o of orders) {
      for (const it of (o.items || [])) {
        const k = `${it.item_name}_${it.variant_label || ''}`;
        if (!itemsMap[k]) {
          itemsMap[k] = { name: it.item_name, variant: it.variant_label, quantity: 0, unit_price: it.unit_price, total: 0 };
        }
        itemsMap[k].quantity += it.quantity;
        itemsMap[k].total += it.subtotal;
        grandTotal += it.subtotal;
      }
    }
    return {
      table_number: parseInt(tableNumber, 10),
      orders_count: orders.length,
      items: Object.values(itemsMap),
      subtotal: grandTotal,
      tax: 0,
      grand_total: grandTotal
    };
  }
};

// Admin Categories
export const createCategoryApi = async (name, sortOrder = 0) => {
  try {
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name, sort_order: sortOrder })
    });
    return await handleResponse(res);
  } catch (err) {
    const menu = getLocalMenu();
    const newCat = { id: Date.now(), name, sort_order: sortOrder, items: [] };
    menu.push(newCat);
    saveLocalMenu(menu);
    return newCat;
  }
};

export const updateCategoryApi = async (id, data) => {
  try {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data)
    });
    return await handleResponse(res);
  } catch (err) {
    const menu = getLocalMenu();
    const cat = menu.find(c => c.id === id);
    if (cat) {
      Object.assign(cat, data);
      saveLocalMenu(menu);
    }
    return cat || data;
  }
};

export const deleteCategoryApi = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    return await handleResponse(res);
  } catch (err) {
    let menu = getLocalMenu().filter(c => c.id !== id);
    saveLocalMenu(menu);
    return { success: true };
  }
};

export const reorderCategoriesApi = async (categories) => {
  try {
    const res = await fetch(`${API_BASE}/categories/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ categories })
    });
    return await handleResponse(res);
  } catch (err) {
    const menu = getLocalMenu();
    categories.forEach((catUpdate, idx) => {
      const c = menu.find(item => item.id === catUpdate.id);
      if (c) c.sort_order = catUpdate.sort_order ?? idx;
    });
    menu.sort((a, b) => a.sort_order - b.sort_order);
    saveLocalMenu(menu);
    return { success: true };
  }
};

// Admin Menu Items
export const createMenuItemApi = async (itemData) => {
  try {
    const res = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(itemData)
    });
    return await handleResponse(res);
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) throw err;
    const menu = getLocalMenu();
    const cat = menu.find(c => c.id === itemData.category_id);
    const newItem = { id: Date.now(), ...itemData, variants: itemData.variants || [] };
    if (cat) {
      cat.items = cat.items || [];
      cat.items.push(newItem);
      saveLocalMenu(menu);
    }
    return newItem;
  }
};

export const updateMenuItemApi = async (id, itemData) => {
  try {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(itemData)
    });
    return await handleResponse(res);
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) throw err;
    const menu = getLocalMenu();
    for (const cat of menu) {
      const it = (cat.items || []).find(item => item.id === id);
      if (it) {
        Object.assign(it, itemData);
        saveLocalMenu(menu);
        return it;
      }
    }
    return { id, ...itemData };
  }
};

export const deleteMenuItemApi = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    return await handleResponse(res);
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) throw err;
    const menu = getLocalMenu();
    for (const cat of menu) {
      cat.items = (cat.items || []).filter(item => item.id !== id);
    }
    saveLocalMenu(menu);
    return { success: true };
  }
};
  }
};

export const toggleItemAvailabilityApi = async (id, isAvailable) => {
  try {
    const res = await fetch(`${API_BASE}/items/${id}/toggle-availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ is_available: isAvailable })
    });
    return await handleResponse(res);
  } catch (err) {
    const menu = getLocalMenu();
    for (const cat of menu) {
      const it = (cat.items || []).find(item => item.id === id);
      if (it) {
        it.is_available = isAvailable;
        saveLocalMenu(menu);
        break;
      }
    }
    return { id, is_available: isAvailable };
  }
};

export const toggleItemHiddenApi = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/items/${id}/toggle-hidden`, {
      method: 'PATCH',
      headers: authHeaders()
    });
    return await handleResponse(res);
  } catch (err) {
    const menu = getLocalMenu();
    for (const cat of menu) {
      const it = (cat.items || []).find(item => item.id === id);
      if (it) {
        it.is_hidden = !it.is_hidden;
        saveLocalMenu(menu);
        return { id, is_hidden: it.is_hidden };
      }
    }
    return { id, is_hidden: true };
  }
};

// Bulk Prices
export const bulkUpdatePricesApi = async (updates) => {
  try {
    const res = await fetch(`${API_BASE}/menu/bulk-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ updates })
    });
    return await handleResponse(res);
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) throw err;
    console.warn("Backend unavailable for bulk prices. Saving locally:", err.message);
    const menu = getLocalMenu();
    updates.forEach(up => {
      for (const cat of menu) {
        const it = (cat.items || []).find(item => item.id === up.item_id);
        if (it) {
          if (up.base_price !== undefined && up.base_price !== null) it.base_price = up.base_price;
          if (up.variant_id && it.variants) {
            const va = it.variants.find(v => v.id === up.variant_id);
            if (va) va.price = up.variant_price !== undefined ? up.variant_price : up.price;
          }
        }
      }
    });
    saveLocalMenu(menu);
    return { success: true };
  }
};

// Upload Photo
export const uploadImageApi = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });
    return await handleResponse(res);
  } catch (err) {
    // Return a local Object URL for instant demo preview
    return { image_url: URL.createObjectURL(file) };
  }
};

// Tables
export const fetchTablesApi = async () => {
  try {
    const res = await fetch(`${API_BASE}/tables`, { headers: authHeaders() });
    return await handleResponse(res);
  } catch (err) {
    return [
      { id: 1, number: 1, token: '30e22f77' },
      { id: 2, number: 2, token: 'dea428d6' },
      { id: 3, number: 3, token: '5c2e391b' },
      { id: 4, number: 4, token: '7f91b0d2' },
      { id: 5, number: 5, token: '1a4e8d3c' },
      { id: 6, number: 6, token: '9e7b2f4a' },
      { id: 7, number: 7, token: '8ff582c6' },
      { id: 8, number: 8, token: '4d6c1b8e' },
      { id: 9, number: 9, token: '2b5f7a9d' },
      { id: 10, number: 10, token: '8b94744a' },
    ];
  }
};

export const createTableApi = async (number, token = null) => {
  try {
    const res = await fetch(`${API_BASE}/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ number, token })
    });
    return await handleResponse(res);
  } catch (err) {
    return { id: Date.now(), number: parseInt(number, 10), token: token || Math.random().toString(16).substring(2, 10) };
  }
};

export const deleteTableApi = async (tableId) => {
  try {
    const res = await fetch(`${API_BASE}/tables/${tableId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    return await handleResponse(res);
  } catch (err) {
    return { success: true };
  }
};

export const regenerateTableTokenApi = async (tableId) => {
  try {
    const res = await fetch(`${API_BASE}/tables/${tableId}/regenerate-token`, {
      method: 'POST',
      headers: authHeaders()
    });
    return await handleResponse(res);
  } catch (err) {
    return { id: tableId, number: 1, token: Math.random().toString(16).substring(2, 10) };
  }
};

// Sales Report & Order History
export const fetchSalesReportApi = async (dateStr = null) => {
  try {
    let url = `${API_BASE}/admin/reports/sales`;
    if (dateStr) url += `?date_str=${dateStr}`;
    const res = await fetch(url, { headers: authHeaders() });
    return await handleResponse(res);
  } catch (err) {
    return {
      date: dateStr || new Date().toISOString().split('T')[0],
      total_sales: 14800,
      total_orders: 28,
      completed_orders: 26,
      top_items: [
        { name: "Chicken Biriyani", quantity: 42, revenue: 6720 },
        { name: "Chicken Chukka Biriyani", quantity: 24, revenue: 4320 },
        { name: "Chicken Chilli Biriyani", quantity: 18, revenue: 3060 }
      ]
    };
  }
};
