# UX Patterns — Metria

> **Versión:** 1.0.0-draft · **Responsabilidad:** patrones de experiencia para una app de finanzas personales por flujo de caja.
> **Valores y componentes:** ver `design-tokens.css` y `Components-Guidelines.md`. No se repiten aquí.
> Marcas: **[OBLIGATORIO]**, **[RECOMENDADO]**, **[PENDIENTE]**, **[PROPUESTA]**.

## 1. Principios y estado de las funcionalidades

### 1.1 Principios de UX

1. **Prevenir antes que corregir:** valores por defecto sensatos, restricciones de entrada, avisos antes de confirmar.
2. **Un dato = una verdad:** el mismo saldo o total se ve igual en cualquier pantalla.
3. **Decir qué cambió:** toda acción que modifica saldos muestra su efecto (de X a Y).
4. **Reversibilidad primero:** preferir "Deshacer" a "¿Estás seguro?" en acciones reversibles; confirmar solo lo irreversible.
5. **Cifras antes que adornos:** la pantalla debe responder una pregunta financiera concreta.

### 1.2 Qué está confirmado y qué no

Fuente: README del proyecto `metria-android` (paridad con la ficha 1.0.0 del escritorio). Este documento **no inventa funcionalidades**.

| Elemento | Estado | Nota |
|---|---|---|
| Cuentas / métodos de pago, capital inicial | Confirmado | |
| Ingresos, gastos, caja chica | Confirmado | |
| Transferencias entre cuentas **con comisión** | Confirmado | |
| Deudas, abonos, deudas liquidadas | Confirmado | |
| Inicio, resumen por periodo, reportes | Confirmado | Contenido exacto de cada uno: pendiente de inspección. |
| Categorías | Confirmado | Reglas de jerarquía/color: pendiente. |
| Edición universal de registros | Confirmado | |
| Eliminar cuenta (bloqueado si hay transferencia o gasto asociado) | Confirmado | |
| Aviso de duplicados | Confirmado | |
| Respaldos cifrados, importar/exportar, borrar todos los datos | Confirmado | |
| Modo claro/oscuro y tamaño de vista | Confirmado | |
| **Presupuestos** | **No confirmado** | Se documenta como patrón condicional (§9). |
| **Gráficas y tendencias** (tipos concretos) | **No confirmado** | "Reportes" existe; el tipo de visualización no se documenta. |
| Metas de ahorro, inversión, suscripciones, impuestos | No confirmado | No se documentan. |

---

## 2. Dashboard financiero (Inicio)

- **Propósito:** responder en 5 segundos "¿cómo estoy hoy?".
- **[OBLIGATORIO] Orden de contenido (arriba → abajo):**
  1. Selector de periodo (ver §3.2).
  2. Balance disponible (Display/H1) con etiqueta.
  3. Ingresos y gastos del periodo (2 tarjetas métrica).
  4. Deudas pendientes (tarjeta métrica con color `debt`) — **solo si existen deudas activas**.
  5. Acceso rápido: "Registrar ingreso" / "Registrar gasto" (acciones frecuentes).
  6. Últimos movimientos (5–8 filas) con enlace "Ver todos".
  7. Gráfica/tendencia **[PENDIENTE]** (si la app la ofrece).
- **[OBLIGATORIO]** Una sola acción primaria visible (registrar el movimiento más frecuente); la otra, secundaria. **[PENDIENTE]** cuál es la más frecuente.
- **[RECOMENDADO]** Móvil: 1 columna en ese orden. Escritorio: balance a ancho completo, métricas en 2–3 columnas, movimientos recientes y gráfica en 2 columnas.
- **[RECOMENDADO]** No más de 6 tarjetas en el dashboard.

---

## 3. Resumen de balances

### 3.1 Definiciones visibles
- **[OBLIGATORIO]** Cada cifra tiene etiqueta que dice qué incluye ("Balance disponible", "Total en cuentas", "Deuda pendiente"). **[PENDIENTE D-09]** definir con la lógica real de la app cuál es el balance principal (suma de cuentas, flujo del periodo, etc.). No inventar el cálculo en la interfaz.
- **[OBLIGATORIO]** Una cifra derivada (total) siempre es consistente con el detalle que la compone.

