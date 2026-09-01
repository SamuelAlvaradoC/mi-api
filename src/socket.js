// Singleton para acceder a io desde cualquier módulo sin dependencia circular
let io;
const setIo = (instance) => { io = instance; };
const getIo = () => io;

// El impresor (impresor.js) se une a esta room al conectarse (ver
// server.js) -- así el backend puede saber si hay alguien realmente
// escuchando antes de decirle al panel que "ya se envió a imprimir".
// Antes no había forma de saberlo: io.emit() manda el evento igual sin
// importar si hay 0 o 10 impresores conectados.
const ROOM_IMPRESOR = 'impresores';
const hayImpresorConectado = () => {
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(ROOM_IMPRESOR);
  return !!room && room.size > 0;
};

module.exports = { setIo, getIo, ROOM_IMPRESOR, hayImpresorConectado };
