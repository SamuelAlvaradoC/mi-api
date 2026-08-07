const authService = require('./service');
const { loginSchema, registerSchema, editarPerfilSchema,
        solicitarResetSchema, verificarResetSchema, crearDireccionSchema } = require('./schema');
const { success } = require('../../utils/response');

const login = async (req, res, next) => {
  try {
    const datos = loginSchema.parse(req.body);
    success(res, await authService.login({ ...datos, ip: req.ip }), 'Login exitoso');
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
    const { direccion_linea, barrio, ciudad, departamento, referencia, id_barrio } = crearDireccionSchema.parse(req.body);
    const existente = await prisma.direccion.findFirst({
      where: {
        id_cliente: cliente.id_cliente,
        direccion_linea,
        barrio: barrio || null,
        ciudad: ciudad || null,
      },
    });
    if (existente) {
      const updateData = {};
      if (existente.estado === 0) updateData.estado = 1;
      if (!existente.id_barrio && id_barrio) updateData.id_barrio = Number(id_barrio);
      if (Object.keys(updateData).length > 0) {
        const actualizada = await prisma.direccion.update({
          where: { id_direccion: existente.id_direccion },
          data: updateData,
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
    if (nueva_contrasena.length < 8) throw { status: 400, message: 'La contraseña debe tener al menos 8 caracteres' };
    const usuario = await prisma.usuario.findUnique({ where: { id_usuario: req.user.id_usuario } });
    const valida = await bcrypt.compare(contrasena_actual, usuario.contrasena);
    if (!valida) throw { status: 401, message: 'Contraseña actual incorrecta' };
    const igual = await bcrypt.compare(nueva_contrasena, usuario.contrasena);
    if (igual) throw { status: 400, message: 'La nueva contraseña debe ser diferente a la actual' };
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

module.exports = { login, register, logout,
  solicitarReset, verificarReset,
  getPerfil, editarPerfil, desactivarCuenta, misDirecciones, crearMiDireccion, eliminarMiDireccion, cambiarContrasenaAuth, misPermisos };
