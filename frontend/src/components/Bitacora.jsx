import { useEffect, useState } from 'react';
import { api } from '../api/api.js';

const fecha = (f) => new Date(f).toLocaleString('es-MX');

export default function Bitacora() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => { api.bitacora().then(setLogs).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="alert error">{error}</div>;

  return (
    <div>
      <h3>Bitacora de eventos</h3>
      {logs.length === 0 && <p className="vacio">Sin eventos registrados.</p>}
      {logs.length > 0 && (
        <table className="tabla">
          <thead>
            <tr><th>Fecha</th><th>Accion</th><th>Estado</th><th>Detalle</th></tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i}>
                <td>{fecha(l.fecha)}</td>
                <td>{l.accion}</td>
                <td className={l.estado === 'exitoso' ? 'abono' : 'cargo'}>{l.estado}</td>
                <td><code>{JSON.stringify(l.detalle)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
