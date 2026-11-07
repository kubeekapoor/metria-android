# Changelog — Metría Android

Formato: `YYYY-MM-DD · área · cambio`.

## [1.2.1] — 2026-11-06

### Icono y pantalla de inicio
- El icono del lanzador usa el logotipo oficial: M blanca y barras de turquesa
  a azul sobre fondo `#08080D`.
- Iconos legacy, redondos y adaptativos regenerados desde los PNG oficiales;
  se añadió la capa monocroma para los iconos tematizados de Android 13+.
- El splash muestra solo el símbolo, sin wordmark ni lema.
- `versionName 1.2.1`, `versionCode 4`.

### Interfaz
- La leyenda inferior de la app pasa a «POWERED BY BRACCOS TEAM».

## [1.2.0] — 2026-11-04

### Nuevo diseño
- Identidad visual renovada: fondo oscuro (`#08080D`), tarjetas elevadas
  (`#13141C`), acento azul (`#4C6FFF`), verde para ingresos, rojo para gastos y
  ámbar para deudas. Colores sólidos, sin degradados.
- Inicio con la marca M, subtítulo «Tus finanzas, en orden» y tarjeta de balance
  con icono de billetera y cifras jerarquizadas.
- Gráfica de flujo en verde/rojo, movimientos recientes con iconos tintados por
  categoría y barra inferior con el FAB azul.
- Pantalla de acceso rediseñada con la misma marca y el nuevo acento.
- El tema oscuro pasa a ser el predeterminado; el tema claro sigue disponible y
  se conserva la preferencia guardada.
- La franja del notch y las barras del sistema usan el color del tema activo.

### Icono y pantallas de inicio
- Nuevo icono: monograma M plegado con paneles azules sobre fondo oscuro.
- Iconos legacy, redondos y adaptativos regenerados en todas las densidades.
- Splash con la marca, el nombre y el lema, acorde con el nuevo diseño.

### Ajustes internos
- `color-scheme` se limita al acceso y sigue al tema de la app, para que los
  selectores y el selector de fecha nativos se vean correctos en ambos temas.
- Los montos del desglose por categoría usan color neutro: el verde/rojo queda
  reservado para ingresos y gastos.
- Se retiraron los brillos verdes heredados de la versión anterior en deudas
  liquidadas.

## [1.1.0] — 2026-11-04

### Desbloqueo biométrico
- Plugin nativo `MetriaBiometric` + `androidx.biometric:biometric:1.1.0`.
- La llave maestra se cifra con AES-256-GCM usando una llave del Android
  Keystore que exige `BIOMETRIC_STRONG`; la contraseña nunca se guarda.
- La llave se invalida si se inscribe una biometría nueva; Metría desactiva el
  acceso y pide la contraseña.
- Botón “Desbloquear con huella o rostro” en la pantalla de acceso y apertura
  automática del diálogo al bloquear.
- Ajuste “Usar huella o rostro para desbloquear” en Ajustes → Seguridad.
- Tras reiniciar el teléfono se pide la contraseña una vez (se usa
  `Settings.Global.BOOT_COUNT`); después la biometría vuelve a estar disponible.
- Permisos normales `USE_BIOMETRIC` y `USE_FINGERPRINT` (máx. API 27). Sin
  permiso de INTERNET.

### Bloqueo al salir
- Pasar a segundo plano ya **no** bloquea al instante: se respeta el ajuste de
  inactividad (1/5/15/30 min).
- Con “Nunca” (0) la app no se bloquea sola ni al salir.
- Al volver se comprueba el tiempo transcurrido, porque Android puede pausar los
  temporizadores en segundo plano.
- Elegir un archivo o compartir un respaldo sigue sin contar como inactividad.

### Autofill (Proton Pass y otros gestores)
- Se quitó `autocomplete="off"` del formulario de acceso y se añadieron `name`,
  `autocapitalize`, `autocorrect` y `spellcheck` a los campos.
- La WebView usa `setImportantForAutofill(IMPORTANT_FOR_AUTOFILL_YES)` y
  `setSaveFormData(true)` en `MainActivity`.
- No se cambió el origen `https://localhost`; la asociación definitiva depende
  del gestor de contraseñas.

### Respuesta de la interfaz
- Se restauró el contenedor de avisos `#toast`, que faltaba en `index.html`: cada
  `showToast()` lanzaba un error y detenía el manejador **antes** de repintar.
  Eso hacía que un botón pareciera no responder o que el cambio solo se viera al
  salir y volver a entrar (guardar, agregar categoría/cuenta, biometría, etc.).
- `showToast()` ahora crea el aviso si falta, de modo que un fallo de la interfaz
  nunca interrumpe la acción que lo muestra.
- Los estados asíncronos (bloqueo automático, biometría y versión) se actualizan
  en el sitio en vez de repintar toda la vista, para no reemplazar un control
  entre el toque y el clic.
- El formulario de cuenta conserva lo escrito al elegir color o ícono; antes usaba
  `oninput` inline que no podía ver el estado del IIFE y fallaba en cada tecla.
- Un guardado fallido ya no deja la cola de escritura rechazada para siempre.
- `tests/ui-smoke.mjs` comprueba con un solo toque tema, escala, bloqueo,
  modales, alta de cuenta/categoría, confirmación, captura y reportes; además
  valida que los círculos midan 28×28, que la franja del notch sea fija y opaca,
  que Atrás cierre capas y vuelva de página, y que deslizar cambie de pestaña.

### Pantalla y navegación
- El área del notch queda siempre cubierta por una franja fija y opaca del color
  del tema, incluso al desplazar el contenido; ya no se ve la app detrás de la
  barra de estado.
