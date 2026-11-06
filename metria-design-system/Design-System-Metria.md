# Design System — Metria

> **Versión:** 1.0.0-draft · **Idioma:** español (nombres de tokens en inglés)
> **Rol de este documento:** referencia conceptual y normativa.
> **Documentos relacionados:** `design-tokens.css` (valores) · `Components-Guidelines.md` (componentes) · `UX-Patterns-Metria.md` (patrones de experiencia) · `AI-Implementation-Rules.md` (reglas para agentes).

## 0. Cómo leer esta documentación

| Marca | Significado |
|---|---|
| **[OBLIGATORIO]** | Regla que no se rompe sin aprobación explícita del responsable del proyecto. |
| **[RECOMENDADO]** | Buena práctica; se puede desviar con justificación. |
| **[PENDIENTE]** | Decisión que depende del funcionamiento real de la app o de validación; ver §14. |
| **[PROPUESTA]** | Elemento nuevo que no existe todavía en la app y que se propone. |

Principio de precedencia: **`design-tokens.css` manda sobre los valores**; este documento manda sobre las **reglas de uso**. Si hay conflicto, se documenta como decisión pendiente (no se resuelve en silencio).

**[OBLIGATORIO]** La app carga una copia generada en `www/design-tokens.css`. No editar esa copia: se regenera desde `metria-design-system/design-tokens.css` con `npm run sync:tokens` (encadenado a `npm run build:web`).

---

## 1. Propósito del sistema

Metria es una app de control de finanzas personales por flujo de caja que existe como versión de escritorio (Electron) y Android (WebView de Capacitor), con la misma interfaz y reglas financieras. El sistema de diseño busca:

1. Que cifras, balances, movimientos y gráficas se lean **sin esfuerzo y sin ambigüedad**.
2. Que la interfaz sea **consistente** entre pantallas, temas y plataformas.
3. Que cualquier persona o agente de IA pueda modificar estilos **sin introducir valores arbitrarios**.
4. Que la identidad de marca (crecimiento financiero medible) se perciba sin dominar la interfaz.

**Alcance:** apariencia, estructura y comportamiento visual. **Fuera de alcance:** lógica de negocio, cifrado, bloqueo, respaldos y reglas financieras (ver README del proyecto).

---

## 2. Principios de diseño

| Principio | Valor de marca | Qué significa en la interfaz |
|---|---|---|
| Claridad | Información sencilla | Una idea principal por pantalla y por tarjeta; etiquetas explícitas; sin jerga contable innecesaria. |
| Precisión | Datos detallados | Cifras con formato monetario constante, cifras tabulares, signo y color nunca como único indicador. |
| Crecimiento | Mejora continua | Los cambios en el tiempo (tendencias, comparativos) son visibles pero sobrios; sin celebraciones ni gamificación. |
| Confianza | Solidez y transparencia | Superficies sólidas, bordes discretos, confirmaciones claras en acciones irreversibles, cero decoración que distraiga. |

**Nombre [OBLIGATORIO]:** en textos de interfaz y documentación se escribe **Metria** (sin acento); el wordmark del logotipo es **METRIA** en mayúsculas.

**Tono de comunicación:** directo, profesional y cercano. Tuteo (como en el README: "crea tu contraseña"). Frases cortas, verbo primero en botones ("Guardar gasto", no "Aceptar"). Sin signos de exclamación en mensajes de error.

---

## 3. Identidad visual

### 3.1 Logotipo

Fuente normativa: **Manual básico de identidad gráfica v1.0 (noviembre 2026)**. Si este documento y el manual difieren en logotipo, **manda el manual**. Símbolo: M angular blanca + cuatro barras ascendentes en degradado de turquesa a azul, **de izquierda a derecha**.

| Versión (manual §04) | Cuándo usarla en la app |
|---|---|
| **Principal** (M blanca, barras en degradado, sobre negro) | Tema oscuro: pantalla de acceso, barra lateral, encabezados sobre `--color-bg`/`--color-surface-1`. Versión preferente. |
| **Positiva** (M negra, barras en degradado, sobre blanco/fondos muy claros) | Tema claro sobre `--color-surface-1` o `--color-bg`. |
| **Blanco monocromo** | Sobre azul marino u otro fondo oscuro cuando no pueda reproducirse el degradado. |
| **Negro monocromo** | Sobre turquesa, cian o fondos claros; impresión a una tinta. |

