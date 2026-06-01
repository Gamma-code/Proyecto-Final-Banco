
const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(ruta, opciones = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opciones.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  const res = await fetch(BASE + ruta, { ...opciones, headers });
  let data = {};
  try { data = await res.json(); } catch { /* respuesta sin cuerpo */ }

  if (!res.ok) {
    throw new Error(data.error || 'Error ' + res.status);
  }
  return data;
}

export const api = {
  registro: (body) => request('/auth/registro', { method: 'POST', body: JSON.stringify(body) }),
  login:    (body) => request('/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
  perfil:        () => request('/perfil'),
  actualizarPerfil: (body) => request('/perfil', { method: 'PUT', body: JSON.stringify(body) }),
  dashboard:     () => request('/dashboard'),
  movimientos:   () => request('/movimientos'),
  beneficiarios: () => request('/beneficiarios'),
  agregarBeneficiario: (body) => request('/beneficiarios', { method: 'POST', body: JSON.stringify(body) }),
  transferir:    (body) => request('/transferencia', { method: 'POST', body: JSON.stringify(body) }),
  bitacora:      () => request('/bitacora'),
};

export function guardarSesion(token, usuario) {
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}
export function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}
export function usuarioActual() {
  try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
}
