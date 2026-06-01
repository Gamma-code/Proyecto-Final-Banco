

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');


const fs = require('fs');


function leerSecreto(nombre, valorPorDefecto) {
  const ruta = process.env[nombre + '_FILE'];
  if (ruta && fs.existsSync(ruta)) return fs.readFileSync(ruta, 'utf8').trim();
  return process.env[nombre] || valorPorDefecto;
}

const PORT = process.env.PORT || 3001;
const MONGO_URI = leerSecreto('MONGO_URI');                
const DB_NAME = process.env.DB_NAME || 'banco_final';
const JWT_SECRET = leerSecreto('JWT_SECRET', 'cambia-esto-en-produccion');
const JWT_EXPIRA = '8h';

if (!MONGO_URI) {
  console.error('FALTA la variable de entorno MONGO_URI. Revisa tu archivo .env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

let db, client;


// CONEXION A MONGODB ATLAS

async function conectarMongo() {
  client = new MongoClient(MONGO_URI, { retryWrites: true });
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Conectado a MongoDB Atlas, base:', DB_NAME);

  // Indices de unicidad (lo exige la rubrica: unique:true)
  await db.collection('usuarios').createIndex({ email: 1 }, { unique: true });
  await db.collection('usuarios').createIndex({ numeroCuenta: 1 }, { unique: true });
  console.log('Indices de unicidad asegurados (email, numeroCuenta)');
}


async function registrarBitacora({ usuario, accion, estado, detalle }) {
  try {
    await db.collection('bitacora').insertOne({
      fecha: new Date(),
      usuario: usuario || 'anonimo',
      accion,                       // LOGIN_EXITOSO, TRANSFERENCIA_APROBADA
      estado,                       // exitoso | fallido | pendiente
      detalle                       
    });
  } catch (e) {
    console.error('No se pudo escribir en bitacora:', e.message);
  }
}




function generarNumeroCuenta(idSecuencial) {
  const base = '180' + String(idSecuencial).padStart(6, '0');   
  const suma = base.split('').reduce((acc, d) => acc + Number(d), 0);
  const verificador = suma % 10;                                
  return base + String(verificador);                            
}


async function siguienteIdSecuencial(session) {
  const r = await db.collection('contadores').findOneAndUpdate(
    { _id: 'usuarios' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session }
  );
  return r.seq;
}

// Expresion regular que exige la rubrica antes de tocar la BD.
const REGEX_CUENTA = /^\d{10}$/;


// MIDDLEWARE DE AUTENTICACION (JWT)

function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta el token de sesion' });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);   // { id, numeroCuenta, nombre }
    next();
  } catch {
    return res.status(401).json({ error: 'Sesion invalida o expirada' });
  }
}


// RUTA DE SALUD 

app.get('/api/health', async (req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ status: 'ok', servicio: 'backend', host: process.env.HOSTNAME || 'local' });
  } catch (err) {
    res.status(503).json({ status: 'sin-bd', error: err.message });
  }
});


//USUARIOS Y AUTENTICACION

// Registro de clientes 
app.post('/api/auth/registro', async (req, res) => {
  const { nombre, email, password, telefono } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y password son obligatorios' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
  }

  const session = client.startSession();
  try {
    let nuevoUsuario;
    await session.withTransaction(async () => {
      // 1) email unico
      const existe = await db.collection('usuarios').findOne({ email }, { session });
      if (existe) throw { codigo: 409, mensaje: 'Ese correo ya esta registrado' };

      // 2) ID secuencial -> numero de cuenta de 10 digitos
      const idSeq = await siguienteIdSecuencial(session);
      const numeroCuenta = generarNumeroCuenta(idSeq);

      // 3) contrasena encriptada 
      const passwordHash = await bcrypt.hash(password, 10);

      const doc = {
        nombre,
        email,
        telefono: telefono || '',
        passwordHash,
        idSecuencial: idSeq,
        numeroCuenta,          
        saldo: 1000,           
        fechaRegistro: new Date()
      };
      const r = await db.collection('usuarios').insertOne(doc, { session });
      nuevoUsuario = { id: r.insertedId, nombre, email, numeroCuenta, saldo: doc.saldo };
    });

    await registrarBitacora({
      usuario: email, accion: 'ALTA_USUARIO', estado: 'exitoso',
      detalle: { numeroCuenta: nuevoUsuario.numeroCuenta }
    });
    res.status(201).json({ mensaje: 'Cuenta creada', usuario: nuevoUsuario });
  } catch (err) {
    await registrarBitacora({
      usuario: email, accion: 'ALTA_USUARIO', estado: 'fallido',
      detalle: { motivo: err.mensaje || err.message }
    });
    if (err.codigo) return res.status(err.codigo).json({ error: err.mensaje });
    
    if (err.code === 11000) return res.status(409).json({ error: 'Correo o cuenta duplicada' });
    res.status(500).json({ error: err.message });
  } finally {
    await session.endSession();
  }
});

