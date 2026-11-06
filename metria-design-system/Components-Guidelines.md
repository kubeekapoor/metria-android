# Components Guidelines — Metria

> **Versión:** 1.0.0-draft · **Responsabilidad:** criterios visuales y funcionales de cada componente.
> **Valores:** siempre desde `design-tokens.css`. **Normas generales:** `Design-System-Metria.md`.
> Marcas: **[OBLIGATORIO]**, **[RECOMENDADO]**, **[PENDIENTE]**, **[PROPUESTA]** (ver Design-System §0).
> Este documento no contiene código de implementación; las estructuras son descriptivas.

## 0. Reglas transversales de componentes

| # | Regla | Nivel |
|---|---|---|
| T1 | Ningún componente contiene colores, tamaños de fuente ni espaciados literales: solo tokens. | OBLIGATORIO |
| T2 | Todo componente interactivo define los estados: reposo, hover, foco, presionado, deshabilitado (y los propios, como error o cargando). | OBLIGATORIO |
| T3 | Foco visible con `--focus-ring` (2 px, offset 2 px). | OBLIGATORIO |
| T4 | Objetivo táctil ≥ `--target-min` (44 px) en móvil/tablet. | OBLIGATORIO |
| T5 | Hover solo en dispositivos con puntero (`@media (hover: hover)`); en táctil no debe ser necesario para entender nada. | OBLIGATORIO |
| T6 | Deshabilitado: `--color-disabled-bg`, `--color-text-disabled`, sin eventos; se explica el motivo cuando no sea obvio. | OBLIGATORIO |
| T7 | Presionado: escala `--state-pressed-scale` o escalón de superficie; sin animaciones > `--motion-base`. | RECOMENDADO |
| T8 | Misma estructura y orden de contenido en ambos temas. | OBLIGATORIO |
| T9 | Montos con cifras tabulares (`.num`), signo explícito y color semántico solo en el monto/indicador. | OBLIGATORIO |

Estados de interacción de referencia (escalón de superficie, sin transparencias):

| Estado | Fondo (neutral) | Borde | Texto |
|---|---|---|---|
| Reposo | superficie del nivel | `--color-border` / `--color-border-control` | `text-primary` |
| Hover | un escalón más (`surface-N+1`) | sin cambio | sin cambio |
| Presionado | `surface-3` | sin cambio | sin cambio |
| Seleccionado | `--color-selected-bg` | `--color-selected-border` | `text-primary` |
| Deshabilitado | `--color-disabled-bg` | `--color-disabled-border` | `--color-text-disabled` |

---

## 1. Botones

| Aspecto | Criterio |
|---|---|
| **Propósito** | Ejecutar una acción. Navegar entre vistas se hace con enlaces o navegación, no con botones. |
| **Jerarquía** | Primario (1 por vista) > Secundario > Terciario (texto) > Destructivo. |
| **Estructura** | Etiqueta (verbo + objeto, 14–16 px, Roboto 500) con icono opcional a la izquierda (`--icon-size-md`, gap 8 px). Altura `--control-height-md` (44 px); `lg` (52 px) para el CTA principal móvil. Radio `--radius-md`. Padding horizontal 16–24 px. |
| **Variantes** | **Primario:** fondo `--color-action-primary`, texto `--color-text-on-accent`. **Secundario:** fondo `--color-action-secondary-bg`, borde `--color-border-control`, texto `text-primary`. **Terciario:** sin fondo ni borde, texto `--color-text-link`. **Destructivo:** fondo `--color-action-danger`, texto `--color-text-on-danger`. **Icono solo:** 44 × 44 px con `aria-label`. |
| **Estados** | Reposo · hover (`*-hover`) · foco · presionado (`*-pressed` / escala) · deshabilitado · cargando (spinner + etiqueta conservada, ancho fijo, sin doble envío). |
| **Responsive** | En móvil, la acción primaria de formularios y modales ocupa el ancho completo y va al final; en escritorio se alinea a la derecha con la secundaria a su izquierda. Nunca más de 2 botones en una fila móvil. |
| **Accesibilidad** | Usar `<button>`; icono solo exige `aria-label`; estado de carga con `aria-busy="true"`; deshabilitado con `disabled` (no solo estilo). Contraste de etiqueta ≥ 4.5:1 (verificado en Design-System §5.3). |

