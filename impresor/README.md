# Sistema de impresión ChocoFreseo — Inicio automático

Este documento explica cómo quedó configurado el arranque automático del
impresor, por si en algún momento hay que **reinstalarlo en otro
computador** del negocio (por ejemplo, si se cambia de PC en el punto de
venta).

## Cómo funciona

`impresor.js` es un cliente de Socket.IO que se conecta al backend
(`https://mi-api-qpjo.onrender.com`) y queda escuchando 3 eventos:
`pedido_listo`, `reimprimir`, `imprimir_cierre`. Cuando llega uno, imprime
el ticket físico en la impresora térmica configurada. Tiene reconexión
automática (`reconnection: true, reconnectionAttempts: Infinity`), así
que una caída breve de internet no lo mata — se reconecta solo.

**Mientras este programa no esté corriendo, nada se imprime.** El
backend simplemente transmite el evento a quien esté conectado en ese
momento — si no hay nadie escuchando, no hay ningún error ni aviso en
ningún lado, el pedido/ticket simplemente no sale impreso.

## Cómo queda arrancando solo con Windows

**Mecanismo elegido: acceso directo en la carpeta de Inicio de Windows**
(`shell:startup`), NO una Tarea Programada.

### Por qué no Tarea Programada (`schtasks`)

Se intentó primero con una Tarea Programada (`schtasks /create /sc onlogon`),
que en teoría es más robusta. Pero **requiere permisos de Administrador**
para crearse — `INSTALAR.bat` la creaba sin pedir elevación, así que en
cualquier PC donde el instalador se ejecutara con doble clic normal (no
"Ejecutar como administrador", que es lo normal para un usuario no
técnico), `schtasks` fallaba con "Acceso denegado" **en silencio** — el
.bat solo mostraba una advertencia fácil de ignorar y seguía adelante.
Esta fue la causa real de que el arranque automático nunca quedara
configurado, y por eso el cliente dependía 100% de abrir el programa a
mano cada día (y algunos días se le olvidaba).

### Por qué carpeta de Inicio en vez de servicio de Windows (`node-windows`)

Se evaluó también convertirlo en un servicio real de Windows (con
`node-windows`), que sobrevive incluso sin nadie loggeado. Se descartó
porque en este caso **no aporta nada real**: el mismo computador necesita
tener a alguien loggeado de todas formas para usar el panel admin desde
el navegador, así que "funciona sin sesión iniciada" no es un escenario
que realmente ocurra en la tienda. A cambio, `node-windows` agrega una
dependencia nueva, un instalador más complejo, y los servicios de
Windows son más difícil de inspeccionar/reiniciar para alguien no
técnico que un simple acceso directo en una carpeta.

### La solución: carpeta de Inicio + ventana oculta

- **No requiere permisos de Administrador** — crear un acceso directo en
  la carpeta de Inicio del usuario es una operación normal, sin
  elevación (verificado: `INSTALAR.bat` corrido sin "Ejecutar como
  administrador" sí logra crear el acceso directo).
- El acceso directo no apunta a `impresor.js` ni a `INICIAR_IMPRESOR.bat`
  directo (eso mostraría una ventana de consola negra cada vez que se
  enciende el PC, lo cual puede confundir/asustar a alguien no técnico,
  o peor: que la cierren pensando que es un error, recreando el mismo
  problema). Apunta a **`iniciar_oculto.vbs`**, que lanza
  `node impresor.js` con la ventana completamente oculta
  (`WScript.Shell.Run(..., 0, False)`).
- La salida (logs) se sigue guardando en `logs.txt` igual que siempre,
  así que sigue siendo posible revisar qué pasó aunque no haya ventana
  visible.

## Qué hace `INSTALAR.bat` ahora

1. Verifica/instala Node.js si hace falta.
2. Corre `npm install` para las dependencias (`socket.io-client`, `jimp`).
3. Crea el acceso directo en `shell:startup` → `iniciar_oculto.vbs`
   (arranque automático real, silencioso).
4. Crea un acceso directo adicional en el **Escritorio** →
   `INICIAR_IMPRESOR.bat` (con ventana visible, por si hace falta
   iniciarlo a mano para ver los logs en vivo o diagnosticar un problema).

## Cómo reinstalar en otro computador

1. Copia toda la carpeta `impresor/` (o clona el repo) al nuevo PC.
2. Conecta la impresora térmica y enciéndela.
3. Abre `impresor.js` con el Bloc de notas y cambia
   `NOMBRE_IMPRESORA` por el nombre exacto de la impresora en ese PC
   (Panel de control → Dispositivos e impresoras).
4. Doble clic en `INSTALAR.bat`. **No hace falta "Ejecutar como
   administrador"** — funciona con doble clic normal.
5. Al terminar, verifica que exista el acceso directo:
   `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ChocoFreseo Impresor.lnk`
   (se puede llegar ahí escribiendo `shell:startup` en la barra de
   direcciones del Explorador de Windows).
6. Reinicia el PC (o cierra sesión y vuelve a entrar) para confirmar
   que arranca solo — revisa `logs.txt` y debería aparecer
   "Conectado al servidor ChocoFreseo" sin que nadie abriera nada.

## Cómo confirmar que está corriendo en cualquier momento

- Abre el Administrador de tareas → pestaña "Detalles" → busca
  `node.exe` (no tendrá ventana asociada, es normal, corre oculto).
- O revisa las últimas líneas de `logs.txt` en esta carpeta.
