import { useState, useEffect } from 'react';
import { usuarioActual, cerrarSesion } from './api/api.js';
import Auth from './components/Auth.jsx';
import Dashboard from './components/Dashboard.jsx';
import Transferencia from './components/Transferencia.jsx';
import Beneficiarios from './components/Beneficiarios.jsx';
import Bitacora from './components/Bitacora.jsx';
import Perfil from './components/Perfil.jsx';

export default function App() {
  const [usuario, setUsuario] = useState(usuarioActual());
  const [vista, setVista] = useState('dashboard');

  // Si no hay sesion, mostramos login/registro
  if (!usuario) {
    return <Auth onLogin={(u) => { setUsuario(u); setVista('dashboard'); }} />;
  }

  const salir = () => { cerrarSesion(); setUsuario(null); };

  const tabs = [
    ['dashboard', 'Inicio'],
    ['transferir', 'Transferir'],
    ['beneficiarios', 'Beneficiarios'],
    ['bitacora', 'Bitacora'],
    ['perfil', 'Perfil'],
  ];

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Banco Nexus</h1>
          <p className="subtitle">Sistema de Transferencias</p>
        </div>
        <div className="user-box">
          <span>{usuario.nombre}</span>
          <small>{usuario.numeroCuenta}</small>
          <button className="btn-ghost" onClick={salir}>Salir</button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map(([key, label]) => (
          <button key={key}
            className={vista === key ? 'tab active' : 'tab'}
            onClick={() => setVista(key)}>
            {label}
          </button>
        ))}
      </nav>

      <main className="content">
        {vista === 'dashboard'     && <Dashboard />}
        {vista === 'transferir'    && <Transferencia onHecho={() => setVista('dashboard')} />}
        {vista === 'beneficiarios' && <Beneficiarios />}
        {vista === 'bitacora'      && <Bitacora />}
        {vista === 'perfil'        && <Perfil usuario={usuario} />}
      </main>

      <footer className="footer">Banco Nexus &copy; 2026 — Proyecto Final</footer>
    </div>
  );
}
