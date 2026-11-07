# Política de seguridad

Metria maneja datos financieros personales. Si encuentras una vulnerabilidad,
gracias por reportarla de forma privada.

## Cómo reportar

- Usa **Security → Report a vulnerability** en GitHub (GitHub Private
  Vulnerability Reporting). Es el canal preferido.
- Alternativa: escribe a **kubeekapoor@proton.me** con el asunto
  `[Metria Android] vulnerabilidad`.
- **No abras un issue público** con detalles explotables, datos financieros
  reales, contraseñas ni frases de recuperación.

Incluye, si puedes:

- versión de la app (`Ajustes → Acerca de`) y de Android;
- modelo de teléfono;
- pasos para reproducir;
- impacto esperado;
- una prueba de concepto sin datos reales.

## Alcance

En alcance:

- derivación de llave, cifrado y formato de `data-store.json`;
- autenticación, recuperación, bloqueo automático y desbloqueo biométrico
  (Android Keystore);
- fuga de datos entre la app y el almacenamiento/otros procesos;
- formato de respaldo `metria-backup` y su importación;
- CSP, WebView y configuración del manifiesto;
- cadena de compilación y firma del APK.

Fuera de alcance:

- teléfonos con root o sistema operativo comprometido;
- acceso físico a la app ya desbloqueada;
- contraseñas débiles elegidas por el usuario;
- pérdida de la llave de firma por parte del mantenedor;
- ataques de denegación de servicio al propio dispositivo.

## Modelo de amenaza (resumen)

- Los datos se guardan cifrados con AES-256-GCM; la llave maestra se deriva con
  scrypt y solo vive en memoria mientras la sesión está desbloqueada.
- El desbloqueo biométrico opcional no guarda la contraseña: cifra la llave
  maestra con una llave AES-256-GCM del Android Keystore que exige huella/rostro.
  Esa llave se invalida si se inscribe una biometría nueva y, tras un reinicio,
  se pide la contraseña una vez.
- La app no tiene permiso de INTERNET ni hace tráfico de red.
- El respaldo automático y el manual están cifrados; el manual usa una
  contraseña propia.
- El APK se firma con una llave que **no** está en el repositorio. Las
  actualizaciones deben usar la misma llave.
- Un atacante con control del dispositivo desbloqueado o con la contraseña
  maestra puede leer los datos; eso es esperado.

## Versiones soportadas

| Versión | Soporte |
|---|---|
| 1.x | Sí, con la última versión publicada |

## Divulgación

Se intentará responder en un plazo de 7 días. Si el reporte es válido, se
publicará un aviso y una versión corregida; se dará crédito si el reportero lo
desea.