- Los íconos de las barras del sistema siguen el tema de la app mediante el
  plugin integrado `SystemBars` de Capacitor; la pantalla de acceso usa íconos
  claros sobre fondo oscuro.
- Los círculos de color de las cuentas vuelven a ser círculos: las reglas
  globales de `auth.css` (incluido `button { min-height:48px }`) quedaron
  limitadas a `#auth` y ya no deforman los controles de la app.
- El gesto o botón Atrás de Android cierra primero modales, hojas y desgloses;
  después vuelve a Inicio o a la página anterior y, en Inicio, minimiza la app.
- Se puede deslizar horizontalmente entre las pestañas principales (Inicio,
  Reportes, Categorías y Ajustes) y hacia la derecha para volver desde una
  subpágina. Los bordes de la pantalla se reservan para el gesto del sistema.

### Versión y pruebas
- `versionName 1.1.0`, `versionCode 2`.
- 16 pruebas automatizadas: se añadió cobertura de `vault.unlockWithMasterKey`, del
  flujo biométrico completo con un plugin simulado, del fallback cuando no hay
  Android y del bloqueo al salir con temporizadores simulados (incluido “Nunca”).
- Documentación actualizada (README, arquitectura, compilación, avisos de
  terceros y seguridad).

### Pendiente
- Probar en un teléfono físico: activar biometría, desbloquear con huella,
  cancelar y usar contraseña, invalidación al añadir una huella, autofill de
  Proton Pass, bloqueo tras el tiempo configurado y exportar/importar respaldo.

## [1.0.0] — 2026-11-04

### Núcleo
- Proyecto Android nuevo e independiente en `~/apps/metria-android`; no modifica
  el repositorio de escritorio.
- Arquitectura Capacitor 8 + núcleo móvil modular en `src/core/`:
  `crypto`, `fs`, `vault`, `auth`, `bridges`, `lock`, `platform`, `auth-ui`,
  `boot`.
- Cifrado compatible con escritorio: scrypt `N=32768, r=8, p=1` + AES-256-GCM,
  contraseñas normalizadas a NFC, frase de recuperación de 160 bits.
- Archivo `data-store.json` con el mismo formato `format: 1` del escritorio.
- Escritura atómica con `.tmp` + rename y respaldo si el destino no se reemplaza.
- Respaldos automáticos de arranque (máx. 15) y copia previa a importar (máx. 5).
- Máquina de estados de autenticación: crear, confirmar frase, desbloquear,
  recuperar y definir contraseña nueva.
- La cuenta nueva no escribe nada a disco hasta confirmar la frase.
- Bloqueo por inactividad (1/5/15/30 min o nunca; por defecto 5) y al pasar la
  app a segundo plano; al bloquear se recarga la página y se borra la llave.
- Se evita el bloqueo mientras el usuario está en el selector de archivos o en la
  hoja de compartir.

### Interfaz
- Reutiliza `app.js` y `app.css` del escritorio, envueltos en un IIFE con
  `window.MetriaApp = { init, shutdown }`.
- Pantallas de acceso propias con diseño móvil (`auth.css`).
- `mobile.css` para safe areas y edge-to-edge de Android 15/16.
- Exportar respaldo en Android escribe en caché y abre la hoja de compartir.

### Android
- App ID `com.kubeekapoor.metria`, `versionName 1.0.0`, `minSdk 24`,
  `targetSdk 36`.
- Manifiesto endurecido: `allowBackup=false`, `fullBackupContent=false`,
  `dataExtractionRules` (excluye nube y transferencia entre dispositivos),
  `usesCleartextTraffic=false` y sin permiso de INTERNET.
- Íconos adaptativos y splash provisionales a partir de `resources-icon.png`.
- Firma release con `~/.metria-keys/metria-release.jks` y
  `android/keystore.properties` (ambos modo 600).
- APK release generado: `dist/metria-1.0.0-android.apk` (3,7 MB).

### Pruebas y herramientas
- 12 pruebas automatizadas: compatibilidad de crypto con Node/escritorio,
  apertura de archivos del escritorio, flujo completo de auth, respaldos
  bidireccionales, rotación de respaldos, archivo dañado, adaptador Capacitor,
  escritura atómica (incluida la restauración si el renombrado falla dos veces)
  y guardar/compartir.
- Prueba de humo de interfaz con Playwright + Brave: crear cuenta, frase, carga
  de la app, contraseña incorrecta, desbloqueo y recuperación.
- `scripts/setup-toolchain.sh`: instala JDK 21 y Android SDK 36 sin sudo.
- `scripts/build.sh`: pruebas + compilación + copia del APK a `dist/`.
- Workflow de GitHub Actions para APK debug y release firmado.

### Repositorio público
- Licencia **AGPL-3.0** (`LICENSE`) y campo `license` en `package.json`.
- `SECURITY.md` con modelo de amenaza, alcance y canal privado de reporte.
- `THIRD_PARTY_NOTICES.md` con las licencias de Capacitor, scrypt-js, esbuild,
  Playwright, Gradle, AndroidX y Kotlin.
- Dependabot semanal para npm, Gradle y GitHub Actions.
- Plantilla de reporte de errores con aviso de no incluir datos financieros.
- CI con permisos mínimos: `contents: read` por defecto y `contents: write` solo
  en el job de publicación de tags.
- Recomendación de no guardar la llave de firma en secrets de un repo público.

### Pendiente
- Probar en un teléfono físico: selector de archivos, hoja de compartir, bloqueo
  al apagar pantalla y comportamiento con teclado/rotación.
- Ícono definitivo (el actual es provisional, igual que en escritorio).
