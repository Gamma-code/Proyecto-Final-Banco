import { useEffect, useState } from 'react';
import { api } from '../api/api.js';

export default function Perfil() {
  const [perfil, setPerfil] = useState(null);
  const [form, setForm] = useState({ nombre: '', telefono: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.perfil().then((p) => {
      setPerfil(p);
      setForm({ nombre: p.nombre, telefono: p.telefono || '' });
    });
  }, []);

  if (!perfil) return <p>Cargando...</p>;

  const guardar = async () => {
    setMsg('');
    try { await api.actualizarPerfil(form); setMsg('Datos actualizados'); }
    catch (e) { setMsg(e.message); }
  };

  return (
    <div className="form-card">
      <h3>Mi perfil</h3>
      <p className="cuenta-num">Numero de cuenta: <strong>{perfil.numeroCuenta}</strong> (no se puede modificar)</p>
      <label>Correo</label>
      <input value={perfil.email} disabled />
      <label>Nombre</label>
      <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
      <label>Telefono</label>
      <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
      {msg && <div className="alert ok">{msg}</div>}
      <button className="btn" onClick={guardar}>Guardar cambios</button>
    </div>
  );
}
