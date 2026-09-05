const prisma = require('../config/prisma');

/**
 * Verifica que el rol del usuario tenga el permiso indicado.
 * Uso: router.get('/', verifyToken, checkPermiso('ver_ventas'), controller)
 */
const checkPermiso = (nombrePermiso) => {
  return async (req, res, next) => {
    try {
      const { id_rol } = req.user;
      const permiso = await prisma.rolPermiso.findFirst({
        where: { id_rol, permiso: { nombre: nombrePermiso } },
      });
      if (!permiso) {
        return res.status(403).json({
          success: false, data: null,
          message: 'No tienes permiso para realizar esta acción',
        });
      }
      next();
    } catch (err) { next(err); }
  };
};

/**
 * Acepta cualquiera de los permisos listados (OR lógico).
 * Uso: router.patch('/:id/estado', verifyToken, checkPermisoAny('cambiar_estado_venta','facturar_pedido'), controller)
 */
const checkPermisoAny = (...nombres) => {
  return async (req, res, next) => {
    try {
      const { id_rol } = req.user;
      for (const nombre of nombres) {
        const found = await prisma.rolPermiso.findFirst({
          where: { id_rol, permiso: { nombre } },
        });
        if (found) return next();
      }
      return res.status(403).json({
        success: false, data: null,
        message: 'No tienes permiso para realizar esta acción',
      });
    } catch (err) { next(err); }
  };
};

/**
 * Exige rol admin exacto -- a diferencia de checkPermiso, no basta con tener
 * un permiso puntual: confirmador_domicilio hoy tiene casi todos los
 * permisos individuales (incluido ver_dashboard) además de los suyos
 * propios, así que ninguna combinación de checkPermiso(...) sirve para
 * ajustes que deben quedar exclusivos del admin (ej. valor del punto de
 * fidelidad, que afecta dinero real de todos los clientes).
 * Uso: router.patch('/valor-punto', verifyToken, checkRolAdmin, controller)
 */
const checkRolAdmin = async (req, res, next) => {
  try {
    const { id_rol } = req.user;
    const rol = await prisma.rol.findUnique({ where: { id_rol } });
    if (!rol || rol.nombre !== 'admin') {
      return res.status(403).json({
        success: false, data: null,
        message: 'Solo un administrador puede realizar esta acción',
      });
    }
    next();
  } catch (err) { next(err); }
};

module.exports = checkPermiso;
module.exports.checkPermisoAny = checkPermisoAny;
module.exports.checkRolAdmin = checkRolAdmin;
