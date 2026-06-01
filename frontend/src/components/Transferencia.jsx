import { useEffect, useState } from 'react';
import { api } from '../api/api.js';

export default function Transferencia({ onHecho }) {
  const [benef, setBenef] = useState([]);
  const [form, setForm] = useState({ cuentaDestino: '', monto: '', mensaje: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => { api.beneficiarios().then(setBenef).catch(() => {}); }, []);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const enviar = async () => {
    setError(''); setOk(''); setCargando(true);
    try {
      const r = await api.transferir({
        cuentaDestino: form.cuentaDestino,
        monto: form.monto,
        mensaje: form.mensaje
      });
      setOk('Transferencia exitosa. Saldo nuevo: $' +
        Number(r.saldoNuevo).toLocaleString('es-MX', { minimumFractionDigits: 2 }));
      setForm({ cuentaDestino: '', monto: '', mensaje: '' });
      setTimeout(() => onHecho && onHecho(), 1500);
    } catch (e) {
      setError(e.message);   
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="form-card">
      <h3>Nueva transferencia</h3>

      {benef.length > 0 && (
        <select onChange={(e) => setForm({ ...form, cuentaDestino: e.target.value })} value={form.cuentaDestino}>
          <option value="">— Elegir beneficiario guardado —</option>
          {benef.map((b) => (
            <option key={b.numeroCuenta} value={b.numeroCuenta}>
              {b.alias} ({b.numeroCuenta})
            </option>
          ))}
        </select>
      )}

      <input name="cuentaDestino" placeholder="Cuenta destino (10 digitos)"
        value={form.cuentaDestino} onChange={cambiar} maxLength={10} />
      <input name="monto" type="number" placeholder="Monto" value={form.monto} onChange={cambiar} />
      <input name="mensaje" placeholder="Mensaje (opcional)" value={form.mensaje} onChange={cambiar} />

      {error && <div className="alert error">{error}</div>}
      {ok && <div className="alert ok">{ok}</div>}

      <button className="btn" disabled={cargando} onClick={enviar}>
        {cargando ? 'Enviando...' : 'Transferir'}
      </button>
    </div>
  );
}