### 3.2 Periodo
- **[OBLIGATORIO]** El periodo activo es visible y se cambia con un selector segmentado/desplegable; el periodo seleccionado se conserva al navegar entre pantallas.
- **[RECOMENDADO]** Mostrar el rango explícito ("1–31 oct 2026") junto al nombre del periodo.

### 3.3 Variación
- **[RECOMENDADO]** Variación vs. periodo anterior con signo, porcentaje y texto de referencia. Si no hay periodo anterior, no mostrar variación (no mostrar "0 %").
- **[OBLIGATORIO]** Un aumento en gasto no se pinta como "bueno" por ser verde ni al revés: el color sigue al **tipo** (ingreso/gasto), no al signo de la variación.

---

## 4. Registro de ingresos

- **Entrada:** botón/atajo "Registrar ingreso" → modal o pantalla (ver §13).
- **Campos recomendados:** monto (obligatorio) · cuenta de destino (obligatorio) · fecha (por defecto: hoy) · concepto/descripción · categoría **[PENDIENTE: ¿los ingresos usan categoría?]** · notas (opcional).
- **[OBLIGATORIO]** El monto es el primer campo y toma el foco al abrir.
- **[OBLIGATORIO]** Antes de guardar, un resumen de efecto: "Cuenta X: $A → $B".
- **[OBLIGATORIO]** Tras guardar: confirmación breve (toast) con acción "Deshacer" o "Ver movimiento"; el formulario se cierra o se limpia según el flujo (ver §13.3).
- **[RECOMENDADO]** Opción "Guardar y registrar otro" para capturas en serie.

---

## 5. Registro de gastos

- **Entrada y estructura:** igual que ingresos (§4), con color/etiqueta de gasto.
- **Campos recomendados:** monto · cuenta/método de pago (origen) · fecha · concepto · categoría · notas.
- **Caja chica:** confirmada en el README, pero su flujo exacto es **[PENDIENTE]**. Mostrarla como una cuenta/origen distinguible solo si la app la trata así.
- **[OBLIGATORIO]** Aviso de duplicados: si existe un movimiento muy similar (mismo monto, fecha y concepto), mostrar mensaje de advertencia **inline antes de guardar** con dos opciones: "Guardar de todos modos" (secundaria) y "Revisar el existente" (terciaria). El criterio de similitud lo define la lógica existente, no la interfaz.
- **[OBLIGATORIO]** Si el gasto deja la cuenta en saldo negativo o supera el saldo disponible: advertencia clara (no bloqueo, salvo que la lógica de negocio lo bloquee). **[PENDIENTE]** confirmar el comportamiento real.

### 5.1 Transferencias con comisión (confirmadas)
- **[OBLIGATORIO]** Mostrar en el formulario: cuenta origen, cuenta destino, monto transferido, **comisión** (campo separado) y el **total que sale** del origen.
- **[OBLIGATORIO]** Vista previa del efecto en ambas cuentas antes de guardar.
- **[OBLIGATORIO]** En movimientos, la transferencia se identifica con etiqueta **Transferencia** (tono `info`/neutro; no es ingreso ni gasto) y la comisión se muestra como parte del detalle.

---

## 6. Movimientos

- **Propósito:** historial único y confiable de ingresos, gastos, transferencias y abonos.
- **[OBLIGATORIO] Fila (Components-Guidelines §9):** concepto, monto con signo y color, categoría, cuenta, fecha; tipo identificable por texto/icono.
- **[OBLIGATORIO]** Orden por fecha descendente; agrupar por día/semana en móvil.
- **[OBLIGATORIO]** Filtros mínimos: periodo, tipo (ingreso/gasto/transferencia/abono), cuenta, categoría. Los filtros activos se ven como chips que se pueden quitar una a una + "Limpiar todo".
- **[RECOMENDADO]** Búsqueda por concepto.
- **[OBLIGATORIO] Edición universal:** abrir cualquier movimiento muestra el mismo formulario del tipo correspondiente, prellenado; mostrar claramente qué se edita; al guardar, indicar si cambió algún saldo.
- **[OBLIGATORIO]** Eliminar un movimiento: confirmación con el efecto sobre saldos (§12).
- **[PENDIENTE]** Paginación vs. desplazamiento continuo según volumen real.

