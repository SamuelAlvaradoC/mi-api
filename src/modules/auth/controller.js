const authService = require('./service');
const { loginSchema, registerSchema, recuperarSchema, cambiarContrasenaSchema, editarPerfilSchema,
        solicitarResetSchema, verificarResetSchema } = require('./schema');
const { success } = require('../../utils/response');

const login = async (req, res, next) => {
  try {
    const datos = loginSchema.parse(req.body);
    success(res, await authService.login(datos), 'Login exitoso');
  } catch (err) { next(err); }
};

const register = async (req, res, next) => {
  try {
    const datos = registerSchema.parse(req.body);
    success(res, await authService.register(datos), 'Usuario registrado', 201);
  } catch (err) { next(err); }
};

const logout = (req, res, next) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    success(res, authService.logout(token), 'Sesión cerrada');
  } catch (err) { next(err); }
};

const recuperarContrasena = async (req, res, next) => {
  try {
    const { email } = recuperarSchema.parse(req.body);
    success(res, await authService.recuperarContrasena({ email }), 'Token de recuperación generado');
  } catch (err) { next(err); }
};

const cambiarContrasena = async (req, res, next) => {
  try {
    const datos = cambiarContrasenaSchema.parse(req.body);
    success(res, await authService.cambiarContrasena(datos), 'Contraseña actualizada');
  } catch (err) { next(err); }
};

const getPerfil = async (req, res, next) => {
  try {
    success(res, await authService.getPerfil(req.user.id_usuario));
  } catch (err) { next(err); }
};

const editarPerfil = async (req, res, next) => {
  try {
    const datos = editarPerfilSchema.parse(req.body);
    success(res, await authService.editarPerfil(req.user.id_usuario, datos), 'Perfil actualizado');
  } catch (err) { next(err); }
};

const desactivarCuenta = async (req, res, next) => {
  try {
    success(res, await authService.desactivarCuenta(req.user.id_usuario), 'Cuenta desactivada');
  } catch (err) { next(err); }
};

const misDirecciones = async (req, res, next) => {
  try {
    const prisma = require('../../config/prisma');
    let cliente = await prisma.cliente.findUnique({ where: { id_usuario: req.user.id_usuario } });
    if (!cliente) cliente = await prisma.cliente.create({ data: { id_usuario: req.user.id_usuario } });
    const dirs = await prisma.direccion.findMany({
      where: { id_cliente: cliente.id_cliente, estado: 1 },
      include: { barrioRel: { select: { id_barrio: true, nombre: true, precio_domicilio: true } } },
    });
    success(res, dirs);
  } catch (err) { next(err); }
};

const crearMiDireccion = async (req, res, next) => {
  try {
    const prisma = require('../../config/prisma');
    let cliente = await prisma.cliente.findUnique({ where: { id_usuario: req.user.id_usuario } });
    if (!cliente) cliente = await prisma.cliente.create({ data: { id_usuario: req.user.id_usuario } });
    const { direccion_linea, barrio, ciudad, departamento, referencia, lat, lng, id_barrio } = req.body;
    if (!direccion_linea?.trim()) throw { status: 400, message: 'La dirección es requerida' };
    const existente = await prisma.direccion.findFirst({
      where: {
        id_cliente: cliente.id_cliente,
        direccion_linea,
        barrio: barrio || null,
        ciudad: ciudad || null,
      },
    });
    if (existente) {
      if (!existente.id_barrio && id_barrio) {
        const actualizada = await prisma.direccion.update({
          where: { id_direccion: existente.id_direccion },
          data:  { id_barrio: Number(id_barrio) },
          include: { barrioRel: { select: { id_barrio: true, nombre: true, precio_domicilio: true } } },
        });
        return success(res, actualizada);
      }
      return success(res, existente);
    }
    const dir = await prisma.direccion.create({
      data: {
        id_cliente: cliente.id_cliente,
        direccion_linea,
        barrio:      barrio      || null,
        ciudad:      ciudad      || null,
        departamento: departamento || null,
        referencia:  referencia  || null,
        lat:         lat         || null,
        lng:         lng         || null,
        id_barrio:   id_barrio   ? Number(id_barrio) : null,
        estado: 1,
      },
      include: { barrioRel: { select: { id_barrio: true, nombre: true, precio_domicilio: true } } },
    });
    success(res, dir, 'Dirección creada', 201);
  } catch (err) { next(err); }
};

const cambiarContrasenaAuth = async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const prisma = require('../../config/prisma');
    const { contrasena_actual, nueva_contrasena } = req.body;
    if (!contrasena_actual || !nueva_contrasena) throw { status: 400, message: 'Faltan campos requeridos' };
    const usuario = await prisma.usuario.findUnique({ where: { id_usuario: req.user.id_usuario } });
    const valida = await bcrypt.compare(contrasena_actual, usuario.contrasena);
    if (!valida) throw { status: 401, message: 'Contraseña actual incorrecta' };
    const hash = await bcrypt.hash(nueva_contrasena, 10);
    await prisma.usuario.update({ where: { id_usuario: req.user.id_usuario }, data: { contrasena: hash } });
    success(res, null, 'Contraseña actualizada');
  } catch (err) { next(err); }
};

const eliminarMiDireccion = async (req, res, next) => {
  try {
    const prisma = require('../../config/prisma');
    const id = Number(req.params.id);
    const cliente = await prisma.cliente.findUnique({ where: { id_usuario: req.user.id_usuario } });
    if (!cliente) throw { status: 404, message: 'Perfil de cliente no encontrado' };
    const dir = await prisma.direccion.findFirst({ where: { id_direccion: id, id_cliente: cliente.id_cliente } });
    if (!dir) throw { status: 404, message: 'Dirección no encontrada' };
    await prisma.direccion.update({ where: { id_direccion: id }, data: { estado: 0 } });
    success(res, null, 'Dirección eliminada');
  } catch (err) { next(err); }
};

const solicitarReset = async (req, res, next) => {
  try {
    const { email } = solicitarResetSchema.parse(req.body);
    success(res, await authService.solicitarReset({ email }), 'Código enviado');
  } catch (err) { next(err); }
};

const verificarReset = async (req, res, next) => {
  try {
    const datos = verificarResetSchema.parse(req.body);
    success(res, await authService.verificarReset(datos), 'Contraseña actualizada');
  } catch (err) { next(err); }
};

const misPermisos = async (req, res, next) => {
  try {
    const prisma = require('../../config/prisma');
    const rol = await prisma.rol.findUnique({
      where: { id_rol: req.user.id_rol },
      include: { rolPermisos: { include: { permiso: true } } },
    });
    const permisos = (rol?.rolPermisos || []).map((rp) => rp.permiso?.nombre).filter(Boolean);
    success(res, permisos);
  } catch (err) { next(err); }
};

module.exports = { login, register, logout, recuperarContrasena, cambiarContrasena,
  solicitarReset, verificarReset,
  getPerfil, editarPerfil, desactivarCuenta, misDirecciones, crearMiDireccion, eliminarMiDireccion, cambiarContrasenaAuth, misPermisos };
