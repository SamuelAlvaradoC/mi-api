' Lanza impresor.js en segundo plano, sin ventana visible.
' Se auto-ubica (no depende de en qué carpeta se instale) -- por eso el
' acceso directo de la carpeta de Inicio de Windows apunta a este archivo
' en vez de directo a impresor.js o a un .bat con consola visible.
Set fso = CreateObject("Scripting.FileSystemObject")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = carpeta
' 0 = ventana oculta, False = no esperar a que termine (impresor.js corre indefinidamente)
shell.Run "cmd /c node impresor.js >> logs.txt 2>&1", 0, False