- **[OBLIGATORIO]** Área de protección: **2x** libre alrededor, donde **x = ancho de una barra** del logotipo. Ningún texto, imagen o borde invade esa zona.
- **[OBLIGATORIO]** Tamaño mínimo: **32 px de ancho** en digital (`--logo-min-width-digital`); 15 mm en impresión.
- **[RESUELTA]** Para la app se usan los PNG oficiales de `www/assets/logo/`: `metria-logo-principal.png` sobre fondos oscuros y `metria-logo-positiva.png` sobre fondos claros. El lienzo mide 927 × 862 px y el contenido visible 655 × 590 px; se renderiza a ~46 px de ancho para que el símbolo visible mida ~32 px. El ícono del lanzador y el splash de Android quedan fuera de este alcance.
- **[OBLIGATORIO]** Usos incorrectos (manual §05): no deformar proporciones, no rotar ni inclinar, no cambiar colores, no usar sobre fondos sin contraste, no agregar sombras/brillos/bordes, no espejar ni invertir.
- **[OBLIGATORIO]** El degradado (`--brand-gradient`) se reserva al logotipo y a elementos específicos de identidad (pantalla de acceso/splash, "Acerca de", ícono de la app, franja de cuatro tramos del manual).
- **[OBLIGATORIO]** El degradado **no** se usa en botones, tarjetas, fondos, gráficas ni barras de progreso.
- **[RECOMENDADO]** Usar el archivo oficial del logotipo; no recrear la M ni las barras con CSS. Los tonos exactos de las barras en el arte parecen diferir ligeramente de los cuatro colores de la paleta (observación visual, no medida): no extraer colores de la paleta para "reconstruirlas".

### 3.2 Colores de marca (primitivos)

| Token | Valor | Uso permitido |
|---|---|---|
| `--brand-turquoise` | `#30E3CA` | Acción primaria y estado activo en tema oscuro; logotipo. |
| `--brand-cyan` | `#15B0E7` | Información, serie secundaria de gráficas (oscuro); logotipo. |
| `--brand-navy` | `#005691` | Acción primaria y foco en tema claro; enlaces en claro. |
| `--brand-black` | `#000000` | Fondo del tema oscuro; texto sobre turquesa. |
| `--brand-white` | `#FFFFFF` | Texto principal en oscuro; superficie 1 en claro. |

**[OBLIGATORIO]** Los componentes consumen tokens **semánticos** (`--color-action-primary`), no los primitivos de marca. Los primitivos solo se referencian en `design-tokens.css`, logotipo e identidad.

---

## 4. Dirección estética

Kraken se usa como **referencia conceptual de experiencia**, no de identidad. Comparación de lo que se adopta y lo que no:

| Aspecto de Kraken (archivos de referencia) | Decisión para Metria |
|---|---|
| Minimalismo y jerarquía clara con muchos espacios en blanco | **Se adopta** como principio. |
| Escala tipográfica con titulares grandes en negrita y tracking negativo (48/36/28 px) | **Se adopta la idea** (titulares compactos y firmes), con escala propia (§8). |
| Cuerpo en 16 px con interlineado ~1.4 | **Se adopta** (Metria usa 1.5 por la densidad de cifras). |
| Contenedor máximo de 1200 px, gap de sección de 64 px, padding de tarjeta de 24 px | **Se adopta el contenedor 1200 px**; gap de sección 32 px y padding de tarjeta 20 px por ser una app de datos, no un sitio de marketing. |
| Radios pequeños (0–9 px) | **No se adopta**: Metria usa 6/10/14/18 px y pill. |
| Fondo blanco con acento morado | **No se adopta**: Metria es *dark-first* con acento turquesa. |
| Paleta morada, logotipo, tipografías propietarias (Kraken-Brand/Product) | **Prohibido reutilizar.** |

### Reglas estéticas

