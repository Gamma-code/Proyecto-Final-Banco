import { useEffect, useState } from 'react';
import { api } from '../api/api.js';

export default function Beneficiarios() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ numeroCuenta: '', alias: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const recargar = () => api.beneficiarios().then(setLista).catch(() => {});
  useEffect(() => { recargar(); }, []);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const agregar = async () => {
    setError(''); setOk('');
    try {
      await api.agregarBeneficiario(form);
      setOk('Beneficiario guardado');
      setForm({ numeroCuenta: '', alias: '' });
      recargar();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="form-card">
        <h3>Registrar cuenta destino</h3>
        <input name="numeroCuenta" placeholder="Numero de cuenta (10 digitos)"
          value={form.numeroCuenta} onChange={cambiar} maxLength={10} />
        <input name="alias" placeholder="Alias (ej. Mama)" value={form.alias} onChange={cambiar} />
        {error && <div className="alert error">{error}</div>}
        {ok && <div className="alert ok">{ok}</div>}
        <button className="btn" onClick={agregar}>Guardar beneficiario</button>
      </div>

      <h3>Mis beneficiarios</h3>
      {lista.length === 0 && <p className="vacio">Aun no has registrado beneficiarios.</p>}
      <ul className="lista">
        {lista.map((b) => (
          <li key={b.numeroCuenta}>
            <strong>{b.alias}</strong> — {b.numeroCuenta} <small>({b.nombreReal})</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
