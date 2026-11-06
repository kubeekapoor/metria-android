# AI Implementation Rules — Metria

> **Versión:** 1.0.0-draft · **Destinatario:** OpenCode y cualquier agente de programación.
> **Responsabilidad:** cómo interpretar y aplicar el sistema de diseño al modificar el proyecto. No repite valores ni criterios visuales: los referencia.
> Marcas: **[OBLIGATORIO]**, **[RECOMENDADO]**, **[PENDIENTE]**.

## 1. Mapa de fuentes y precedencia

| Necesitas… | Consulta | Autoridad |
|---|---|---|
| Un valor (color, tamaño, radio, espaciado, sombra) | `design-tokens.css` | **Fuente única de verdad de valores** |
| Una regla de uso de color, tipografía, espaciado, accesibilidad, responsive | `Design-System-Metria.md` | Normativa general |
| Cómo debe verse/comportarse un componente | `Components-Guidelines.md` | Normativa de componentes |
| Cómo debe fluir una pantalla o tarea | `UX-Patterns-Metria.md` | Normativa de experiencia |
| Cómo trabajar sin romper el proyecto | Este documento | Normativa de proceso |

**Precedencia en caso de conflicto:** (1) instrucción explícita del usuario en la sesión → (2) este documento → (3) `Design-System-Metria.md` → (4) `Components-Guidelines.md` / `UX-Patterns-Metria.md` → (5) `design-tokens.css` para valores. Si detectas un conflicto entre documentos **no lo resuelvas en silencio**: repórtalo (§8).

Las decisiones marcadas **[PENDIENTE]** en cualquier documento **no son reglas**: no las implementes como si lo fueran; pregunta o propón.

---

## 2. Contexto técnico del proyecto (restricciones reales)

Datos tomados del README de `metria-android`. Verifícalos en el repositorio antes de asumirlos.

| Hecho | Consecuencia para el agente |
|---|---|
| App Capacitor/WebView con interfaz compartida con el escritorio (`www/app.js`, `app.css`, `auth.css`, `mobile.css`, `index.html`) | Un cambio de estilo afecta a escritorio y Android. Probar ambos anchos. |
| Sin permiso de INTERNET; CSP restrictiva | **No** cargar fuentes, estilos, scripts o imágenes remotos (nada de Google Fonts/CDN). Las fuentes se empaquetan localmente (el manual §07 permite expresamente alojar los archivos en el proyecto; su ejemplo con Google Fonts no aplica a esta app). |
| Reglas financieras y cifrado en `src/core/` | **No tocar** `src/core/` en cambios visuales. |
| `www/vendor/scrypt-js` | No modificar. |
| Pruebas: `npm test` (16 de núcleo) y `npm run test:ui` (humo de interfaz) | Ejecutarlas al terminar si el entorno lo permite. |
| `mobile.css` gestiona safe areas del WebView | Reutilizar `--safe-*`; no duplicar. |
| Autofill de contraseñas depende de `name`/`autocomplete` | No eliminar esos atributos al cambiar HTML/estilos. |
| Versión y firma de APK (`build.gradle`, llaves) | No tocar `versionCode`, `versionName`, firma ni `android/` salvo petición explícita. |

---

## 3. Reglas obligatorias