Reglas adicionales:
- **[OBLIGATORIO]** El degradado de marca nunca se aplica a botones.
- **[OBLIGATORIO]** Acciones irreversibles (eliminar cuenta, "Borrar todos tus datos") usan variante destructiva **y** confirmación (UX-Patterns §12).
- **[RECOMENDADO]** Etiquetas concretas: "Guardar gasto", "Registrar abono", "Exportar respaldo". Evitar "Aceptar"/"OK".

---

## 2. Tarjetas

| Aspecto | Criterio |
|---|---|
| **Propósito** | Agrupar información relacionada que responde a una pregunta (saldo, gasto por categoría, deuda). |
| **Jerarquía** | Título de tarjeta (18 px Montserrat 600) → cifra o contenido principal → metadatos/acción. |
| **Estructura** | Contenedor `surface-1`, borde 1 px `--color-border`, radio `--radius-lg`, padding `--layout-card-padding` (20 px; 16 px compacta). Encabezado (título + acción opcional) · cuerpo · pie opcional. Gap interno 12–16 px. |
| **Variantes** | **Estándar** · **Métrica** (cifra Display/H1 + etiqueta + variación) · **Lista** (filas con separadores, sin padding horizontal extra) · **Estado** (con fondo `--color-*-bg` y icono para avisos persistentes). **Interactiva** (toda la tarjeta navega): hover `surface-2`, foco visible. |
| **Estados** | Reposo · hover/foco (solo interactivas) · seleccionada (`--color-selected-border`) · cargando (esqueleto) · vacía (ver UX-Patterns §14) · error. |
| **Responsive** | Apiladas en 1 columna (móvil); cuadrícula de 2 columnas ≥ 768 px y hasta 3 ≥ 1024 px. Nunca anidar tarjeta dentro de tarjeta: usar `surface-2` sin borde para subagrupar. |
| **Accesibilidad** | Encabezado real (`h2`/`h3`) por tarjeta; tarjeta interactiva = un solo enlace/botón, no varios anidados; la variación de una métrica incluye texto ("+4.2 % vs. mes anterior"), no solo color/flecha. |

---

## 3. Campos de formulario

| Aspecto | Criterio |
|---|---|
| **Propósito** | Capturar datos: monto, concepto, fecha, notas, contraseña. |
| **Jerarquía** | Etiqueta → campo → ayuda/error. |
| **Estructura** | Etiqueta superior visible (Label 12 px/500, o 14 px) a 8 px del campo. Campo: altura 44 px, fondo `surface-2`, borde 1 px `--color-border-control`, radio `--radius-md`, padding horizontal 12–16 px, texto 16 px. Texto de ayuda/error debajo (14 px o 12 px). |
| **Variantes** | Texto · **Monto** (alineado a la derecha, cifras tabulares, prefijo de moneda visible **[PENDIENTE D-05]**) · Contraseña (con control mostrar/ocultar) · Fecha · Área de texto · Búsqueda. |
| **Estados** | Reposo · hover (borde `--color-border-strong`) · foco (`--focus-ring` + borde `--color-active`) · lleno · error (borde `--color-error`, icono y mensaje) · deshabilitado · solo lectura. |
| **Responsive** | Ancho completo en móvil. Tamaño de fuente del campo ≥ 16 px (evita zoom automático en móvil). Pares de campos en 2 columnas solo ≥ 768 px (p. ej. fecha + monto). |
| **Accesibilidad** | `<label for>` obligatorio (el *placeholder* no sustituye la etiqueta); error con `aria-invalid="true"` + `aria-describedby`; teclado móvil adecuado (`inputmode="decimal"` para montos). **[OBLIGATORIO]** Mantener `name` y `autocomplete` de los campos de contraseña (compatibilidad con gestores como Proton Pass). |

