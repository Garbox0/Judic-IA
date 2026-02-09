# 🎯 Sistema de Mejora de Búsquedas Jurídicas

## Resumen del Problema Resuelto

**Antes:** La Terminal de Estrategia dependía mucho de la habilidad del usuario para formular búsquedas legales. Un abogado novel que buscaba "despido" obtenía resultados mucho peores que uno que buscaba "despido sin causa art 245 LCT indemnización agravada".

**Ahora:** Sistema inteligente de 3 capas que detecta búsquedas genéricas, las mejora automáticamente, y ofrece alternativas si los resultados son pobres.

---

## 🏗️ Arquitectura del Sistema

### **Capa 1: Pre-Flight Check (Análisis previo)**
Antes de ejecutar la búsqueda, el sistema analiza la calidad de la query usando:

- **Patrones positivos**: Artículos de ley, formato de autos (c/ ... s/), terminología legal
- **Red flags**: Búsquedas demasiado cortas, genéricas, o estilo ChatGPT ("cómo hacer...", "ayúdame con...")
- **Scoring**: 0-100 puntos que determinan si la búsqueda necesita mejora

**Archivo**: `lib/queryEnhancer.js` → función `analyzeQueryQuality()`

### **Capa 2: Enhancement Automático (Mejora con IA)**
Si la query tiene score < 60 y el usuario está en Modo Asistido:

1. Envía la query a GPT-4o-mini con un prompt especializado
2. La IA agrega contexto legal sin cambiar el tema de búsqueda
3. Valida que la mejora no se desvíe demasiado del original (preservation ratio > 30%)
4. Muestra un modal comparando ambas versiones

**Ejemplos de mejoras**:
- ❌ "despido" → ✅ "despido sin causa art 245 LCT indemnización"
- ❌ "divorcio con hijos" → ✅ "divorcio vincular hijos menores cuota alimentaria"
- ❌ "medianeria casa" → ✅ "medianería muro divisorio art 2006 CCCN cerramiento"

**Archivos**:
- `lib/queryEnhancer.js` → función `enhanceQuery()`
- `app/api/research/enhance/route.js` → API endpoint

### **Capa 3: Post-Search Feedback (Reformulación)**
Después de ejecutar la búsqueda, si los resultados son pobres (score promedio < 50):

1. Espera 2 segundos para que el usuario vea los resultados iniciales
2. Genera 3 búsquedas alternativas con diferentes estrategias:
   - Versión con sinónimos legales
   - Versión más específica (con artículos/leyes)
   - Versión más amplia (rama del derecho + concepto general)
3. Muestra modal con opciones de reformulación

**Archivos**:
- `lib/queryEnhancer.js` → función `generateAlternatives()`
- `app/api/research/alternatives/route.js` → API endpoint

---

## 🎛️ Modo Experto vs Asistido

### **Modo Asistido (Predeterminado)**
- ✅ Análisis de calidad de query
- ✅ Sugerencias de mejora automáticas
- ✅ Modal de reformulación si resultados son pobres
- 👍 Ideal para: Abogados noveles, búsquedas exploratorias

### **Modo Experto**
- ⚡ Búsqueda directa sin intervención
- 🚫 Sin análisis pre-búsqueda
- 🚫 Sin sugerencias de mejora
- 👍 Ideal para: Abogados senior, búsquedas muy específicas

**Toggle ubicado en**: Header del módulo, al lado del logo

---

## 📁 Archivos Modificados/Creados

### Nuevos Archivos
```
lib/queryEnhancer.js                      # Cerebro del sistema
app/api/research/enhance/route.js         # API de mejora de queries
app/api/research/alternatives/route.js    # API de alternativas
```

### Archivos Modificados
```
app/dashboard/research/ResearchContent.js # Integración UI + lógica
app/dashboard/research/research.css       # Estilos de modales
```

---

## 🎨 Componentes de UI

### 1. **Toggle de Modo** (Header)
```jsx
<button className="mode-toggle assisted|expert">
  {assistedMode ? <Sparkles> Asistido : <Zap> Experto}
</button>
```

