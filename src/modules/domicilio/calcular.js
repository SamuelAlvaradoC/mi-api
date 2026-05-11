const ORIGEN = { lat: 6.2897, lng: -75.5557 };

const MUNICIPIOS_SUR = ['Itagüí', 'Envigado', 'Sabaneta', 'La Estrella', 'Caldas'];
const MUNICIPIOS_NORTE = ['Bello', 'Copacabana'];
const TARIFA_BASE = 5500;
const TARIFA_NORTE = 1300;
const TARIFA_SUR = 1400;
const TARIFA_MEDELLIN = 1300;

const distanciaLinea = (lat, lng) => {
  const R = 6371;
  const dLat = (lat - ORIGEN.lat) * Math.PI / 180;
  const dLng = (lng - ORIGEN.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(ORIGEN.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getTarifa = (ciudad) => {
  if (MUNICIPIOS_SUR.includes(ciudad)) return TARIFA_SUR;
  if (MUNICIPIOS_NORTE.includes(ciudad)) return TARIFA_NORTE;
  return TARIFA_MEDELLIN;
};

const calcularCostoDomicilio = async (lat, lng, ciudad = '') => {
  const ORS_KEY = process.env.ORS_API_KEY;
  const tarifa = getTarifa(ciudad);

  if (!ORS_KEY || ORS_KEY === 'TU_KEY_AQUI') {
    const distKm = distanciaLinea(lat, lng);
    return Math.ceil(TARIFA_BASE + distKm * tarifa);
  }

  try {
    const resp = await fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?` +
      `api_key=${ORS_KEY}&start=${ORIGEN.lng},${ORIGEN.lat}&end=${lng},${lat}`
    );
    const data = await resp.json();
    const distKm = data.features[0].properties.segments[0].distance / 1000;
    return Math.ceil(TARIFA_BASE + distKm * tarifa);
  } catch (e) {
    console.error('ORS error:', e.message);
    const distKm = distanciaLinea(lat, lng);
    return Math.ceil(TARIFA_BASE + distKm * tarifa);
  }
};

module.exports = { calcularCostoDomicilio };
