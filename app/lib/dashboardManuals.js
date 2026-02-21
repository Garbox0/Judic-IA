export const dashboardManuals = {
    dashboard: `
## Gabinete de Control
Tu centro de mando jurídico inteligente. Desde aquí tienes una visión global y en tiempo real de tu estudio.

### Qué revisar al entrar
1.  **Métricas Clave:** Resumen de casos activos, nuevos prospectos y cumplimiento del cupo de consultas.
2.  **Agenda de Hoy:** Vencimientos críticos y audiencias programadas para las próximas 24 horas.
3.  **Actividad Reciente:** Feed de las últimas interacciones de tus clientes con la IA y cambios en expedientes.

### Flujo Recomendado
*   **Priorizar:** Revisa la sección de **"Plazos"** para resolver urgencias del día.
*   **Seguimiento:** Dirígete a **"Clientes"** para evaluar nuevas consultas captadas por el asistente virtual.
*   **Gestión:** Utiliza **"Expedientes"** para el trabajo diario en causas abiertas.

> [!TIP]
> Usa el botón **"+"** en la esquina inferior derecha para acciones rápidas como cargar un nuevo cliente o iniciar una investigación sin cambiar de sección.
`,

    research: `
## Terminal de Estrategia Jurídica
Motor de inteligencia artificial conectado a jurisprudencia actualizada y normativa vigente. Diseñado para reducir horas de investigación a segundos.

---

### Pestaña 1: Jurisprudencia

#### Paso a paso
1.  **Contexto:** Ingresá tu consulta en lenguaje natural (ej: "Responsabilidad de plataforma de delivery por accidente de repartidor en CABA").
2.  **Ámbito:** Seleccioná la jurisdicción (Nacional/Federal o Provincial) para filtrar precedentes relevantes.
3.  **Generación:** Ejecutá **"Generar Estrategia IA"** para obtener un análisis detallado.

#### Qué obtendrás
*   **Análisis Predictivo:** Viabilidad del caso basada en tendencias jurisprudenciales.
*   **Precedentes:** Listado de fallos concordantes con acceso directo a la fuente.
*   **Prueba Sugerida:** Listado técnico de elementos probatorios para el caso.
*   **Estrategia:** Recomendación de encuadre legal y pasos a seguir.

#### Tips para mejores resultados
*   Usá frases exactas entre comillas: "daño moral" accidente tránsito
*   Agregá "fallo" o "sentencia" al final para filtrar resultados judiciales
*   Combiná jurisdicción: "mala praxis médica cordoba camara"

---

### Pestaña 2: Antecedentes Judiciales de Empresa

Herramienta de **due diligence corporativo**: buscá causas, demandas y sentencias públicas vinculadas a una empresa antes de aceptar un caso.

#### Cómo usar
1.  **Razón Social:** Ingresá el nombre de la empresa (ej: "Carrefour", "YPF SA", "Techint").
2.  **CUIT (opcional):** Añadís el CUIT para cruzar información adicional.
3.  **Jurisdicción:** Filtrá por fuero Federal, CABA, PBA o buscá en todas.
4.  **Buscar expedientes:** La IA rastrea bases de datos públicas y extrae causas reales con carátula, tribunal, tipo y estado.

#### Qué obtendrás por cada causa encontrada
*   **Carátula:** Formato estándar "DEMANDANTE c/ EMPRESA s/ MATERIA"
*   **Expediente:** Número de causa si está disponible
*   **Tribunal:** Cámara o juzgado interviniente
*   **Tipo:** Laboral / Civil / Comercial / Penal / etc.
*   **Estado:** Activo / Archivado / Con sentencia

> [!TIP]
> Los resultados provienen de fuentes públicas indexadas. No reemplaza una consulta directa al sistema oficial del PJN o SCBA.
`,

    clients: `
## Centro de Captación (CRM)
Gestión inteligente de consultas entrantes. Aquí la IA actúa como tu primer filtro profesional.

### Gestión de Prospectos
1.  **Link Inteligente:** Comparte tu enlace único de consulta por WhatsApp o redes sociales.
2.  **Entrevista IA:** El asistente realiza la entrevista inicial, recolecta datos (DNI, CUIT, hechos) y genera un resumen.
3.  **Evaluación:** Revisa el chat completo y el pre-análisis para decidir si tomas el caso.

### Acciones Clave
*   **Convertir en Expediente:** Crea automáticamente la carpeta digital del caso moviendo toda la información recopilada.
*   **Crear Plazo:** Si la consulta implica un vencimiento inminente, agéndalo directamente desde aquí.
*   **Filtros de Estado:** Organiza tus contactos en "Prospectos", "Clientes Activos" o "Finalizados".
`,

    cases: `
## Gestión de Expedientes
El archivo digital centralizado de tu estudio. Organización absoluta para una litigación de alto nivel.

### Uso Diario
1.  **Organización:** Carpetas individuales con historial, documentos y estados procesales.
2.  **Identificación:**
    *   **Robot (IA):** Casos derivados automáticamente desde el portal de consultas.
    *   **Escudo:** Casos cargados manualmente por el profesional.
3.  **Estados:** Cambia entre *Abierto, En Curso, Cerrado o Archivado* para mantener limpia tu bandeja de trabajo.

### Recomendaciones
*   **Archivar:** No elimines casos terminados; archívalos para mantener el historial disponible en el buscador global del estudio.
*   **Buscador:** Encuentra cualquier expediente por nombre de cliente, carátula o número de causa.
`,

    caseDetails: `
## Detallado Operativo
Vista profunda y herramientas específicas para el avance de una causa particular.

### Secciones del Expediente
1.  **Información General:** Datos de la carátula, juzgado, contraparte y cliente.
2.  **Documentación:** Repositorio de archivos, fotos de pruebas y escritos vinculados.
3.  **Chat Original:** Acceso al diálogo inicial que el cliente tuvo con la IA (disponible en casos derivados).

### Acciones Principales
*   **Editar:** Actualiza radicación o radicación del expediente.
*   **Gestión de archivos:** Sube pruebas o escritos en PDF/JPG para tener acceso desde cualquier dispositivo.
*   **Ciclo de vida:** Archiva el caso al finalizar la etapa procesal para optimizar tu vista principal.
`,

    agenda: `
## Terminal de Plazos (Agenda)
Sistema de alerta temprana diseñado para que nunca pierdas un vencimiento fatal.

### Priorización y Control
1.  **Semaforización:**
    *   🔴 **Crítico:** Vence hoy o mañana (incluye plazo de gracia).
    *   🟡 **Próximo:** Vence en los próximos 3-7 días.
    *   🔵 **Pendiente:** Tareas programadas a largo plazo.
2.  **Filtros Temporales:** Visualiza solo lo que vence en las próximas 48h para máximo foco.
3.  **Solo Críticos:** Un interruptor de seguridad que oculta tareas menores para resaltar los plazos procesales.

### Gestión Judicial
*   **Calendario Visual:** Los días en rojo indican feriados judiciales o feria; la agenda los reconoce automáticamente al calcular plazos.
*   **Historial:** Revisa eventos completados para tener un registro de auditoría de tu desempeño procesal.
`,

    calculators: `
## Suite de Precisión Matemática
Herramientas técnicas adaptadas a la normativa argentina vigente (2026).

### 1. Liquidación por Despido (Art. 245 LCT)
*   **Cálculo Integral:** Antigüedad, preaviso, SAC y vacaciones no gozadas.
*   **Parámetros:** Ingresa remuneración, fecha de ingreso y egreso para obtener un desglose detallado listo para la demanda.

### 2. Calculadora de Plazos Procesales
*   **Computo Inteligente:** Ingresa la fecha de notificación y el tipo de plazo (días hábiles o corridos).
*   **Gracia:** El sistema determina automáticamente el vencimiento y las dos primeras horas (fueros nacionales).
*   **Sincronización:** Descuenta automáticamente feriados y periodos de feria judicial.
`,

    legislation: `
## Digesto Normativo
Acceso instantáneo a la ley escrita con herramientas de análisis moderno.

### Capacidades
*   **Códigos y Leyes:** Texto completo de Códigos de fondo y leyes especiales actualizadas.
*   **Procedimiento:** Códigos de forma organizados por jurisdicción nacional y provincial.
*   **Citas Académicas:** Copia el texto con formato de cita legal profesional con un solo clic.

### Cómo buscar
1.  Ingresa el tipo de norma y número (ej: Ley 24.522).
2.  O busca por palabras clave en el título o contenido.
`,

    library: `
## Base de Conocimiento (KM)
El repositorio de sabiduría de tu estudio. Capitaliza tu experiencia.

### Gestión del Saber
1.  **Investigaciones Guardadas:** Todas tus estrategias de IA se almacenan aquí para futura referencia.
2.  **Filtros:** Busca por autos, tema o jurisdicción.
3.  **Jurisprudencia Clave:** Organiza los fallos que consideres "leading cases" para usarlos en futuros escritos.

### Buenas Prácticas
*   Asigna títulos descriptivos a tus investigaciones para que el buscador semántico sea más efectivo al recuperar información meses después.
`,

    docGenerator: `
## Generador de Escritos
Crea borradores legales de alta calidad usando el contexto real de tus casos.

### Paso a paso
1.  **Configuración:** Elige el tipo de documento (Demanda, Cédula, Oficio, Contestación).
2.  **Contexto:** El generador toma automáticamente los hechos y pruebas del expediente seleccionado.
3.  **Refinado:** Edita el texto en el panel derecho para darle tu toque personal final.

### Salida Profesional
*   Copia el texto al portapapeles con formato limpio.
*   Imprime directamente o guarda el borrador para revisión posterior.
`,

    settings: `
## Configuración de Identidad
Gestiona tu presencia profesional, seguridad y facturación.

### Módulos de Ajuste
*   **Perfil:** Sube tu foto, define tus especialidades y activa tu firma digital escaneada.
*   **Seguridad:** Controla tu contraseña y monitorea las sesiones activas en otros dispositivos.
*   **Facturación:** Gestiona tu plan (Starter, Profesional o Elite), revisa métodos de pago y descarga tus comprobantes.

### Soporte Técnico
*   Encuentra canales directos de Email para soporte prioritario si eres usuario Pro o Elite.
`,

    federal: `
## Hub Federal e Interjurisdiccional
Tu puente para litigar en todo el país sin fronteras técnicas.

### Componentes Clave
1.  **Red de Corresponsales:** Encontrá colegas verificados en otras provincias para diligenciar trámites locales.
2.  **Directorio Organismos:** Información de contacto y guías específicas para cada cabecera judicial.

### Cómo ser Corresponsal
Para aparecer en las búsquedas y colaborar con otros colegas, activa la opción **"Disponibilidad para Corresponsalía"** en tus Ajustes de Perfil Profesional.
`
};
