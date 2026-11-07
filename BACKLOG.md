# Backlog — Metría Android 1.2.1

Estados: **Pendiente** · **En curso** · **En revisión** (probado de forma
automatizada, falta dispositivo) · **Verificado** (probado en Android real) ·
**Hecho**.

## Núcleo y seguridad

| # | Función | Estado | Notas |
|---|---|---|---|
| A1 | Contraseña maestra + scrypt + AES-256-GCM compatibles con escritorio | En revisión | Pruebas cruzadas con el crypto de Node; falta dispositivo |
| A2 | Frase de recuperación y recuperación de acceso | En revisión | No escribe a disco hasta confirmar; probado en UI |
| A3 | Formato `data-store.json` idéntico al escritorio | En revisión | Ida y vuelta probada |
| A4 | Respaldos automáticos (15) y copia previa a importar (5) | En revisión | Rotación y deduplicación probadas |
| A5 | Escritura atómica y recuperación ante rename fallido | En revisión | Probado con adaptador simulado |
| A6 | Bloqueo por inactividad y al pasar a segundo plano | En revisión | Respeta el ajuste; 0 = Nunca. Probado con temporizadores simulados; falta pantalla apagada real |
| A7 | `allowBackup=false`, sin transferencia D2D, sin INTERNET, sin tráfico claro | Hecho | Verificado en el manifiesto del APK |

## Funciones financieras (heredadas del escritorio)

| # | Función | Estado |
|---|---|---|
| F01 | Cuentas con capital inicial | En revisión |
| F02 | Ingresos y gastos | En revisión |
| F03 | Caja chica | En revisión |
| F04 | Transferencias con comisión | En revisión |
| F05 | Deudas y abonos | En revisión |
| F06 | Deudas liquidadas | En revisión |
| F07 | Métodos de pago: color, ícono, edición | En revisión |
| F08 | Inicio: balance y distribución | En revisión |
| F09 | Resumen por periodo | En revisión |
| F10 | Edición universal de movimientos | En revisión |
| F11 | Eliminar cuenta con transferencia o gasto bloqueado | En revisión |
| F12 | Respaldo manual cifrado (exportar/importar) | En revisión |
| F13 | Modo claro/oscuro | En revisión |
| F14 | Borrar todos los datos | En revisión |
| F15 | Versión visible | En revisión |
| F17 | Bloqueo automático | En revisión |
| F18 | Aviso de movimiento duplicado | En revisión |
| F26–F38 | Rediseño visual, barra inferior, reportes, flujo, tamaño de vista | En revisión |

## Android específico

| # | Función | Estado | Notas |
|---|---|---|---|
| A8 | Exportar respaldo con hoja de compartir | En revisión | Contrato probado con plugins simulados; falta hoja real |
| A9 | Importar respaldo con selector de archivos | En revisión | `beginExternalActivity` evita el bloqueo; falta selector real |
| A10 | Íconos adaptativos y splash | Hecho | Logotipo oficial desde 1.2.1 |
| A11 | Firma release y actualizaciones | Hecho | Llave en `~/.metria-keys` |
| A12 | Build local reproducible | Hecho | `scripts/build.sh` |
| A13 | Cada botón e interruptor responde con un solo toque | En revisión | Se restauró `#toast` y se evitan repintados asíncronos; probado en UI con toques simulados |
| A13 | CI con GitHub Actions | Hecho | Debug siempre; release con secretos |
| A14 | Instalar y probar en teléfono físico | **Pendiente** | Bloqueado: no hay dispositivo conectado |
| A15 | Desbloqueo con huella/rostro (Keystore + `BIOMETRIC_STRONG`) | En revisión | Plugin nativo y UI listos; falta `BiometricPrompt` real |
| A16 | Autofill para Proton Pass y otros gestores | En revisión | Atributos HTML y WebView listos; falta probar la asociación real |

## Prueba en dispositivo (checklist)

Al conectar un teléfono o instalar el APK:

1. Crear cuenta, guardar frase y confirmar.
2. Cerrar y abrir: debe pedir contraseña.
3. Apagar la pantalla y volver: debe pedir contraseña solo si se cumplió el
   tiempo configurado (con “Nunca”, no).
4. Esperar el tiempo de autobloqueo: debe pedir contraseña.
5. Activar biometría en Ajustes; bloquear y desbloquear con huella/rostro.
6. Cancelar el diálogo biométrico y entrar con contraseña.
7. Reiniciar el teléfono: debe pedir contraseña una vez y luego permitir biometría.
8. Agregar una huella nueva: la biometría debe desactivarse y pedir contraseña.
9. Abrir un formulario de acceso con Proton Pass: debe ofrecer rellenar y, si se
   elige “Use always”, conservar la asociación.
10. Crear cuenta, ingreso, gasto, transferencia con comisión y abono.
11. Exportar respaldo: debe abrir la hoja de compartir y guardar el `.json`.
12. Importar ese respaldo: debe pedir la contraseña del respaldo y restaurar.
13. Importar un respaldo exportado desde el escritorio.
14. Abrir el `data-store.json` de Android en el escritorio (si se puede extraer).
15. Rotar el teléfono y abrir el teclado en un formulario.
16. Revisar que la barra inferior y los modales respeten las safe areas.

## Mejoras futuras (no bloquean 1.2.1)

- Exportar a CSV/PDF.
- Widget de saldo.
- Pruebas instrumentadas (Espresso) para el WebView.
