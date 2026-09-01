require('dotenv').config();
const { createServer } = require('http');
const { Server }       = require('socket.io');
const app              = require('./app');
const { setIo, ROOM_IMPRESOR } = require('./socket');

const PORT       = process.env.PORT || 3000;
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:3001',
      'http://localhost:3002',
      'https://chocofreseo-web.vercel.app',
      'https://chocofreseo.com',
      'https://www.chocofreseo.com',
    ],
    methods: ['GET', 'POST'],
  },
});

setIo(io);

io.on('connection', (socket) => {
  console.log('Socket conectado:', socket.id);

  // impresor.js se identifica con ?tipo=impresor al conectarse (ver
  // impresor.js) -- se une a esta room para que el backend pueda saber
  // si hay algún impresor realmente conectado (ver socket.js). El
  // socket sale de la room automáticamente al desconectarse, Socket.IO
  // lo maneja solo.
  if (socket.handshake.query?.tipo === 'impresor') {
    socket.join(ROOM_IMPRESOR);
    console.log('  → Identificado como impresor:', socket.id);
  }

  // El socket no tiene autenticación — nunca se reenvía tal cual lo que manda
  // el cliente (un ticket o un cierre de caja falsos se podrían imprimir si se
  // confiara en esos datos). Solo se toma el identificador (id_venta / fecha)
  // y el payload real se reconstruye siempre desde la base de datos.
  socket.on('reimprimir', async (payload) => {
    try {
      const idVenta = Number(payload?.id_venta);
      if (!idVenta) return;
      const ventasService = require('./modules/ventas/service');
      const datos = await ventasService.armarPayloadImpresion(idVenta);
      io.emit('reimprimir', datos);
    } catch (e) {
      console.error('Error armando reimpresión:', e.message);
    }
  });

  socket.on('imprimir_cierre', async (payload) => {
    try {
      const cierreCajaService = require('./modules/cierreCaja/service');
      const fechaISO = payload?.fechaISO || undefined;
      const resumen = await cierreCajaService.resumenDia(fechaISO);
      io.emit('imprimir_cierre', {
        ...resumen,
        // Texto de fecha legible para el ticket; si el cliente mandó uno ya
        // formateado se respeta, pero los NÚMEROS siempre son los reales.
        fecha: payload?.fecha || resumen.fecha,
      });
    } catch (e) {
      console.error('Error armando cierre para imprimir:', e.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket desconectado:', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