Reglas: mensaje de error dice **qué pasó y cómo corregirlo** ("Ingresa un monto mayor a 0"); no vaciar el campo del usuario al fallar la validación; validar al salir del campo y al enviar, no en cada tecla.

---

## 4. Selectores (lista desplegable, segmentado, interruptor, casilla, radio, fecha)

| Aspecto | Criterio |
|---|---|
| **Propósito** | Elegir entre opciones predefinidas (cuenta, categoría, periodo, tipo de movimiento). |
| **Jerarquía** | Mismo peso visual que un campo; la opción activa destaca por `--color-selected-*`. |
| **Estructura** | **Desplegable:** apariencia de campo + chevron; panel con `surface-2`, radio `md`, `--shadow-md`. **Segmentado** (2–4 opciones excluyentes, p. ej. Ingreso/Gasto, periodos): contenedor `surface-2` con segmentos pill; activo en `--color-selected-bg` con borde `--color-selected-border`. **Interruptor:** pista pill 44 × 24 px; encendido `--color-active`. **Casilla/radio:** caja de 20 px dentro de objetivo de 44 px. |
| **Variantes** | Desplegable, segmentado, chips de filtro (pill), interruptor, casilla, radio, selector de periodo. |
| **Estados** | Reposo · hover · foco · abierto · seleccionado · deshabilitado · error (cuando es obligatorio). |
| **Responsive** | En móvil, desplegables con muchas opciones (> 6) se presentan como hoja inferior (`--radius-xl`) en vez de panel flotante. Segmentado con > 4 opciones → desplegable. |
| **Accesibilidad** | Semántica nativa preferida (`<select>`, `<input type="checkbox|radio">`); interruptor con `role="switch"` y `aria-checked`; segmentado como grupo `radiogroup` con navegación por flechas; la opción seleccionada no se indica solo por color (check o peso). |

---

## 5. Modales y hojas

| Aspecto | Criterio |
|---|---|
| **Propósito** | Tareas cortas y enfocadas (capturar un movimiento, confirmar una acción). No usar para flujos largos o lectura extensa. |
| **Jerarquía** | Título (H3 20 px) → contenido → acciones. |
| **Estructura** | Panel `surface-1`, radio `--radius-xl`, borde 1 px, `--shadow-lg`, ancho máx. `--layout-modal-max` (480 px), padding 24 px. Encabezado con título y botón cerrar; cuerpo desplazable; pie con acciones. Fondo con `--color-scrim`. |
| **Variantes** | **Formulario** · **Confirmación** (título + 1–2 líneas + 2 botones) · **Destructiva** (botón de peligro; detalle de consecuencias) · **Hoja inferior móvil** (anclada abajo, esquinas superiores `xl`). |
| **Estados** | Abierto · cargando (botón primario en carga, el resto bloqueado) · error (mensaje dentro del modal, sin cerrarlo) · cerrado. |
| **Responsive** | Móvil: hoja inferior o pantalla completa en formularios largos; respeta `--safe-bottom`. Escritorio: centrado. |
| **Accesibilidad** | `role="dialog"` + `aria-modal="true"` + `aria-labelledby`; foco inicial en el primer campo (o en "Cancelar" si es destructiva); *focus trap*; Esc cierra; al cerrar el foco vuelve al disparador; el scroll de fondo se bloquea. |

Reglas: un modal no abre otro modal; la acción primaria no es destructiva por defecto; cerrar un formulario con datos sin guardar pide confirmación.

---

## 6. Menús

| Aspecto | Criterio |
|---|---|
| **Propósito** | Agrupar acciones secundarias de un elemento (editar, duplicar, eliminar) o de la cuenta/ajustes. |
| **Jerarquía** | Acciones frecuentes arriba; destructiva al final, separada y en `--color-error`. |
| **Estructura** | Disparador (botón icono 44 px) + panel `surface-2`, radio `md`, `--shadow-md`, borde 1 px. Ítems de 44 px con icono opcional (20 px) + texto 14–16 px; separadores 1 px `--color-border`. |
| **Variantes** | Menú de acciones por fila · menú de ajustes · menú contextual. |
| **Estados** | Cerrado · abierto · ítem hover/foco · ítem deshabilitado · ítem destructivo. |
| **Responsive** | Móvil: hoja inferior si > 4 ítems; escritorio: panel anclado al disparador, sin salirse del viewport. |
| **Accesibilidad** | `aria-haspopup`, `aria-expanded`; `role="menu"`/`menuitem`; flechas, Home/End, Esc; el foco regresa al disparador. |

