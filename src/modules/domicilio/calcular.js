// Sede Aranjuez (origen principal para cálculo de domicilio)
// Sede La Milagrosa: Carrera 29 #42-49 — lat: 6.2372, lng: -75.5688
// Cuando se activen domicilios desde La Milagrosa, calcular desde la sede más cercana al cliente.
const ORIGEN = { lat: 6.281914, lng: -75.560668 };
// TARIFA_BASE se calcula dinámicamente según distancia (ver tarifaBase en calcularCostoDomicilio)
// Zona determinada por lat del cliente vs ORIGEN.lat
// (no por el texto "ciudad" que el cliente ingresa)
// Sur: lat_cliente < ORIGEN.lat  |  Norte: lat_cliente >= ORIGEN.lat

const calcularDistanciaLinea = (lat, lng) => {
  const R = 6371;
  const dLat = (lat - ORIGEN.lat) * Math.PI / 180;
  const dLng = (lng - ORIGEN.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(ORIGEN.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calcularCostoDomicilio = async (lat, lng, ciudad = '') => {
  const esSur  = lat < ORIGEN.lat;
  const tarifa = 1300;

  // Línea recta × 1.2 (más predecible para motos que rutas de carro)
  const distKm = calcularDistanciaLinea(lat, lng) * 1.2;

  const costoExacto = 5500 + distKm * tarifa;
  const costo       = Math.round(costoExacto / 1000) * 1000;
  return {
    costo,
    distKm: Math.round(distKm * 10) / 10,
    tarifa,
    esSur,
  };
};

module.exports = { calcularCostoDomicilio };
