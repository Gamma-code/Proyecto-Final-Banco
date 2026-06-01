import { useEffect, useState } from 'react';
import { api } from '../api/api.js';

const dinero = (n) => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 });
const fecha = (f) => new Date(f).toLocaleString('es-MX');

export default function Dashboard() {
  const [info, setInfo] = useState(null);
  const [movs, setMovs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setInfo(await api.dashboard());
        setMovs(await api.movimientos());
      } catch (e) { setError(e.message); }
    })();
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!info) return <p>Cargando...</p>;

  return (
    <div>
      <div className="saldo-card">
        <p>Saldo disponible</p>
        <h2>{dinero(info.saldo)} <small>{info.moneda}</small></h2>
        <span className="cuenta-num">Cuenta {info.numeroCuenta}</span>
      </div>

      <h3>Historial de movimientos</h3>
      {movs.length === 0 && <p className="vacio">Aun no tienes movimientos.</p>}
      {movs.length > 0 && (
        <table className="tabla">
          <thead>
            <tr><th>Fecha</th><th>Concepto</th><th>Cuenta</th><th>Monto</th></tr>
          </thead>
          <tbody>
            {movs.map((m, i) => (
              <tr key={i}>
                <td>{fecha(m.fecha)}</td>
                <td>{m.concepto}</td>
                <td>{m.tipo === 'cargo' ? m.cuentaDestino : m.cuentaOrigen}</td>
                <td className={m.tipo === 'cargo' ? 'cargo' : 'abono'}>
                  {m.tipo === 'cargo' ? '-' : '+'}{dinero(m.monto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