- **[OBLIGATORIO]** Modo oscuro es el tema principal; el claro es alternativa completa (no parcial).
- **[OBLIGATORIO]** Colores sólidos; sin Liquid Glass, sin `backdrop-filter`, sin degradados decorativos, sin transparencias decorativas. Única excepción funcional: `--color-scrim` detrás de modales.
- **[OBLIGATORIO]** Superficies geométricas con bordes discretos (`--color-border`); sombras moderadas (`--shadow-*`).
- **[RECOMENDADO]** La elevación se comunica primero con el **escalón de superficie** (bg → surface-1 → 2 → 3) y solo después con sombra.

---

## 5. Sistema de color

### 5.1 Superficies y texto

| Rol | Token | Oscuro | Claro |
|---|---|---|---|
| Fondo de la app | `--color-bg` | `#000000` | `#F5F7F8` |
| Superficie 1 (tarjetas, paneles) | `--color-surface-1` | `#0D0F12` | `#FFFFFF` |
| Superficie 2 (campos, elementos anidados) | `--color-surface-2` | `#15191E` | `#EDF1F4` |
| Superficie 3 (hover, seleccionado, chips) | `--color-surface-3` | `#20262D` | `#E3E9ED` |
| Borde decorativo | `--color-border` | `#2A323A` | `#DCE3E8` |
| Borde de control | `--color-border-control` | `#65727E` | `#6F7E8A` |
| Texto principal | `--color-text-primary` | `#FFFFFF` | `#111820` |
| Texto secundario | `--color-text-secondary` | `#A6B0BA` | `#52616D` |
| Texto atenuado | `--color-text-muted` | `#8593A0` | `#5A6B77` |
| Texto deshabilitado | `--color-text-disabled` | `#5A6672` | `#8A98A3` |

**Regla de uso de superficies [OBLIGATORIO]:** un elemento contenido va **un escalón por encima** de su contenedor (tarjeta en surface-1 sobre bg; campo en surface-2 dentro de tarjeta). No saltar más de un escalón ni invertir el orden.

### 5.2 Estados semánticos

| Estado | Token (texto/icono) | Token (fondo sutil) | Oscuro | Claro |
|---|---|---|---|---|
| Ingresos | `--color-income` | `--color-income-bg` | `#34D399` / `#0D2B22` | `#097048` / `#E3F4EC` |
| Gastos | `--color-expense` | `--color-expense-bg` | `#FF6B7A` / `#331519` | `#C4283C` / `#FBE6E9` |
| Deudas | `--color-debt` | `--color-debt-bg` | `#C98BFF` / `#2A1836` | `#8E2CB0` / `#F3E6F8` |
| Advertencia | `--color-warning` | `--color-warning-bg` | `#FBBF24` / `#33280A` | `#8A5A00` / `#FFF1D6` |
| Error | `--color-error` | `--color-error-bg` | `#FF5C5C` / `#331414` | `#B3261E` / `#FCE8E6` |
| Información | `--color-info` | `--color-info-bg` | `#15B0E7` / `#0A2733` | `#00659A` / `#E1F1F9` |
| Activo / seleccionado | `--color-active`, `--color-selected-*` | `--color-active-bg` | `#30E3CA` / `#0B2E2A` | `#006B5E` / `#DDF3EF` |
| Deshabilitado | `--color-text-disabled` | `--color-disabled-bg` | `#5A6672` / `#15191E` | `#8A98A3` / `#EDF1F4` |

**Dominios de la app (alias, sin valores nuevos):**

| Dominio | Token | Equivale a |
|---|---|---|
| Ingreso | `--color-income` | `#34D399` / `#097048` |
| Abono | `--color-contribution` | `--color-income` |
| Gasto | `--color-expense` | `#FF6B7A` / `#C4283C` |
| Deuda | `--color-debt` | `#C98BFF` / `#8E2CB0` |
| Transferencia | `--color-transfer` | `--color-info` |
| Caja chica | `--color-petty-cash` | `--color-active` |
| Resumen | `--color-summary` | `--color-text-secondary` |
| Capital | `--color-capital` | `--color-text-secondary` |
| Liquidadas | `--color-settled` | `--color-text-muted` |

Reglas:

- **[OBLIGATORIO]** El color **nunca** es el único portador de significado. Ingreso/gasto/deuda se acompañan de **etiqueta, signo (+/−) o icono**.
- **[OBLIGATORIO]** Gasto (`expense`) y error (`error`) son tonos cercanos. **Un gasto no es un error**: no usar `--color-error` para montos de gasto, ni `--color-expense` para validaciones.
- **[RECOMENDADO]** Reservar `--color-debt` (violeta) exclusivamente al dominio de deudas y saldo pendiente. **Excepción aprobada:** los abonos usan `--color-contribution`, que equivale a `--color-income`; no se pintan con `--color-debt`.
- **[RESUELTA — D-02]** El tono de deudas (violeta) queda confirmado por el responsable: `#C98BFF` en oscuro y `#8E2CB0` en claro. Ver §14 D-02.

### 5.3 Evaluación de contraste (calculada, WCAG 2.x)

Los ratios se calcularon con la fórmula de luminancia relativa de WCAG 2.x. Umbrales: texto normal ≥ 4.5:1; componentes de UI y gráficos ≥ 3:1.

**Texto base**

| Texto | Oscuro: bg / s1 / s2 / s3 | Claro: bg / s1 / s2 / s3 |
|---|---|---|
| Principal | 21.0 / 19.2 / 17.7 / 15.3 | 16.6 / 17.9 / 15.7 / 14.6 |
| Secundario | 9.5 / 8.7 / 8.0 / 6.9 | 5.9 / 6.4 / 5.6 / 5.2 |
| Atenuado **original del brief** | 5.6 / 5.1 / 4.7 / **4.1 ✗** | **4.2 ✗** / 4.5 / **4.0 ✗** / **3.7 ✗** |
| Atenuado **ajustado (en tokens)** | 6.7 / 6.1 / 5.6 / 4.9 | 5.1 / 5.5 / 4.9 / 4.5 |

**Ajustes realizados (documentados):**

| Ajuste | De | A | Motivo |
|---|---|---|---|
| `text-muted` oscuro | `#788692` | `#8593A0` | Fallaba AA en surface-3 (4.1:1). |
| `text-muted` claro | `#687985` | `#5A6B77` | Fallaba AA en bg, surface-2 y surface-3 (3.7–4.2:1). |
| `income` claro | `#0B7A52` | `#097048` | Daba 4.4:1 sobre surface-3. |
| `info` claro | `#006FA6` | `#00659A` | Daba 4.48:1 sobre surface-3. |
| `border-control` (nuevo) | — | `#65727E` / `#6F7E8A` | El borde del brief (`#2A323A` / `#DCE3E8`) da 1.1–1.6:1; insuficiente como límite de un campo (necesita ≥ 3:1). Se conserva como borde **decorativo**. |

**Estados semánticos sobre sus superficies**

| Estado | Oscuro (min en s1–s3 / sobre su tint) | Claro (min en bg–s3 / sobre su tint) |
|---|---|---|
| Ingresos | 7.9 / 7.9 | 5.0 / 5.4 |
| Gastos | 5.6 / 6.1 | 4.6 / 4.7 |
| Deudas | 6.3 / 6.7 | 5.5 / 5.6 |
| Advertencia | 9.1 / 8.7 | 4.8 / 5.3 |
| Error | 5.0 / 5.6 | 5.3 / 5.6 |
| Información | 6.1 / 6.2 | 5.2 / 5.5 |
| Activo | 9.4 / 9.0 | 5.3 / 5.6 |

Casos de botón relleno:

| Combinación | Ratio |
|---|---|
| Texto `#000000` sobre turquesa `#30E3CA` (primario, oscuro) | 13.0 |
| Texto blanco sobre navy `#005691` (primario, claro) | 7.7 |
| Texto blanco sobre `#D92D20` (destructivo, oscuro) | 4.8 |
| Texto blanco sobre `#B3261E` (destructivo, claro) | 6.5 |
| Anillo de foco turquesa sobre bg oscuro | 13.0 |
| Anillo de foco navy sobre bg claro / surface-3 claro | 7.1 / 6.3 |

**Combinaciones prohibidas (no cumplen):**