---

## 7. Navegación

| Aspecto | Criterio |
|---|---|
| **Propósito** | Moverse entre las áreas principales. **[PENDIENTE D-06]** las secciones exactas dependen de la app (el README menciona: Inicio, resumen por periodo, reportes, categorías, cuentas/deudas, ajustes). |
| **Jerarquía** | Ubicación actual > destinos > acciones globales. |
| **Estructura** | **Escritorio:** barra lateral `--layout-sidebar-width` (248 px), fondo `surface-1`, separador 1 px; logotipo arriba. **Móvil:** barra inferior de `--layout-bottom-nav-height` (64 px + `--safe-bottom`), 4–5 destinos, icono 24 px + etiqueta 12 px. **Barra superior:** altura `--layout-topbar-height` con título de pantalla y acciones. |
| **Variantes** | Barra lateral · barra inferior · pestañas de segundo nivel · migas (solo escritorio, si hay jerarquía profunda). |
| **Estados** | Ítem reposo · hover (`surface-2`) · foco · **activo** (`--color-active`, `--color-active-bg`, peso 500 y marcador/indicador visible) · deshabilitado. |
| **Responsive** | < 768 px barra inferior; ≥ 1024 px barra lateral; 768–1023 px según D-06. Máx. 5 destinos en barra inferior; el resto en "Más". |
| **Accesibilidad** | `<nav>` con `aria-label`; ítem activo con `aria-current="page"`; etiqueta siempre visible (no solo iconos); orden del DOM = orden visual. |

---

## 8. Tablas

| Aspecto | Criterio |
|---|---|
| **Propósito** | Comparar y revisar muchos movimientos u otros datos tabulares, principalmente en escritorio. |
| **Jerarquía** | Encabezado de columna → monto → resto de columnas. |
| **Estructura** | Contenedor en tarjeta (`lg`). Encabezado en `surface-2`, texto Label 12 px/500 `text-secondary`; filas de 48–56 px con separador 1 px; texto 14 px; **montos alineados a la derecha** con cifras tabulares; fecha a la izquierda en formato consistente. Pie con totales cuando aplique. |
| **Variantes** | Estándar · densa (fila 40 px, solo escritorio con puntero) · con selección **[PENDIENTE]** · con totales. |
| **Estados** | Fila reposo/hover (`surface-2`)/foco/seleccionada · columna ordenada (indicador + `aria-sort`) · cargando (esqueleto de filas) · vacía · error. |
| **Responsive** | **[OBLIGATORIO]** En < 768 px la tabla se transforma en **lista de tarjetas/filas** (ver §9); no se admite scroll horizontal de página. En tablet puede usar scroll horizontal **dentro** del contenedor (`overflow-x: auto`) con primera columna fija. |
| **Accesibilidad** | `<table>` semántica con `<th scope>`; `<caption>` o `aria-label`; columnas ordenables con botón y `aria-sort`; no usar solo color para ingreso/gasto (signo + icono). |

---

## 9. Listas (movimientos, cuentas, categorías, deudas)

| Aspecto | Criterio |
|---|---|
| **Propósito** | Presentar elementos repetidos de forma escaneable; es el formato **principal en móvil**. |
| **Jerarquía** | Concepto (primario, 16 px) + monto (alineado a la derecha, 16 px/500, color semántico) → metadatos (14 px `text-secondary`: categoría · cuenta · fecha). |
| **Estructura** | Fila de mín. 56 px; icono/avatar de categoría opcional a la izquierda (40 px, `surface-3`, radio `md`); separador 1 px; agrupación por fecha con encabezado Label 12 px. |
| **Variantes** | Movimientos (con signo y color) · Cuentas (saldo) · Categorías · Deudas (saldo pendiente + progreso de abonos) · Lista de ajustes. |
| **Estados** | Reposo · hover/foco · presionada · seleccionada · deslizada/menú de acciones **[PROPUESTA]** · cargando (esqueleto) · vacía. |
| **Responsive** | Misma estructura en todos los anchos; en escritorio puede mostrarse en 2 columnas dentro de un panel. Listas largas: agrupar por fecha o paginar **[PENDIENTE]** según volumen real. |
| **Accesibilidad** | `<ul>/<li>` (o `role="list"`); fila accionable es un único elemento enfocable; monto con texto completo ("Gasto, 250.00 pesos"), no solo símbolo y color. |

