export const demoManuals = {
    research: `
## Terminal de Estrategia Jurídica

Esta herramienta simula el motor de inteligencia artificial de Judic-IA, diseñado para acelerar la investigación legal y la formulación de estrategias.

### ¿Cómo usar esta demo?
1.  **Selecciona una Jurisdicción:** Elige entre "Nación" o una provincia específica para ajustar el contexto legal.
2.  **Define el Caso:** Escribe una consulta natural, por ejemplo: *"Jurisprudencia sobre despido sin causa en CABA hace 2 años"* o seleccióna una categoría rápida.
3.  **Ejecuta la Búsqueda:** Haz clic en "Generar Estrategia IA".

### ⚖️ Demo vs. Versión Full
*   **En esta Demo:** Los resultados son pre-generados basados en ejemplos reales para mostrar la estructura y profundidad de respuesta. La exportación a PDF está deshabilitada.
*   **En el Gabinete Real:** La IA procesa tus consultas en tiempo real sobre una base de datos de millones de fallos actualizados al día. Puedes generar escritos completos (Demandas, Cédulas) y exportarlos en formato .docx o .pdf listos para presentar.
`,

    cases: `
## Gestión de Expedientes

Organiza tus casos activos, monitorea estados procesales y mantén el control de tu cartera de litigios.

### ¿Cómo usar esta demo?
1.  **Explora el Tablero:** Mira el estado de los expedientes cargados (Abiertos, en Curso, etc.).
2.  **Gestión Manual:** Puedes simular el cambio de estado de un caso o ver su carpeta digital.

### ⚖️ Demo vs. Versión Full
*   **En esta Demo:** Los expedientes son ficticios y la gestión es exclusivamente manual y local.
*   **En el Gabinete Real:** Sincronización automática con el PJN y fueros provinciales. Recibes alertas en tiempo real sobre nuevos movimientos, notificaciones del sistema de gestión judicial y puedes vincular documentos directamente desde la nube.
`,

    clients: `
## CRM y Gestión de Clientes

Centraliza la comunicación con tus clientes en una bandeja de entrada moderna y organizada.

### ¿Cómo usar esta demo?
1.  **Explora el Inbox:** Selecciona un cliente de la lista para ver su chat en tiempo real.
2.  **Mi Perfil Público:** Haz clic en el botón de globo terráqueo para copiar tu enlace de perfil en el Marketplace.
3.  **Ficha del Cliente:** Abre la barra lateral para ver el resumen generado por IA y los datos de contacto.

### ⚖️ Demo vs. Versión Full
*   **En esta Demo:** Interactúas con "clientes de prueba" en un entorno simulado. Las respuestas de IA son pre-generadas.
*   **En el Gabinete Real:** El inbox se conecta a WhatsApp/Web. La IA responde en tiempo real a tus clientes, califica prospectos y te notifica solo cuando hay una oportunidad real.
`,

    calculators: `
## Calculadoras Jurídicas

Herramientas matemáticas precisas para el cálculo de plazos y liquidaciones laborales.

### ¿Cómo usar esta demo?
1.  **Prueba los Cálculos:** Ingresa fechas de ingreso/egreso o plazos de notificación.
2.  **Verifica Resultados:** La calculadora arroja resultados inmediatos basados en la normativa vigente.

### ⚖️ Demo vs. Versión Full
*   **En esta Demo:** Las calculadoras usan lógica estática con tasas de interés estándar.
*   **En el Gabinete Real:** Integración con Tasas de Interés oficiales actualizadas por el BNA y SCBA diariamente. Permite exportar informes periciales detallados con el desglose rubro por rubro para adjuntar como prueba.
`,

    legislation: `
## Digesto Jurídico Unificado

Acceso rápido a los códigos de fondo y forma, organizados por jurisdicción.

### ¿Cómo usar esta demo?
1.  **Buscador InfoLeg:** Simula una búsqueda por número de norma o texto.
2.  **Códigos Procesales:** Filtra por provincia para ver las normas locales disponibles.

### ⚖️ Demo vs. Versión Full
*   **En esta Demo:** Accedes a enlaces directos y visualización de normas estáticas.
*   **En el Gabinete Real:** Buscador semántico avanzado. No solo buscas por número, sino por "concepto". Incluye control de concordancias, jurisprudencia vinculada a cada artículo y alertas de derogaciones o modificaciones.
`,

    agenda: `
## Control de Plazos

Agenda inteligente que organiza tu calendario judicial.

### ¿Cómo usar esta demo?
1.  **Vista de Calendario:** Observa cómo se organizan los vencimientos por prioridad cromática.
2.  **Semaforización:** Los plazos inminentes se destacan automáticamente.

### ⚖️ Demo vs. Versión Full
*   **En esta Demo:** Los eventos son de muestra y no permiten edición real.
*   **En el Gabinete Real:** Sincronización bidireccional con Google Calendar y Outlook. El asistente IA te envía recordatorios por WhatsApp 24hs antes de cada vencimiento crítico y te ayuda a recalcular plazos según ferias judiciales imprevistas.
`,

    library: `
## Base de Conocimiento

Repositorio de documentos, modelos de escritos y jurisprudencia propia.

### ¿Cómo usar esta demo?
1.  **Explora Carpetas:** Mira la estructura de organización sugerida para un estudio moderno.
2.  **Búsqueda:** Prueba buscar conceptos clave entre los documentos de muestra.

### ⚖️ Demo vs. Versión Full
*   **En esta Demo:** Los documentos son visuales y el almacenamiento es limitado.
*   **En el Gabinete Real:** IA "RAG" (Generación Aumentada). Puedes "chatear" con tu propia biblioteca; por ejemplo: *"Buscame todas mis demandas de accidentes donde haya citado el fallo 'Arias'"*. Almacenamiento ilimitado para toda la historia de tu estudio.
`,

    dashboard: `
## Gabinete de Control (Demo)

Este es tu centro de mando en el entorno Sandbox.

### ¿Cómo usar esta demo?
1.  **Navegación:** Utiliza las tarjetas para explorar cada módulo de Judic-IA.
2.  **Garantía:** Es un entorno 100% seguro; nada de lo que borres o edites aquí afectará datos reales.

### ⚖️ Demo vs. Versión Full
*   **En esta Demo:** Experimentas con datos pre-cargados para conocer la interfaz y el alcance de las herramientas.
*   **En el Gabinete Real:** Operas sobre tu verdadera cartera de clientes. El Dashboard te ofrece "Insights" predictivos sobre tu rentabilidad, carga horaria y probabilidad de éxito en tus litigios basándose en tu historial real.
`,

    federal: `
## Hub Federal e Interjurisdiccional

Herramientas diseñadas para facilitar la práctica legal fuera de tu jurisdicción habitual.

### ¿Cómo usar esta demo?
1.  **Directorio de Corresponsales:** Selecciona una provincia (ej. Córdoba o Santa Fe) para ver cómo Judic-IA te conecta con colegas verificados para delegar tareas locales.
2.  **Simulación de Chat:** Haz clic en el ícono de mensaje para ver cómo se iniciaría una colaboración profesional.
3.  **Recursos Centrales:** Explora las guías de organismos nacionales y padrones.

### ⚖️ Demo vs. Versión Full
*   **En esta Demo:** Resultados estáticos de colegas y guías de referencia rápidas.
*   **En el Gabinete Real:** Integración directa con **Bus-Justicia** para el seguimiento de oficios y testimonios. Acceso a una red real de miles de abogados verificados con sistema de chat encriptado y herramientas de gestión de corresponsalía integradas.
`
};