- Texto blanco sobre turquesa (1.6:1) o sobre cian (2.5:1).
- Texto o ícono navy `#005691` sobre fondo negro (2.7:1).
- Turquesa `#30E3CA` o cian `#15B0E7` como texto sobre fondos claros (≤ 2.5:1).
- Texto atenuado ORIGINAL del brief sobre surface-3.

**Veredicto de accesibilidad:** con los ajustes anteriores, todas las combinaciones **de texto** documentadas superan 4.5:1 y los bordes de control y anillos de foco superan 3:1 **según el cálculo realizado**. **No se declara conformidad WCAG AA del producto**: eso exige además auditoría manual (teclado, lector de pantalla, zoom, orden de foco) sobre la app real. Texto deshabilitado queda exento del criterio de contraste (3.0:1 o menos por diseño).

---

## 6. Temas oscuro y claro

- **[OBLIGATORIO]** Todo componente debe verse correcto en ambos temas usando **solo tokens**; ningún componente puede contener un color literal.
- **[OBLIGATORIO]** No inferir un tema desde el otro invirtiendo colores: usar el valor declarado de cada token.
- **[OBLIGATORIO]** Acción primaria: turquesa con texto negro (oscuro) · navy con texto blanco (claro).
- **[RECOMENDADO]** Las sombras en oscuro son casi imperceptibles; confiar en el escalón de superficie y el borde.
- **[RESUELTA — D-01]** Mecanismo de cambio de tema: `data-theme="dark|light"` en `<html>`, con oscuro por defecto y mapeado al ajuste "Modo claro/oscuro" existente. La pantalla de acceso permanece siempre oscura.

---

## 7. Tipografía

| Familia | Token | Pesos | Uso |
|---|---|---|---|
| Montserrat | `--font-heading` | 600, 700 | Display, H1–H3, título de tarjeta, **cifras destacadas** (balance principal). |
| Roboto | `--font-body` | 400, 500 | Texto, subtítulos, controles, etiquetas, tablas. |

| Nivel | Token base | Tamaño | Interlineado | Peso | Familia | Aplicación recomendada |
|---|---|---:|---:|---:|---|---|
| Display | `--text-display-*` | 48 px (36 px en < 768 px) | 1.15 | 700 | Montserrat | Balance total del dashboard. Máximo 1 por pantalla. |
| H1 | `--text-h1-*` | 30 px | 1.2 | 700 | Montserrat | Título de pantalla. |
| H2 | `--text-h2-*` | 24 px | 1.25 | 600 | Montserrat | Sección principal / modal de gran formato. |
| H3 | `--text-h3-*` | 20 px | 1.3 | 600 | Montserrat | Subsección, título de modal. |
| Card title | `--text-card-title-*` | 18 px | 1.35 | 600 | Montserrat | Encabezado de tarjeta. |
| Body | `--text-body-*` | 16 px | 1.5 | 400 | Roboto | Texto general, valores de lista. |
| Secondary | `--text-secondary-*` | 14 px | 1.45 | 400/500 | Roboto | Metadatos, descripciones, tablas densas, botones pequeños. |
| Label | `--text-label-*` | 12 px | 1.35 | 500 | Roboto | Etiquetas de campo, chips, ejes de gráfica, pies. |

Reglas:

- **[OBLIGATORIO]** Ningún texto funcional por debajo de 12 px.
- **[OBLIGATORIO]** Montos, balances y columnas numéricas usan cifras tabulares (`.num` / `[data-numeric]`) y alineación a la derecha en tablas.
- **[OBLIGATORIO]** Formato monetario único en toda la app (símbolo, separador de miles y decimales). **[PENDIENTE]** Formato exacto (moneda y locale) a confirmar contra la app: D-05.
- **[OBLIGATORIO]** Pesos permitidos solo los de la tabla de familias (Montserrat 600/700; Roboto 400/500). No cargar ni usar otros.
- **[OBLIGATORIO]** Las fuentes deben estar **empaquetadas localmente** (la app no solicita permiso de INTERNET y usa CSP restrictiva; no usar Google Fonts remotos). **[RESUELTA — D-03]** Se incluyen Montserrat 600/700 y Roboto 400/500 en `www/fonts/` y se declaran con `@font-face` locales.
- **[RECOMENDADO]** Ancho de línea de texto corrido ≤ 70 caracteres (`--layout-content-narrow`).
- **[RECOMENDADO]** Mayúsculas sostenidas solo en etiquetas de 12 px; evitar en textos largos.

