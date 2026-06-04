// Singleton para acceder a io desde cualquier módulo sin dependencia circular
let io;
const setIo = (instance) => { io = instance; };
const getIo = () => io;
module.exports = { setIo, getIo };