---

## 10. Indicadores (badges, chips, progreso, saldo, variación)

| Aspecto | Criterio |
|---|---|
| **Propósito** | Comunicar estado o magnitud de forma compacta (tipo de movimiento, deuda liquidada, avance de abonos). |
| **Jerarquía** | Secundaria: nunca compite con la cifra principal. |
| **Estructura** | **Badge/chip:** altura 24 px, padding 4×8 px, radio `--radius-sm` o pill, texto 12 px/500, fondo `--color-*-bg` y texto `--color-*`, **siempre con texto** (opcionalmente + icono 16 px). **Progreso:** pista `surface-3` de 8 px de alto, radio pill, relleno color semántico sólido (sin degradado); valor numérico visible al lado. **Variación:** signo +/− + porcentaje + texto de referencia. |
| **Variantes** | Ingreso · Gasto · Deuda · Liquidada · Advertencia · Info · Neutro. |
| **Estados** | Informativos (no interactivos). Si son filtros interactivos → son chips de filtro (ver §4). |
| **Responsive** | No truncar badges; si no caben, pasan a la línea siguiente. |
| **Accesibilidad** | Barra de progreso con `role="progressbar"` + `aria-valuenow/min/max` y etiqueta; no depender de color; contraste según §5.3. |

---

## 11. Gráficas

| Aspecto | Criterio |
|---|---|
| **Propósito** | Mostrar tendencias, composición y comparativos de forma que se entienda de un vistazo. Tipos concretos disponibles en la app: **[PENDIENTE]** (el README solo menciona "reportes"). |
| **Jerarquía** | Título y cifra resumen → gráfica → leyenda/ejes. |
| **Estructura** | Dentro de tarjeta. Colores de serie en orden `--chart-series-1…6`; cuadrícula `--chart-grid` de 1 px; texto de ejes `--chart-axis-text` 12 px; trazo `--chart-stroke-width`; barras con radio `--chart-bar-radius`. Sin degradados, sin sombras en elementos, sin 3D. Eje cero siempre visible en barras. |
| **Variantes recomendadas** | **Línea** (tendencia en el tiempo) · **Barras** (comparar periodos/categorías) · **Barras apiladas** (composición) · **Dona** (≤ 5 partes; la tabla es mejor para más) · **Progreso** (abonos/deuda). Evitar circular completa con muchas porciones. |
| **Estados** | Cargando (esqueleto del contenedor) · sin datos (mensaje + acción) · error · elemento resaltado (hover/foco/tap: etiqueta con valor exacto) · serie oculta/visible. |
| **Responsive** | Alto mínimo 200 px en móvil; menos marcas en el eje X (muestreo) en pantallas estrechas; leyenda debajo en móvil, al lado en escritorio. Valores exactos accesibles por toque. |
| **Accesibilidad** | Cada serie con identificador **no solo de color** (etiqueta directa, patrón o marcador distinto); alternativa textual (resumen) y/o tabla de datos; marcas gráficas ≥ 3:1 sobre la superficie; turquesa y cian se parecen: separarlos con marcador/etiqueta. Respetar `prefers-reduced-motion` (sin animaciones de entrada). |

Reglas semánticas: ingresos con `--color-income`, gastos con `--color-expense`, deudas con `--color-debt` **cuando la gráfica es de ese dominio**; en comparativos neutros usar la secuencia `--chart-series-*`.

---

## 12. Mensajes de estado (inline, banners, validación)