---

## 8. Espaciado

Escala (múltiplos de 4): `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-8` 32 · `-10` 40 · `-12` 48 · `-16` 64.

| Contexto | Valor | Token |
|---|---:|---|
| Padding de tarjeta | 20 px (16 px compacta) | `--layout-card-padding` / `-compact` |
| Gap entre elementos relacionados | 16 px | `--layout-element-gap` |
| Gap entre secciones | 32 px | `--layout-section-gap` |
| Gutter de página | 16 / 24 / 32 px (móvil / tablet / escritorio) | `--layout-gutter-*` |
| Separación icono–texto | 8 px | `--space-2` |
| Separación etiqueta–campo | 8 px | `--space-2` |
| Separación campo–campo en formulario | 16 px | `--space-4` |
| Altura mínima de objetivo táctil | 44 px | `--target-min` |

**[OBLIGATORIO]** Solo valores de la escala. Los espaciados "intermedios" (10, 14, 18 px) no existen.
**[RECOMENDADO]** Proximidad = relación: elementos relacionados a ≤ 8–12 px; grupos distintos a ≥ 24–32 px.

---

## 9. Geometría

| Token | Valor | Aplicación |
|---|---:|---|
| `--radius-sm` | 6 px | Chips, badges, elementos de tabla, barras de gráfica internas. |
| `--radius-md` | 10 px | Botones, campos, selectores, elementos de lista seleccionados, menús. |
| `--radius-lg` | 14 px | Tarjetas, paneles. |
| `--radius-xl` | 18 px | Modales y hojas inferiores (*bottom sheets*), contenedores de nivel superior. |
| `--radius-pill` | 999 px | Chips de filtro, indicadores de estado, interruptores. |

Reglas de aplicación por elemento:

| Elemento | Radio | Borde | Sombra |
|---|---|---|---|
| Contenedor de página | ninguno | ninguno | ninguna |
| Tarjeta | `lg` | 1 px `--color-border` | `--shadow-sm` (opcional) |
| Botón | `md` | ninguno (primario) · 1 px `--color-border-control` (secundario) | ninguna |
| Campo | `md` | 1 px `--color-border-control`; 2 px de foco | ninguna |
| Modal | `xl` | 1 px `--color-border` | `--shadow-lg` + scrim |
| Navegación | ninguno (barra) · `md` (ítem activo) | 1 px separador | ninguna |
| Lista / fila | ninguno (separador) · `md` (seleccionada) | separador 1 px | ninguna |
| Gráfica (contenedor) | `lg` (en tarjeta) | hereda de tarjeta | ninguna |

**[OBLIGATORIO]** Anidar radios coherentemente: el radio interior es menor o igual al exterior (tarjeta `lg` contiene elementos `md` o `sm`).

---

## 10. Jerarquía visual

Orden de énfasis en cualquier pantalla (de mayor a menor):

1. **Cifra clave** (balance, total del periodo): Display/H1, `text-primary`.
2. **Acción primaria** de la pantalla (una sola, botón relleno).
3. **Títulos de sección y de tarjeta.**
4. **Datos de lista** (concepto, monto).
5. **Metadatos** (fecha, cuenta, categoría): `text-secondary` / `text-muted`.

Reglas:

- **[OBLIGATORIO]** Máximo **una acción primaria** por vista o modal.
- **[OBLIGATORIO]** Los colores semánticos se aplican al **monto y su indicador**, no a todo el renglón.
- **[RECOMENDADO]** Cada tarjeta responde a una sola pregunta (¿cuánto tengo?, ¿en qué gasté?, ¿cuánto debo?).
- **[RECOMENDADO]** Peso y tamaño antes que color para crear jerarquía.

---

## 11. Diseño responsive

