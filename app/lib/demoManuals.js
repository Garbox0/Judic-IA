export const demoManuals = {
    research: `
## Terminal de Estrategia Jurídica

Esta herramienta simula el motor de inteligencia artificial de Judic-IA, diseñado para acelerar la investigación legal y la formulación de estrategias.

### ¿Cómo usar esta demo?
1.  **Selecciona una Jurisdicción:** Elige entre "Nación" o una provincia específica para ajustar el contexto legal.
2.  **Define el Caso:** Escribe una consulta natural, por ejemplo: *"Jurisprudencia sobre despido sin causa en CABA hace 2 años"* o seleccióna una categoría rápida.
3.  **Ejecuta la Búsqueda:** Haz clic en "Generar Estrategia IA".
4.  **Analiza los Resultados:**
    *   **Normativa:** Leyes aplicables detectadas automáticamente.
    *   **Jurisprudencia:** Fallos similares con resúmenes clave.
    *   **Estrategia:** Sugerencias tácticas para tu demanda o contestación.
    *   **Liquidación:** Un cálculo estimativo preliminar.

### Notas del Sandbox
*   En esta demo, la IA no procesa texto en tiempo real; devuelve resultados pre-generados para mostrar el formato y la calidad de la respuesta.
*   La función de "Exportar PDF" está deshabilitada.
`,

    cases: `
## Gestión de Expedientes

Organiza tus casos activos, monitorea estados procesales y mantén el control de tu cartera de litigios.

### Funcionalidades Clave
1.  **Tablero de Control:** Vista rápida de expedientes por estado (Abiertos, En Curso, Cerrados).
2.  **Listado Inteligente:** Tabla ordenable con carátula, número de expediente, fuero y estado.
3.  **Acciones Rápidas:**
    *   **Ver Carpeta:** Acceso al detalle completo del caso.
    *   **Chat:** Acceso directo a la conversación con el cliente.
    *   **Eliminar:** Borrado lógico del expediente.

### Archivo
Utiliza la sección "Archivos del Estudio" para consultar causas terminadas sin saturar tu vista principal.
`,

    clients: `
## CRM y Gestión de Clientes

Centraliza la comunicación con tus clientes y automatiza la toma de datos iniciales.

### Flujo de Trabajo
1.  **Enlace Inteligente:** Copia tu Link de Consulta y envíalo a tus clientes. La IA los entrevistará por ti.
2.  **Revisión de Consultas:** Cada nueva interacción aparece como una tarjeta en el grid.
3.  **Detalle del Cliente:** Haz clic en una tarjeta para ver datos de contacto, historial de chat y resumen del caso.

### Acciones Demo
*   Puedes intentar eliminar un cliente para ver el modal de confirmación.
*   Los botones de "Generar Escrito" o "Convertir a Expediente" muestran un aviso de restricción en este entorno.
`,

    calculators: `
## Calculadoras Jurídicas

Herramientas matemáticas precisas para el cálculo de plazos y liquidaciones laborales preliminares.

### 1. Calculadora de Plazos
*   **Fecha de Notificación:** Ingresa cuando recibió la cédula tu cliente.
*   **Días:** Cantidad de días del plazo legal.
*   **Tipo:** Selección entre días hábiles (judiciales) o corridos.
*   **Resultado:** Muestra el vencimiento exacto y las "Dos primeras horas".

### 2. Indemnización (Art. 245 LCT)
*   **Fechas:** Ingresa ingreso y egreso para calcular antigüedad.
*   **Mejor Remuneración:** Bruto mensual más alto.
*   **Resultado:** Calcula la indemnización por antigüedad considerando topes.

> *Nota: Estas calculadoras funcionan con lógica de cliente y no consultan feriados en tiempo real.*
`,

    legislation: `
## Digesto Jurídico Unificado

Acceso rápido a los códigos de fondo y forma más utilizados, organizados por jurisdicción.

### Navegación
*   **Códigos de Fondo:** Normas nacionales disponibles siempre.
*   **Leyes Especiales:** Selección de leyes complementarias frecuentes (LCT, Concursos, etc.).
*   **Códigos de Forma:** Selecciona tu provincia para acceder a los códigos procesales locales.

### Enlaces
*   **Flecha:** Enlace externo a InfoLeg o fuentes oficiales.
*   **Candado:** Documento PDF interno (Bloqueado en Demo).
`,

    agenda: `
## Control de Plazos

Agenda inteligente que calcula vencimientos y organiza tu calendario judicial.

### Funcionalidades
1.  **Calendario Visual:** Vista mensual con indicadores de carga de trabajo.
2.  **Próximos Vencimientos:** Lista priorizada de plazos inminentes (Semaforización).
3.  **Nota:** En la versión completa, esta agenda se sincroniza con Google Calendar y notifica por WhatsApp.

### Restricciones Demo
*   Los eventos mostrados son ficticios.
*   No se pueden crear nuevos eventos ni editar los existentes.
`,

    library: `
## Base de Conocimiento

Repositorio centralizado de documentos, modelos de escritos y jurisprudencia propia del estudio.

### Organización
1.  **Carpetas Inteligentes:** Clasificación automática por fuero o tipo de documento.
2.  **Búsqueda Semántica:** (En versión Full) Permite encontrar documentos por "concepto" y no solo por nombre.

### Interacción Demo
*   Navega por la estructura de carpetas de ejemplo.
*   Los archivos son visuales; no se puede descargar contenido real en este entorno protegido.
`
};
