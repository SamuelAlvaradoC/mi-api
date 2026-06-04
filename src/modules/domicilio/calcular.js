// Sede Aranjuez (origen principal para cálculo de domicilio)
// Sede La Milagrosa: Carrera 29 #42-49 — lat: 6.2372, lng: -75.5688
// Cuando se activen domicilios desde La Milagrosa, calcular desde la sede más cercana al cliente.
const ORIGEN = { lat: 6.2897, lng: -75.5557 };
const TARIFA_BASE = 5500;
const MUNICIPIOS_SUR   = ['Itagüí', 'Envigado', 'Sabaneta', 'La Estrella', 'Caldas'];
const MUNICIPIOS_NORTE = ['Bello', 'Copacabana'];
// Medellín usa tarifa norte $1.300/km

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
  const ORS_KEY = process.env.ORS_API_KEY;
  const esSur   = MUNICIPIOS_SUR.some((m) => (ciudad || '').toLowerCase().includes(m.toLowerCase()));
  const esNorte = MUNICIPIOS_NORTE.some((m) => (ciudad || '').toLowerCase().includes(m.toLowerCase()));
  const tarifa  = esSur ? 1400 : 1300;

  let distKm;

  if (ORS_KEY) {
    try {
      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_KEY}&start=${ORIGEN.lng},${ORIGEN.lat}&end=${lng},${lat}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('ORS HTTP ' + resp.status);
      const data = await resp.json();
      distKm = data.features[0].properties.segments[0].distance / 1000;
      console.log('ORS distancia real:', distKm.toFixed(2), 'km →', ciudad);
    } catch (e) {
      console.error('ORS falló, usando línea recta:', e.message);
      distKm = calcularDistanciaLinea(lat, lng) * 1.3;
    }
  } else {
    distKm = calcularDistanciaLinea(lat, lng) * 1.3;
  }

  const costoExacto = TARIFA_BASE + distKm * tarifa;
  const costo = Math.round(costoExacto / 1000) * 1000; // redondear al millar más cercano
  return {
    costo,
    distKm: Math.round(distKm * 10) / 10,
    tarifa,
    esSur,
  };
};

module.exports = { calcularCostoDomicilio };
