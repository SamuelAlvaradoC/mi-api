require('dotenv').config();
const { createServer } = require('http');
const { Server }       = require('socket.io');
const app              = require('./app');
const { setIo }        = require('./socket');

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

  socket.on('reimprimir', (venta) => {
    io.emit('reimprimir', venta);
  });

  socket.on('imprimir_cierre', (datos) => {
    io.emit('imprimir_cierre', datos);
  });

  socket.on('disconnect', () => {
    console.log('Socket desconectado:', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
