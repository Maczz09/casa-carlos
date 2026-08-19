' Arranca el asistente de WhatsApp SIN ventana, en segundo plano.
'
' Windows no permite lanzar un proceso de consola sin que parpadee una ventana
' negra, salvo desde un host sin consola: por eso este .vbs (lo corre wscript,
' que no tiene consola) en vez de apuntar el acceso directo al .cmd. El "0" es
' ventana oculta y el "False" es no esperar a que termine.
'
' Todo lo que el agente tenga para decir queda en data\whatsapp-agent.log --
' nadie tiene que mirar una consola para saber qué pasó.
Dim shell, carpeta
Set shell = CreateObject("WScript.Shell")
carpeta = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)
shell.CurrentDirectory = carpeta & "\..\apps\whatsapp-agent"
shell.Run """" & carpeta & "\..\vendor\node-win-x64\node.exe"" --import tsx """ & carpeta & "\..\apps\whatsapp-agent\src\index.ts""", 0, False