| # | Regla |
|---|---|
| R1 | **Consulta primero** el sistema de diseño (§1) antes de modificar cualquier estilo. |
| R2 | `design-tokens.css` es la **fuente de verdad**. Todo valor visual proviene de un token. |
| R3 | **Respeta la identidad visual**: modo oscuro principal; colores sólidos; sin Liquid Glass, `backdrop-filter`, degradados decorativos ni transparencias decorativas; el degradado de marca solo en logotipo e identidad. |
| R4 | **Mantén consistencia entre componentes**: reutiliza el componente/clase existente antes de crear otro. |
| R5 | **No introduzcas** colores, fuentes, tamaños, radios, sombras ni espaciados arbitrarios (valores literales como `#fff`, `13px`, `border-radius: 8px`). Si falta un token, **propón** añadirlo (§6.3); no lo inventes en el componente. |
| R6 | **Evita duplicar estilos**: busca antes de escribir; extrae a una clase común cuando algo se repite ≥ 3 veces. |
| R7 | **No cambies la arquitectura** (estructura de carpetas, empaquetado, patrón de módulos) sin justificarlo y recibir aprobación. |
| R8 | **No instales dependencias** (npm, plugins Capacitor/Gradle, librerías de iconos/UI/gráficas) sin autorización explícita. |
| R9 | **No elimines funcionalidades** existentes (pantallas, botones, flujos, ajustes, atributos). |
| R10 | **No modifiques lógica de negocio** (cálculos, almacenamiento, cifrado, bloqueo, respaldos, validaciones financieras) al hacer cambios visuales. Si un cambio visual exige tocar lógica, **detente y consulta**. |
| R11 | **Revisa el impacto** de cada cambio (qué otras pantallas/componentes usan ese selector o token). |
| R12 | **Mantén compatibilidad entre temas**: todo cambio se verifica en oscuro y claro. |
| R13 | **Prioriza accesibilidad y responsive** (contraste, foco visible, objetivo táctil ≥ 44 px, sin scroll horizontal de página, safe areas). |
| R14 | **Cambios mínimos**: realiza **únicamente** lo solicitado. No "aproveches" para refactorizar, reformatear ni "mejorar" lo no pedido. |
| R15 | **No presentes propuestas como hechos**: no afirmes que una funcionalidad existe si no la has encontrado en el código. |

---

## 4. Prohibiciones explícitas

- Colores literales (`#...`, `rgb()`, `hsl()`), `!important` para vencer tokens, estilos en línea (`style="…"`) con valores visuales.
- Fuentes distintas de Montserrat (600/700) y Roboto (400/500); texto funcional < 12 px.
- Degradados fuera de logotipo/identidad; `backdrop-filter`; opacidad para "simular" colores (usar el token sólido).
- Reutilizar la paleta morada, logotipo o tipografías de Kraken.
- Deformar, rotar, espejar, recolorear o añadir sombras/efectos al logotipo; invadir su área de protección (2x, x = ancho de una barra) o usarlo por debajo de 32 px de ancho; usar una versión sin contraste con el fondo (ver Design-System §3.1).
- Recrear el logotipo con CSS/SVG propio: usar el archivo oficial.
- `outline: none` sin sustituto de foco visible.
- Usar color como único indicador de estado (ingreso/gasto/deuda/error).
- Cargar recursos externos (CDN, fuentes remotas, imágenes remotas).
- Cambios en `src/core/`, `android/`, firma, `versionCode`, scripts de compilación o `LICENSE`/avisos de terceros sin instrucción explícita.
- Modificar o borrar pruebas para que pasen.
- Hacer *commit*, *push* o publicar sin que el usuario lo pida.

---

## 5. Procedimiento recomendado (siete pasos)

### Paso 1 — Consultar los documentos relevantes
- Lee el objetivo del usuario y clasifícalo: valor/token, componente, patrón de experiencia, o mezcla.
- Abre solo lo necesario, pero **siempre** `design-tokens.css` y la sección relevante de `Components-Guidelines.md`.
- Anota las reglas **[OBLIGATORIO]** aplicables y las **[PENDIENTE]** que podrían afectar.

### Paso 2 — Inspeccionar los archivos afectados
- Localiza dónde vive el estilo/markup (`www/app.css`, `auth.css`, `mobile.css`, `index.html`, `app.js` si genera HTML).
- Busca usos del selector, clase o variable que vas a tocar (búsqueda en todo el proyecto) para medir el impacto.
- Identifica valores literales existentes y variables CSS ya definidas.
- Revisa el estado del control de versiones (cambios sin confirmar) para no mezclar trabajo.