// Inicio de sesion 
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const u = await db.collection('usuarios').findOne({ email });
    const ok = u && await bcrypt.compare(password || '', u.passwordHash);

    if (!ok) {
      await registrarBitacora({
        usuario: email, accion: 'LOGIN_FALLIDO', estado: 'fallido',
        detalle: { motivo: 'credenciales invalidas' }
      });
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: u._id.toString(), numeroCuenta: u.numeroCuenta, nombre: u.nombre },
      JWT_SECRET, { expiresIn: JWT_EXPIRA }
    );

    await registrarBitacora({
      usuario: email, accion: 'LOGIN_EXITOSO', estado: 'exitoso',
      detalle: { numeroCuenta: u.numeroCuenta }
    });
    res.json({
      token,
      usuario: { nombre: u.nombre, email: u.email, numeroCuenta: u.numeroCuenta }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Perfil
app.get('/api/perfil', autenticar, async (req, res) => {
  try {
    const u = await db.collection('usuarios').findOne(
      { numeroCuenta: req.usuario.numeroCuenta },
      { projection: { passwordHash: 0 } }     
    );
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(u);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

//Perfil (actualizar datos generales)
app.put('/api/perfil', autenticar, async (req, res) => {
  const { nombre, telefono } = req.body;
  try {
    const cambios = {};
    if (nombre) cambios.nombre = nombre;
    if (telefono !== undefined) cambios.telefono = telefono;
    await db.collection('usuarios').updateOne(
      { numeroCuenta: req.usuario.numeroCuenta }, { $set: cambios }
    );
    res.json({ mensaje: 'Perfil actualizado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});




//Dashboard: saldo disponible 
app.get('/api/dashboard', autenticar, async (req, res) => {
  try {
    const u = await db.collection('usuarios').findOne(
      { numeroCuenta: req.usuario.numeroCuenta },
      { projection: { saldo: 1, nombre: 1, numeroCuenta: 1 } }
    );
    res.json({ nombre: u.nombre, numeroCuenta: u.numeroCuenta, saldo: u.saldo, moneda: 'MXN' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

//Historial de movimientos 
app.get('/api/movimientos', autenticar, async (req, res) => {
  try {
    const mi = req.usuario.numeroCuenta;
    const txs = await db.collection('transacciones')
      .find({ $or: [{ cuentaOrigen: mi }, { cuentaDestino: mi }] })
      .sort({ fecha: -1 })
      .toArray();

    
    const movimientos = txs.map(t => ({
      fecha: t.fecha,
      concepto: t.mensaje || 'Transferencia',
      monto: t.monto,
      tipo: t.cuentaOrigen === mi ? 'cargo' : 'abono',
      cuentaOrigen: t.cuentaOrigen,
      cuentaDestino: t.cuentaDestino
    }));
    res.json(movimientos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});





// Registrar cuenta destino 
app.post('/api/beneficiarios', autenticar, async (req, res) => {
  const { numeroCuenta, alias } = req.body;
  try {
    
    if (!REGEX_CUENTA.test(String(numeroCuenta || ''))) {
      return res.status(400).json({ error: 'El numero de cuenta debe tener exactamente 10 digitos' });
    }
    if (numeroCuenta === req.usuario.numeroCuenta) {
      return res.status(400).json({ error: 'No puedes registrarte a ti mismo' });
    }
    
    const destino = await db.collection('usuarios').findOne({ numeroCuenta });
    if (!destino) return res.status(404).json({ error: 'Esa cuenta no existe en el banco' });

    await db.collection('beneficiarios').updateOne(
      { propietario: req.usuario.numeroCuenta, numeroCuenta },
      { $set: { alias: alias || destino.nombre, nombreReal: destino.nombre } },
      { upsert: true }
    );

    await registrarBitacora({
      usuario: req.usuario.numeroCuenta, accion: 'ALTA_BENEFICIARIO', estado: 'exitoso',
      detalle: { numeroCuenta, alias }
    });
    res.status(201).json({ mensaje: 'Beneficiario registrado', alias: alias || destino.nombre });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

//Listar beneficiarios
app.get('/api/beneficiarios', autenticar, async (req, res) => {
  try {
    const lista = await db.collection('beneficiarios')
      .find({ propietario: req.usuario.numeroCuenta }).toArray();
    res.json(lista);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

//Ejecutar transferencia
app.post('/api/transferencia', autenticar, async (req, res) => {
  const { cuentaDestino, monto, mensaje } = req.body;
  const origen = req.usuario.numeroCuenta;
  const cantidad = Number(monto);

  
  if (!REGEX_CUENTA.test(String(cuentaDestino || ''))) {
    return res.status(400).json({ error: 'Cuenta destino invalida (deben ser 10 digitos)' });
  }
  if (cuentaDestino === origen) {
    return res.status(400).json({ error: 'No puedes transferirte a tu misma cuenta' });
  }
  if (isNaN(cantidad) || cantidad <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un numero mayor a 0' });
  }

  const session = client.startSession();
  try {
    let resultado;
    await session.withTransaction(async () => {
      const cuentaA = await db.collection('usuarios').findOne({ numeroCuenta: origen }, { session });
      const cuentaB = await db.collection('usuarios').findOne({ numeroCuenta: cuentaDestino }, { session });

      if (!cuentaB) throw { codigo: 404, mensaje: 'La cuenta destino no existe' };
      if (cuentaA.saldo < cantidad) throw { codigo: 400, mensaje: 'Fondos insuficientes' };

      // Resta al origen
      await db.collection('usuarios').updateOne(
        { numeroCuenta: origen }, { $inc: { saldo: -cantidad } }, { session }
      );
      // Suma al destino
      await db.collection('usuarios').updateOne(
        { numeroCuenta: cuentaDestino }, { $inc: { saldo: cantidad } }, { session }
      );
      // Registro de la transaccion
      await db.collection('transacciones').insertOne({
        cuentaOrigen: origen,
        cuentaDestino,
        monto: cantidad,
        mensaje: mensaje || 'Transferencia',
        fecha: new Date()
      }, { session });

      resultado = { saldoNuevo: cuentaA.saldo - cantidad };
    });

    await registrarBitacora({
      usuario: origen, accion: 'TRANSFERENCIA_APROBADA', estado: 'exitoso',
      detalle: { origen, destino: cuentaDestino, monto: cantidad }
    });
    res.json({ mensaje: 'Transferencia exitosa', ...resultado });
  } catch (err) {
    await registrarBitacora({
      usuario: origen, accion: 'TRANSFERENCIA_FALLIDA', estado: 'fallido',
      detalle: { origen, destino: cuentaDestino, monto: cantidad, motivo: err.mensaje || err.message }
    });
    if (err.codigo) return res.status(err.codigo).json({ error: err.mensaje });
    res.status(500).json({ error: err.message });
  } finally {
    await session.endSession();
  }
});


//consultar bitacora 
app.get('/api/bitacora', autenticar, async (req, res) => {
  try {
    const lista = await db.collection('bitacora')
      .find({ usuario: { $in: [req.usuario.numeroCuenta, req.usuario.nombre] } })
      .sort({ fecha: -1 }).limit(100).toArray();
    res.json(lista);
  } catch (err) { res.status(500).json({ error: err.message }); }
});



conectarMongo()
  .then(() => {
    app.listen(PORT, () => console.log('Backend escuchando en el puerto', PORT));
  })
  .catch(err => {
    console.error('No se pudo iniciar el backend:', err.message);
    process.exit(1);
  });
