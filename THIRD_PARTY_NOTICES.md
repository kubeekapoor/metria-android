# Avisos de terceros

Metria Android usa las siguientes dependencias. Cada una conserva su licencia
original; este archivo es un resumen, no sustituye los textos completos que
acompañan a cada paquete.

## Dependencias de ejecución

| Componente | Licencia | Uso |
|---|---|---|
| [Capacitor](https://capacitorjs.com/) (`@capacitor/core`, `android`, `app`, `filesystem`, `share`) | MIT | Puente entre la interfaz web y Android |
| [scrypt-js](https://github.com/ricmoo/scrypt-js) | MIT | Derivación de llave scrypt en JavaScript |

## Dependencias de desarrollo y compilación

| Componente | Licencia | Uso |
|---|---|---|
| [esbuild](https://esbuild.github.io/) | MIT | Empaquetado del núcleo |
| [Playwright](https://playwright.dev/) (`playwright-core`) | Apache-2.0 | Prueba de humo de la interfaz |
| [Gradle](https://gradle.org/) | Apache-2.0 | Sistema de compilación |
| [AndroidX](https://developer.android.com/jetpack/androidx) | Apache-2.0 | Bibliotecas de Android |
| [AndroidX Biometric](https://developer.android.com/jetpack/androidx/releases/biometric) | Apache-2.0 | Diálogo de huella/rostro (`androidx.biometric:biometric`) |
| [Kotlin](https://kotlinlang.org/) | Apache-2.0 | Runtime del proyecto Android |

## Trabajo original

`www/app.js`, `www/app.css`, `www/auth.css` y el diseño de Metria son obra de
Kubee Kapoor y se distribuyen en este repositorio bajo AGPL-3.0. La aplicación de
escritorio es un proyecto separado.

Si redistribuyes el APK o el código, conserva este archivo y los avisos de
licencia de las dependencias.