---

## 7. Cuentas

- **Propósito:** ver dónde está el dinero y cuánto hay en cada lugar.
- **Lista:** nombre, tipo (si existe), saldo actual (alineado a la derecha). Total general arriba.
- **Detalle de cuenta:** saldo, capital inicial, movimientos de la cuenta, acciones (editar, transferir).
- **Creación:** nombre (obligatorio, único — mostrar error si se repite), capital inicial (obligatorio, puede ser 0), tipo **[PENDIENTE]**.
- **Eliminación (confirmada con restricción):** si la cuenta tiene transferencias o gastos asociados, la eliminación está **bloqueada**.
  - **[OBLIGATORIO]** No ocultar ni deshabilitar el botón sin explicación. Mostrar el mensaje: qué impide eliminarla ("Esta cuenta tiene 3 gastos y 1 transferencia asociados") y qué alternativa existe (editar, desactivar **[PENDIENTE: ¿existe?]**, reasignar).
- **[OBLIGATORIO]** Nunca mostrar el saldo en rojo solo por ser negativo sin etiqueta textual ("Saldo negativo").

---

## 8. Categorías

- **Propósito:** clasificar movimientos para entender en qué se va el dinero.
- **[OBLIGATORIO]** Una categoría = nombre + (icono opcional); sin color propio obligatorio: el color de marca/semántico no se asigna por categoría salvo que ya exista **[PENDIENTE]**.
- **Gestión:** lista editable; crear, renombrar. Eliminar o fusionar una categoría en uso exige indicar cuántos movimientos tiene y qué pasará con ellos **[PENDIENTE: comportamiento real]**.
- **[OBLIGATORIO]** Selección de categoría en formularios: desplegable con búsqueda si hay > 8; categoría más usada/reciente primero **[PROPUESTA]**.
- **[RECOMENDADO]** Evitar más de 2 niveles de jerarquía. **[PENDIENTE]** si la app soporta subcategorías.

---

## 9. Presupuestos

> **No confirmados en la app.** El README no menciona presupuestos. Esta sección es un **patrón condicional [PROPUESTA]**: aplicar solo si la app los incorpora, previa validación.

- **Si existen:** tarjeta por categoría/periodo con nombre, gastado / límite, barra de progreso (`--color-info` hasta 80 %, `--color-warning` de 80 a 100 %, `--color-expense` al excederse) y texto "Te quedan $X" / "Excediste $X".
- **[OBLIGATORIO]** El estado nunca se comunica solo por color de la barra: incluir el texto.
- **[OBLIGATORIO]** Un presupuesto excedido es información, no un error (no usar `--color-error`).
- **[PENDIENTE D-10]** Umbrales (80 %), periodicidad y relación con categorías.

---

## 10. Deudas

- **Confirmado:** deudas, abonos y deudas liquidadas.
- **Lista de deudas:** acreedor/concepto, saldo pendiente (color `--color-debt`), progreso de abonos (monto abonado / total) y estado (Activa / Liquidada).
- **Detalle:** historial de abonos, saldo pendiente, fecha de registro, botón primario "Registrar abono".
- **Registro de abono:** monto (por defecto: ninguno; atajo "Liquidar total" **[PROPUESTA]**), cuenta de origen, fecha. **[OBLIGATORIO]** Impedir que el abono exceda el saldo pendiente o advertir claramente **[PENDIENTE: comportamiento real]**.
- **Liquidación:** al llegar a saldo 0, la deuda pasa a "Liquidada" con confirmación positiva (toast); permanece consultable en su sección.
- **[OBLIGATORIO]** Las deudas liquidadas se distinguen visualmente (badge "Liquidada", atenuación mínima respetando contraste), no se mezclan con las activas en los totales.
- **[RECOMENDADO]** Ordenar las activas por fecha o monto, con criterio visible.

---

## 11. Gráficas y tendencias

> Tipos de gráficas disponibles: **[PENDIENTE D-11]**. Reglas para cuando existan:

