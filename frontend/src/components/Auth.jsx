import { useState } from 'react';
import { api, guardarSesion } from '../api/api.js';

export default function Auth({ onLogin }) {
  const [modo, setModo] = useState('login');   // 'login' | 'registro'
  const [form, setForm] = useState({ nombre: '', email: '', password: '', telefono: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [cargando, setCargando] = useState(false);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const enviar = async () => {
    setError(''); setOk(''); setCargando(true);
    try {
      if (modo === 'registro') {
        const r = await api.registro(form);
        setOk('Cuenta creada. Tu numero de cuenta es ' + r.usuario.numeroCuenta + '. Ya puedes iniciar sesion.');
        setModo('login');
      } else {
        const r = await api.login({ email: form.email, password: form.password });
        guardarSesion(r.token, r.usuario);
        onLogin(r.usuario);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Banco Nexus</h1>
        <p className="subtitle">{modo === 'login' ? 'Inicia sesion' : 'Crea tu cuenta'}</p>

        {modo === 'registro' && (
          <>
            <input name="nombre"   placeholder="Nombre completo" value={form.nombre} onChange={cambiar} />
            <input name="telefono" placeholder="Telefono (opcional)" value={form.telefono} onChange={cambiar} />
          </>
        )}
        <input name="email" type="email" placeholder="Correo electronico" value={form.email} onChange={cambiar} />
        <input name="password" type="password" placeholder="Contrasena" value={form.password} onChange={cambiar} />

        {error && <div className="alert error">{error}</div>}
        {ok && <div className="alert ok">{ok}</div>}

        <button className="btn" disabled={cargando} onClick={enviar}>
          {cargando ? 'Procesando...' : (modo === 'login' ? 'Entrar' : 'Registrarme')}
        </button>

        <p className="switch">
          {modo === 'login' ? 'No tienes cuenta? ' : 'Ya tienes cuenta? '}
          <a onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setError(''); setOk(''); }}>
            {modo === 'login' ? 'Registrate' : 'Inicia sesion'}
          </a>
        </p>
      </div>
    </div>
  );
}