### Paso 3 — Identificar conflictos
Busca explícitamente:
- Valores literales que contradicen tokens.
- Estilos duplicados o selectores que se pisan.
- Componentes que se desvían de las guías.
- Diferencias de comportamiento entre temas o anchos.
- Cambios solicitados que contradicen el sistema de diseño (p. ej. "ponle un degradado al botón").
- Cambios que requerirían tocar lógica o dependencias.

Si hay un conflicto entre la petición y el sistema de diseño: **informa, explica la regla y propón la alternativa**; no lo resuelvas por tu cuenta.

### Paso 4 — Proponer un plan
Antes de editar, presenta un plan breve:
1. Objetivo en una frase.
2. Archivos que tocarás y por qué.
3. Tokens/componentes que usarás.
4. Conflictos o pendientes detectados.
5. Riesgos y cómo los verificarás.

Espera confirmación cuando: el plan toca más de 3 archivos, introduce un token nuevo, afecta navegación o flujos de seguridad, o contiene decisiones **[PENDIENTE]**.

### Paso 5 — Realizar únicamente los cambios solicitados
- Cambios pequeños y revisables; no reformatees archivos completos.
- Sustituye literales por tokens **solo** en el área que se te pidió modificar (ver §6 para migraciones mayores).
- Nombres de clases y variables en inglés, consistentes con el existente.
- Si necesitas un token nuevo, añádelo a `design-tokens.css` **y** documenta el cambio (§6.3).

### Paso 6 — Verificar el resultado
Lista de verificación mínima:

| Verificación | Cómo |
|---|---|
| Sin valores literales nuevos | Buscar `#`, `rgb(`, `px` fuera de tokens en el diff |
| Ambos temas correctos | Cambiar entre oscuro y claro y revisar |
| Contraste | Solo usar combinaciones de Design-System §5.3; si introduces una nueva, **calcula** su ratio |
| Responsive | Revisar ~360 px, ~768 px y ≥ 1024 px; sin scroll horizontal de página |
| Foco y teclado | Recorrer con Tab; foco visible; Esc en modales/menús |
| Objetivo táctil | Controles ≥ 44 px en móvil |
| Safe areas | Barras superior/inferior sin solaparse con el sistema |
| Atributos de autofill | `name`/`autocomplete` de contraseña intactos |
| Sin recursos externos | Ninguna URL remota nueva |
| Pruebas | `npm test` y, si procede, `npm run test:ui` |
| Lógica intacta | El diff no toca `src/core/` ni cálculos |

Si no puedes ejecutar alguna verificación, **dilo**; no la declares hecha.

### Paso 7 — Informar
Usa el formato de §8.

---

## 6. Migración de estilos existentes

El CSS actual del proyecto **no fue inspeccionado** al redactar esta documentación **[PENDIENTE D-07]**. Por eso:

### 6.1 Principio
No migres todo de golpe. Migra **por área tocada** (estrategia "regla del boy scout": deja cada archivo que modificas mejor alineado, sin ampliar el alcance).

### 6.2 Tabla de equivalencias (a completar tras inspeccionar)
Antes de una migración mayor, genera y valida con el usuario una tabla:

| Variable/valor actual | Token destino | Diferencia visible | Aprobado |
|---|---|---|---|
| *(ej. `--bg` / `#0b0b0b`)* | `--color-bg` | Sí/No | Pendiente |

Si un valor actual **difiere** del token, **no lo cambies en silencio**: la diferencia visual debe aprobarla el usuario.

### 6.3 Añadir o cambiar un token
1. Verifica que ningún token existente sirve.
2. Añade el token a `design-tokens.css` en ambos temas si depende del tema.
3. Calcula contrastes si es de color.
4. Actualiza `Design-System-Metria.md` (tabla correspondiente y §15 control de versiones).
5. Menciónalo en el informe como **"token nuevo"**.