| Pregunta del usuario | Gráfica recomendada |
|---|---|
| ¿Cómo evolucionan mis gastos/ingresos? | Línea o barras por periodo |
| ¿En qué gasto más? | Barras horizontales por categoría ordenadas (preferible a dona) |
| ¿Cuánto representa cada categoría? | Dona (≤ 5 partes) o barras apiladas |
| ¿Cuánto llevo pagado de una deuda? | Barra de progreso |

- **[OBLIGATORIO]** Título que enuncia lo que se mide + periodo.
- **[OBLIGATORIO]** Ejes rotulados con unidad; valores exactos por toque/hover; eje cero visible en barras.
- **[OBLIGATORIO]** No usar gráficas con una sola barra o un solo punto: mostrar la cifra.
- **[RECOMENDADO]** Máx. 2 gráficas por pantalla en móvil.
- **[RECOMENDADO]** Acompañar con interpretación textual breve ("Gastos +12 % vs. septiembre").

---

## 12. Confirmaciones y errores

### 12.1 Cuándo confirmar

| Acción | Tratamiento |
|---|---|
| Guardar un movimiento | Sin diálogo; toast de éxito con "Deshacer" **[PROPUESTA: el "Deshacer" depende de que la lógica lo soporte]**. |
| Editar un movimiento | Sin diálogo; toast "Cambios guardados". |
| Eliminar un movimiento | Diálogo de confirmación con efecto sobre saldos. |
| Eliminar categoría en uso / cuenta | Diálogo destructivo con conteo de elementos afectados. |
| Importar respaldo | Diálogo que advierte que se reemplazan los datos y que se crea copia previa (comportamiento existente). |
| **Borrar todos los datos** | Diálogo destructivo de doble paso (escribir una palabra o mantener presionado) **[PROPUESTA]**; texto claro: "No se puede deshacer. Exporta un respaldo antes." |
| Cambiar ajustes reversibles | Sin confirmación. |

### 12.2 Anatomía de un diálogo de confirmación
Título con la acción ("¿Eliminar este gasto?") → consecuencia concreta ("El saldo de Efectivo subirá de $X a $Y") → botones: acción nombrada (destructiva) + "Cancelar". **[OBLIGATORIO]** El foco inicial va en "Cancelar" cuando la acción es destructiva.

### 12.3 Errores
- **[OBLIGATORIO]** Estructura del mensaje: qué pasó + por qué (si se sabe) + qué hacer. Sin códigos técnicos ni culpas ("Escribiste mal…").
- **[OBLIGATORIO]** Errores de campo → inline junto al campo; errores de envío → banner arriba del formulario; error crítico de sistema → mensaje persistente (no toast).
- **[OBLIGATORIO]** No perder lo que el usuario escribió.
- **[OBLIGATORIO]** Al fallar un envío, el foco va al primer campo con error (o al banner) y se anuncia con `role="alert"`.

### 12.4 Seguridad y acceso (flujos existentes; solo reglas de presentación)
- **[OBLIGATORIO]** Los flujos de contraseña maestra, **frase de recuperación**, bloqueo automático y desbloqueo biométrico **no se rediseñan sin autorización**: solo se estilizan con tokens, conservando su orden y su lógica (la frase de recuperación debe seguir mostrándose hasta confirmarla, antes de escribir a disco).
- **[OBLIGATORIO]** Mensajes de contraseña incorrecta: claros, sin revelar detalles de seguridad; ofrecer recuperación.
- **[OBLIGATORIO]** Al bloquear por inactividad, la pantalla de bloqueo no muestra cifras.

---

## 13. Formularios de creación y edición

### 13.1 Estructura común
1. Título que dice la acción y el objeto ("Nuevo gasto", "Editar cuenta").
2. Campos en orden de importancia: **monto → cuenta → fecha → categoría → concepto → notas**.
3. Resumen de efecto (si altera saldos).
4. Acciones: primaria ("Guardar gasto") + secundaria ("Cancelar").

### 13.2 Reglas
- **[OBLIGATORIO]** Marcar obligatorios con texto ("Obligatorio") o marcar los opcionales con "(opcional)"; no depender de un asterisco sin leyenda.
- **[OBLIGATORIO]** Validar al salir del campo y al enviar.
- **[OBLIGATORIO]** Valores por defecto: fecha = hoy; cuenta = la última usada **[PROPUESTA]**.
- **[RECOMENDADO]** Prellenado inteligente solo con datos del propio usuario (última cuenta/categoría); sin sugerencias automáticas opacas.
- **[RECOMENDADO]** En móvil, formularios de más de 5 campos ocupan pantalla completa (no modal pequeño).

