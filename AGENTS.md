## Sistema de diseño (Metria)

Antes de modificar estilos, componentes o pantallas, lee **`metria-design-system/AI-Implementation-Rules.md`** y sigue su procedimiento de siete pasos. Orden de consulta:

1. `metria-design-system/design-tokens.css` — única fuente de valores visuales.
2. `metria-design-system/Design-System-Metria.md` — reglas de color, tipografía, espaciado, logotipo y accesibilidad.
3. `metria-design-system/Components-Guidelines.md` — criterios por componente.
4. `metria-design-system/UX-Patterns-Metria.md` — patrones de experiencia.

Reglas críticas (detalle en los documentos):
- Nada de colores, fuentes, tamaños ni radios literales: solo tokens.
- Sin degradados decorativos, transparencias decorativas ni `backdrop-filter`. El degradado es solo del logotipo.
- Sin recursos remotos (la app no tiene permiso de INTERNET y usa CSP): fuentes y logotipos van locales.
- No tocar `src/core/`, `android/`, firma ni versiones. No instalar dependencias sin autorización.
- No cambiar lógica de negocio ni eliminar funcionalidades en cambios visuales.
- Verificar en tema oscuro y claro, y en ~360, ~768 y ≥1024 px.
- Lo marcado **[PENDIENTE]** no es regla: pregunta antes de implementarlo.
- Nombre: "Metria" en textos; wordmark "METRIA".