| Clase | Rango | Navegación | Contenido |
|---|---|---|---|
| Móvil | < 768 px | Barra inferior (`--layout-bottom-nav-height`) | 1 columna; tarjetas apiladas; modales como hoja inferior. |
| Tablet | 768–1023 px | Barra inferior o rail lateral **[PENDIENTE D-06]** | 2 columnas para tarjetas de resumen. |
| Escritorio | ≥ 1024 px | Barra lateral (`--layout-sidebar-width`) | Contenedor máx. 1200 px; 2–3 columnas; modales centrados. |

Reglas:

- **[OBLIGATORIO]** Diseño *mobile-first*: la base es móvil y se amplía con `min-width`.
- **[OBLIGATORIO]** Respetar *safe areas* (`--safe-*`) en la WebView de Android.
- **[OBLIGATORIO]** Sin scroll horizontal de página; tablas anchas se adaptan (ver Components-Guidelines §8).
- **[OBLIGATORIO]** Objetivos táctiles ≥ 44 × 44 px en móvil/tablet.
- **[RECOMENDADO]** La tipografía no escala por *viewport*; solo Display baja a 36 px en móvil.
- **[RECOMENDADO]** El README ofrece un ajuste de "tamaño de vista"; los tokens deben soportarlo sin romper la escala. **[PENDIENTE D-04]** definir si escala el `font-size` raíz.

---

## 12. Accesibilidad

Lista de verificación normativa (aplica a cada componente):

- **[OBLIGATORIO]** Texto ≥ 4.5:1 y componentes de UI/gráficos ≥ 3:1 usando exclusivamente combinaciones documentadas en §5.3.
- **[OBLIGATORIO]** Foco visible: `outline` de 2 px con offset de 2 px (`--focus-ring`) en todo control interactivo; nunca `outline: none` sin sustituto.
- **[OBLIGATORIO]** Operable con teclado completo (Tab, Shift+Tab, Enter, Espacio, Esc en modales/menús).
- **[OBLIGATORIO]** Todo campo tiene `<label>` asociado visible; errores vinculados con `aria-describedby`; estados con `aria-invalid`, `aria-expanded`, `aria-selected`, `aria-current` según corresponda.
- **[OBLIGATORIO]** Color no es único indicador (usar signo, texto o icono).
- **[OBLIGATORIO]** Respetar `prefers-reduced-motion`.
- **[OBLIGATORIO]** Campos de contraseña conservan los atributos de autofill existentes (`name`, `autocomplete`) para gestores de contraseñas. Ningún cambio visual debe eliminarlos.
- **[RECOMENDADO]** Zoom de texto hasta 200 % sin pérdida de contenido.
- **[RECOMENDADO]** Cada gráfica ofrece alternativa textual o tabla de datos.
- **[RECOMENDADO]** Mensajes dinámicos (errores, éxito) con `role="status"` / `role="alert"`.

---

## 13. Criterios generales de consistencia

1. **Un solo patrón por problema:** si existe un componente para algo, se reutiliza.
2. **Mismos nombres, mismo comportamiento:** "Guardar", "Cancelar", "Eliminar" significan lo mismo en todas partes.
3. **Mismos tokens, mismos valores:** ningún valor visual vive fuera de `design-tokens.css`.
4. **Mismo orden de acciones:** primaria a la derecha en escritorio y al final/ancho completo en móvil; secundaria a su izquierda.
5. **Acciones destructivas** siempre diferenciadas (color de peligro) y confirmadas (ver UX-Patterns).
6. **Misma semántica de color** en listas, tarjetas, gráficas y resúmenes.
7. **Paridad escritorio–Android:** una modificación visual no debe romper ninguna de las dos plataformas.

---

## 14. Decisiones de validación y acuerdos