### 2. **Modal de Enhancement** (Pre-búsqueda)
Muestra:
- Badge de calidad (score + nivel)
- Lista de problemas detectados
- Comparación lado a lado (original vs mejorada)
- Lista de mejoras aplicadas
- Botones: "Usar mejorada" | "Usar original"

### 3. **Modal de Reformulación** (Post-búsqueda)
Muestra:
- Mensaje de resultados limitados + score promedio
- 3 opciones de búsqueda alternativa con explicación
- Botón: "Mantener resultados actuales"

---

## 🔧 Configuración Requerida

### Variables de Entorno (Ya configuradas)
```bash
OPENROUTER_API_KEY=<tu_key>  # Para GPT-4o-mini
```

### Dependencias (Ya instaladas)
- `openai` SDK (usado en queryEnhancer.js)
- Lucide React icons: `Sparkles`, `AlertCircle`, `TrendingUp`

---

## 📊 Métricas de Calidad

### Scoring de Queries
- **80-100**: EXCELLENT → Búsqueda lista para producción
- **60-79**: GOOD → Aceptable, sin mejoras necesarias
- **40-59**: ACCEPTABLE → Puede mejorar, pero funcional
- **0-39**: POOR → Requiere mejora urgente

### Scoring de Resultados
- **70+ avg**: Excelente, no se ofrecen alternativas
- **50-69 avg**: Aceptable, alternativas opcionales
- **<50 avg**: Pobres, se muestran alternativas automáticamente

---

## 🧪 Casos de Prueba

### Caso 1: Búsqueda genérica (debería mejorar)
```
Input: "despido"
Modo: Asistido
Esperado: Modal de enhancement con "despido sin causa art 245 LCT indemnización"
```

### Caso 2: Búsqueda bien formulada (no debería intervenir)
```
Input: "despido discriminatorio embarazo art 178 LCT estabilidad laboral"
Modo: Asistido
Esperado: Búsqueda directa sin modal
```

### Caso 3: Modo experto (nunca interviene)
```
Input: "despido"
Modo: Experto
Esperado: Búsqueda directa sin análisis
```

### Caso 4: Resultados pobres (post-búsqueda)
```
Input: Query con resultados score < 50
Modo: Asistido
Esperado: Modal de reformulación después de 2 segundos
```

---

## 🚀 Próximas Mejoras Posibles

1. **Autocompletado inteligente**: Sugerencias mientras el usuario escribe
2. **Templates por rama**: Formularios específicos (Laboral, Civil, Penal)
3. **Historial de mejoras**: Guardar qué mejoras aceptó/rechazó el usuario para aprender
4. **Score feedback loop**: Que el usuario pueda calificar resultados para mejorar el algoritmo
5. **Detección de jurisdicción**: Auto-detectar si la query menciona una provincia específica

---

## 📝 Notas de Implementación

### Prevención de Hallucinations
- ✅ Preservation ratio: La mejora debe mantener >30% de palabras originales
- ✅ Confianza mínima: Solo se muestra enhancement si confidence >= 50%
- ✅ Fallback: Si la API falla, usa la query original sin bloquear

### Performance
- ⚡ Enhancement es async, no bloquea UI
- ⚡ Reformulation se muestra 2s después de resultados (no intrusivo)
- ⚡ Cache: Podría agregarse cache de enhancements para queries repetidas

### UX Considerations
- 🎯 Modo Asistido por defecto (mejor experiencia para mayoría)
- 🎯 Toggle visible pero no intrusivo
- 🎯 Modales permiten rechazar sugerencias (usuario tiene control)
- 🎯 Reformulation es opcional, no fuerza cambios

---

## 🐛 Troubleshooting

**Problema**: Modal de enhancement no aparece
- Verificar que `assistedMode` esté en `true`
- Verificar que la query tenga score < 60
- Verificar logs de console para errores de API

**Problema**: Enhancement retorna query idéntica
- Verificar que OPENROUTER_API_KEY esté configurada
- Verificar que GPT-4o-mini esté respondiendo (ver logs backend)

**Problema**: Reformulation no aparece tras resultados pobres
- Verificar que avgScore < 50
- Verificar que estés en Modo Asistido
- Verificar que haya pasado >2 segundos desde resultados

---

**Autor**: Claude Sonnet 4.5
**Fecha**: 2026-02-08
**Versión**: 1.0