| Aspecto | Criterio |
|---|---|
| **Propósito** | Informar el resultado o la situación de un elemento o de la pantalla (éxito, advertencia, error, información). |
| **Jerarquía** | Icono + texto; el título solo si hay detalle. Prioridad: error > advertencia > información > éxito. |
| **Estructura** | Bloque con fondo `--color-*-bg`, borde 1 px del color semántico, radio `md`, padding 12–16 px, icono 20 px + mensaje 14–16 px (`text-primary` para el texto; color semántico para el icono). Posible acción asociada (enlace o botón terciario). |
| **Variantes** | Info · Éxito (`--color-income`) · Advertencia · Error · Persistente (banner de pantalla) · Inline (bajo un campo). |
| **Estados** | Visible · descartable (si no es crítico) · con acción. |
| **Responsive** | Ancho completo del contenedor; el icono nunca se separa del texto; texto en varias líneas sin truncar. |
| **Accesibilidad** | `role="alert"` (error/urgente) o `role="status"` (informativo); no desaparece solo si contiene información necesaria; no solo color: siempre icono + texto. |

---

## 13. Notificaciones (toasts)

| Aspecto | Criterio |
|---|---|
| **Propósito** | Confirmar acciones completadas o avisos breves **no críticos** (p. ej. "Gasto guardado", "Respaldo exportado"). |
| **Jerarquía** | Baja; no interrumpe la tarea. |
| **Estructura** | Panel `surface-3` con borde 1 px, radio `md`, `--shadow-md`, mín. 48 px de alto, icono semántico + texto de una o dos líneas + acción opcional ("Deshacer") + cierre. Posición: inferior centrada (móvil, sobre la barra inferior y `--safe-bottom`) o inferior derecha (escritorio). `z-index: --z-toast`. |
| **Variantes** | Éxito · Info · Advertencia · Error (los errores que bloquean la tarea **no** son toasts: son mensajes inline o modal). |
| **Estados** | Entrando · visible · pausada (hover/foco) · saliendo. |
| **Responsive** | Máx. 1 visible a la vez en móvil (cola); ancho ≤ 100 % − gutters; en escritorio máx. 360 px. |
| **Accesibilidad** | `role="status"` + `aria-live="polite"`; duración ≥ 5 s (más si contiene acción) y pausa al enfocar/hover; acción "Deshacer" alcanzable por teclado; nunca contiene información que solo exista allí. |

Reglas: **[OBLIGATORIO]** no usar toasts para mensajes de seguridad críticos (bloqueo, frase de recuperación, borrado de datos); **[RECOMENDADO]** máx. 1 notificación por acción.

---

## 14. Resumen de tokens por componente

| Componente | Superficie | Borde | Radio | Altura/tamaño | Texto |
|---|---|---|---|---|---|
| Botón | action-* / secondary-bg | `border-control` (secundario) | `md` | 44 (52) | 14–16 / 500 |
| Tarjeta | `surface-1` | `border` | `lg` | auto | título 18 |
| Campo | `surface-2` | `border-control` | `md` | 44 | 16 |
| Selector | `surface-2` / `selected-bg` | `border-control` / `selected-border` | `md` / pill | 44 | 16 |
| Modal | `surface-1` | `border` | `xl` | máx. 480 px ancho | H3 20 |
| Menú | `surface-2` | `border` | `md` | ítem 44 | 14–16 |
| Navegación | `surface-1` | `border` (separador) | `md` (ítem) | 64 (inferior) / 248 (lateral) | 12–14 |
| Tabla | `surface-1` + encabezado `surface-2` | `border` | `lg` (contenedor) | fila 48–56 | 14 |
| Lista | `surface-1` | `border` (separador) | `md` (seleccionada) | fila ≥ 56 | 16 / 14 |
| Indicador | `*-bg` | — | `sm` / pill | 24 | 12 / 500 |
| Gráfica | `surface-1` | `border` | `lg` | alto ≥ 200 | 12 |
| Mensaje | `*-bg` | color semántico | `md` | auto | 14–16 |
| Toast | `surface-3` | `border` | `md` | ≥ 48 | 14 |