### 13.3 Después de guardar
- Crear: cerrar y confirmar con toast, o mantener abierto con "Guardar y registrar otro".
- Editar: cerrar y confirmar.
- Cerrar con cambios sin guardar → confirmación "Descartar cambios".

### 13.4 Edición
- **[OBLIGATORIO]** El formulario de edición es **el mismo** que el de creación (mismos campos, orden y validaciones).
- **[OBLIGATORIO]** Si editar cambia saldos, mostrar el resumen de efecto actualizado.

---

## 14. Estados vacíos

Estructura: icono sencillo (sin ilustraciones decorativas) → título → una frase → acción primaria.

| Pantalla | Título | Acción |
|---|---|---|
| Inicio (primera vez) | "Empieza registrando tu primera cuenta" | "Crear cuenta" |
| Cuentas | "Aún no tienes cuentas" | "Crear cuenta" |
| Movimientos | "Todavía no hay movimientos" | "Registrar gasto" / "Registrar ingreso" |
| Movimientos con filtros | "Sin resultados con estos filtros" | "Limpiar filtros" |
| Categorías | "Aún no tienes categorías" | "Crear categoría" |
| Deudas | "No tienes deudas registradas" | "Registrar deuda" |
| Gráficas | "Aún no hay datos para este periodo" | Cambiar periodo o registrar movimiento |

- **[OBLIGATORIO]** Distinguir **vacío** (aún no hay datos) de **sin resultados** (hay datos pero el filtro no encuentra) y de **error** (falló la carga).
- **[RECOMENDADO]** Tono cercano pero profesional; sin humor ni emojis.

---

## 15. Carga de información

- **[OBLIGATORIO]** La app opera **sin red** (sin permiso de INTERNET); por tanto, los tiempos de carga son locales y breves. No diseñar indicadores de "conexión" ni modo sin conexión.
- **[OBLIGATORIO]** Operaciones que pueden demorar (descifrar con contraseña maestra, importar/exportar respaldo, cálculo de reportes grandes): indicador visible desde ~300 ms, botón en estado cargando, sin doble envío.
- **[OBLIGATORIO]** Para listas y tarjetas de cálculo: **esqueletos** (superficie `surface-2`, sin animación bajo `prefers-reduced-motion`) en lugar de *spinners* de pantalla completa.
- **[RECOMENDADO]** Operaciones < 300 ms no muestran indicador (evita parpadeo).
- **[RECOMENDADO]** Operaciones largas informan progreso real cuando se conoce; si no, indeterminado.
- **[OBLIGATORIO]** Los esqueletos reservan el espacio final para evitar saltos de diseño.
- **[OBLIGATORIO]** Tras bloquear la app (recarga de página por seguridad), la pantalla de acceso es el único estado visible; no mostrar datos mientras carga.

---

## 16. Decisiones pendientes de este documento

| ID | Decisión | Dependencia |
|---|---|---|
| D-09 | Definición exacta del "balance principal" | Lógica financiera existente |
| D-10 | Presupuestos: existencia, umbrales, periodicidad | Roadmap del producto |
| D-11 | Tipos de gráficas y tendencias disponibles | Pantalla de reportes real |
| D-12 | Campos exactos de ingreso/gasto (categoría en ingresos, tipo de cuenta, caja chica) | Esquema de datos real |
| D-13 | Comportamiento al exceder saldo / abono mayor a deuda | Lógica de negocio |
| D-14 | "Deshacer" tras guardar o eliminar | Soporte en la lógica |
| D-15 | Subcategorías y reglas de eliminación/fusión de categorías | Modelo de datos |
| D-16 | Paginación vs. scroll continuo de movimientos | Volumen real |
| D-17 | Acciones frecuentes del dashboard (cuál es la primaria) | Uso real |

(Las decisiones D-01 a D-08 están en `Design-System-Metria.md` §14.)