### 6.4 Tema
El mecanismo de cambio de tema es **[PENDIENTE D-01]**. Antes de implementar `data-theme`, localiza cómo `app.js` aplica hoy claro/oscuro y adapta tokens a ese mecanismo **sin alterar la lógica**; si el cambio exige tocar lógica, consulta (R10).

### 6.4.1 Fuentes
Montserrat y Roboto deben estar en el repositorio y declararse con `@font-face` local **[PENDIENTE D-03]**. No agregues archivos de fuente sin que el usuario lo autorice (R8 aplica por analogía a recursos).

---

## 7. Criterios de decisión rápida

| Situación | Acción |
|---|---|
| Falta un token | Proponerlo (§6.3); no hardcodear. |
| Dos reglas se contradicen | Informar el conflicto y aplicar la precedencia de §1; no improvisar. |
| La petición contradice el sistema de diseño | Explicar qué regla choca y ofrecer la variante conforme. |
| La petición implica cambiar lógica | Detenerse y consultar. |
| Hay una regla **[PENDIENTE]** involucrada | Preguntar o aplicar la propuesta provisional **marcándola** como provisional. |
| Ves un problema fuera del alcance | **No lo arregles**: anótalo en el informe como observación. |
| No estás seguro de si algo existe en la app | Búscalo en el código; si no aparece, no lo asumas (R15). |
| Una funcionalidad parece faltar en pantalla | No la elimines ni la "limpies" (R9). |

---

## 8. Formato del informe final

Entrega siempre un informe con esta estructura:

```
## Resumen
Una o dos frases de lo hecho.

## Archivos modificados
- ruta/archivo — qué cambió y por qué

## Archivos creados / eliminados
- (ninguno) o lista

## Tokens y componentes usados
- tokens existentes, tokens nuevos (si los hay), componentes reutilizados

## Verificación realizada
- [x] elemento verificado y cómo
- [ ] elemento NO verificado y por qué

## Posibles problemas / riesgos
- …

## Conflictos o decisiones pendientes detectadas
- ID del pendiente o descripción

## Observaciones fuera de alcance (no modificadas)
- …
```

Reglas del informe: sé específico (rutas y selectores), no declares "todo funciona" sin evidencia, distingue lo **verificado** de lo **supuesto**, no menciones cambios que no hiciste.

---

## 9. Ejemplos de aplicación

**Ejemplo 1 — "Cambia el color del botón de guardar."**
1. Consulta Components-Guidelines §1 y tokens. 2. Localiza el botón. 3. Detecta que la petición pide un color literal. 4. Usa `--color-action-primary` (ya conforme) o, si el usuario quiere otro color, explica la regla y propón alternativa dentro de los tokens. 5. Aplica. 6. Verifica ambos temas y contraste. 7. Informa.

**Ejemplo 2 — "Haz que el dashboard se vea mejor en celular."**
1. Consulta Design-System §11 y UX-Patterns §2. 2. Inspecciona `app.css`/`mobile.css`. 3. Detecta literales y columnas fijas. 4. Plan: 1 columna, `--space-*`, objetivos de 44 px. 5. Cambios solo de estilo/estructura visual. 6. Verifica 360/768/1024 px. 7. Informa. **No** reordenes ni quites tarjetas sin autorización (R9).

**Ejemplo 3 — "Agrega un degradado azul-turquesa al encabezado."**
Choca con Design-System §3.1/§4. Explicar y proponer: usar el degradado solo en logotipo/pantalla de acceso, o un encabezado sólido `--color-surface-1` con acento `--color-active`.

**Ejemplo 4 — "Instala una librería de gráficas."**
Choca con R8 y con la restricción de red/CSP. Pedir autorización y evaluar alternativas sin dependencias (SVG propio con `--chart-*`).

---

## 10. Mantenimiento de esta documentación

- Si tu cambio hace que un documento quede inexacto, **actualiza el documento** o repórtalo en el informe.
- Mantén el `README` del proyecto sin cambios salvo petición.
- Versiona los cambios del sistema en `Design-System-Metria.md` §15.
