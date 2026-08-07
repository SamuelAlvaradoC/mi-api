const { Router } = require('express');
const controller = require('./controller');
const verifyToken = require('../../middlewares/verifyToken');

const router = Router();

// Públicos
router.post('/login',               controller.login);
router.post('/register',            controller.register);

// Recuperación con código de 6 dígitos (email vía Resend)
router.post('/solicitar-reset',  controller.solicitarReset);
router.post('/verificar-reset',  controller.verificarReset);

// Protegidos (solo requieren token válido, no permiso específico)
router.post('/logout',                  verifyToken, controller.logout);
router.get('/perfil',                   verifyToken, controller.getPerfil);
router.patch('/perfil',                 verifyToken, controller.editarPerfil);
router.patch('/desactivar-cuenta',      verifyToken, controller.desactivarCuenta);
router.get('/mis-direcciones',          verifyToken, controller.misDirecciones);
router.post('/mis-direcciones',          verifyToken, controller.crearMiDireccion);
router.delete('/mis-direcciones/:id',    verifyToken, controller.eliminarMiDireccion);
router.patch('/cambiar-contrasena-auth', verifyToken, controller.cambiarContrasenaAuth);
router.get('/mis-permisos',             verifyToken, controller.misPermisos);

module.exports = router;
