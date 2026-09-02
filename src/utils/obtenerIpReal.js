const { ipKeyGenerator } = require('express-rate-limit');

// Render sirve todo el tráfico detrás de Cloudflare (confirmado: la
// respuesta trae "Server: cloudflare"), y Cloudflare a su vez reenvía a
// Render's propio balanceador antes de llegar a este contenedor -- son
// 2 saltos de proxy, no 1. `app.set('trust proxy', 1)` (en app.js) solo
// confía en 1 salto, así que `req.ip` termina resolviendo la dirección
// INTERNA de la infraestructura de Render (rangos privados 10.x.x.x, e
// incluso "::1" en algún caso observado) en vez de la IP real del
// cliente -- confirmado revisando el campo ips_conocidas de usuarios
// reales: la misma persona logueándose repetidamente desde la misma red
// terminaba con ~10 direcciones 10.x distintas registradas.
//
// Cloudflare pone la IP real del visitante en su propio header
// "CF-Connecting-IP", que ellos mismos sobrescriben en su borde --
// a diferencia de X-Forwarded-For, el cliente NO puede falsificarlo
// (Cloudflare lo establece de forma autoritativa, ignorando cualquier
// valor que el cliente intente mandar). Por eso se prioriza sobre
// req.ip en vez de simplemente ajustar el número de "trust proxy"
// (que quedaría frágil ante cualquier cambio futuro en la
// infraestructura de Render).
const obtenerIpReal = (req) => req.headers['cf-connecting-ip'] || req.ip;

// Para usar como `keyGenerator` de express-rate-limit: la librería exige
// pasar cualquier IP por su propio ipKeyGenerator() para IPv6 -- una
// dirección IPv6 cambia de sufijo entre conexiones aunque sea el mismo
// cliente/red, así que usar el string crudo como key dejaría que alguien
// con IPv6 se saltara el límite con solo reconectarse. ipKeyGenerator
// normaliza IPv6 a su bloque /56 (deja IPv4 intacto).
const obtenerIpKeyLimiter = (req) => ipKeyGenerator(obtenerIpReal(req));

module.exports = { obtenerIpReal, obtenerIpKeyLimiter };