| ID | Decisión | Estado | Detalle |
|---|---|---|---|
| D-01 | Mecanismo de tema | **Resuelta** | `data-theme="dark\|light"` en `<html>`, oscuro por defecto. La pantalla de acceso permanece siempre oscura. |
| D-02 | Color de deudas (violeta) | **Resuelta** | Se confirma `--color-debt` violeta (`#C98BFF` oscuro / `#8E2CB0` claro). |
| D-03 | Fuentes locales | **Resuelta** | Montserrat 600/700 y Roboto 400/500 desde `www/fonts/`, declaradas con `@font-face`. |
| D-04 | "Tamaño de vista" | **Resuelta** | Se mantiene `zoom` y se retira la escala 0.6x; la migración a `font-size` raíz + `rem` queda para una fase posterior. |
| D-05 | Formato monetario | Pendiente | Moneda y *locale* no documentados. Propuesta: centralizar en una sola función de formato. |
| D-06 | Navegación en tablet | Pendiente | Depende de la estructura real de pantallas. Propuesta: barra inferior hasta 1023 px. |
| D-07 | Mapeo de tokens a `app.css` / `auth.css` existentes | **Resuelta** | Se aprueba la tabla de equivalencias de la auditoría como mapeo oficial; la migración se ejecuta por fases. |
| D-08 | Sombras en tema oscuro | Pendiente | Su efecto visible es mínimo. Propuesta: mantener y evaluar; apoyarse en el escalón de superficie. |
| D-18 | Nombre | **Resuelta** | Grafía sin acento. Texto de interfaz y documentación: **Metria**; wordmark del logotipo: **METRIA** (mayúsculas). |
| D-19 | Color de botones y enlaces | **Resuelta** | Acción primaria turquesa (oscuro) / navy (claro). Desviación consciente del manual §06 (que asigna el cian a botones y enlaces). |
| D-20 | Escala tipográfica | **Confirmada** | Escala del brief (48/30/24/20/18/16/14/12) para la app; la del manual §08 solo para web de marketing. |
| D-21 | Proporción de color | **Confirmada** | La proporción del manual (35/30/20/10/5) es guía para piezas de marca; en la UI dominan las superficies neutras. |


**Decisión D-19.** Se mantiene turquesa/navy como acción primaria y enlace. Motivo: el cian como texto o relleno sobre blanco da 2.5:1 y no sirve en el tema claro. Esta es una **desviación autorizada** del manual §06, no un error: no "corregirla" al cian.

---

## 15. Control de versiones del sistema

- **[OBLIGATORIO]** Todo cambio a un token se refleja el mismo día en este documento (§5, §7–§9 si aplica) y se anota abajo.
- Cada cambio de valor de color exige recomputar los contrastes de §5.3.

| Versión | Cambio |
|---|---|
| 1.0.6-draft | Los dominios de `app.css` apuntan al mapa aprobado (`--c-deuda` → `--color-debt`, `--c-transferencia` → `--color-info`, etc.) y el acceso usa turquesa local `#30E3CA` con texto negro y anillo de foco turquesa. |
| 1.0.5-draft | `app.css` deja de duplicar valores de tema: sus variables históricas (`--bg`, `--card`, `--ink`, `--accent`, `--line`, `--pos`, `--neg`, `--alert` y `--track`) apuntan a tokens semánticos; `--shadow-*` se hereda de `design-tokens.css`. |
| 1.0.4-draft | La app carga una copia generada de los tokens (`www/design-tokens.css`) mediante `npm run sync:tokens`; el logotipo oficial (principal/positiva) sustituye al monograma SVG en acceso e Inicio. |
| 1.0.3-draft | Decisiones resueltas D-01, D-02, D-03, D-04 y D-07; confirmadas D-18 a D-21. Se añadieron alias de dominio (`--color-summary`, `--color-capital`, `--color-settled`, `--color-transfer`, `--color-petty-cash`, `--color-contribution`) sin valores nuevos. Abono usa `--color-contribution` (excepción documentada). |
| 1.0.2-draft | Decisiones del responsable: D-18 (grafía METRIA/Metria sin acento), D-19 (se mantiene turquesa/navy), D-20 y D-21 confirmadas. |
| 1.0.1-draft | Revisión contra el manual de identidad: se corrigió el área de protección del logotipo (2x, no "altura de una barra") y la dirección del degradado (horizontal); se agregaron versiones del logotipo, tamaño mínimo, usos incorrectos y decisiones D-18 a D-21. |
| 1.0.0-draft | Primera versión. Ajustes de contraste: `text-muted` (ambos temas), `border-control` nuevo. |
