# CarneTracer - Meat Traceability & AI Analysis 🥩

Sistema profesional de trazabilidad, control de mermas y gestión de producción para la industria cárnica, potenciado por Inteligencia Artificial via **OpenRouter** y persistencia en tiempo real con **Supabase**.

## 🚀 Características Principales

### 1. Centro de Producción Inteligente (IA)
*   **Escaneo de Hojas**: Permite tomar una foto de la lista de producción y la IA extrae automáticamente los nombres, cantidades y unidades.
*   **Cola de Registro**: Los items detectados se cargan en una lista "Pendiente de Guardado" para que el usuario pueda editar, eliminar o agregar items manualmente antes de enviarlos a la base de datos de forma masiva.

### 2. Auditoría y Trazabilidad de Pesos (Vision AI)
*   **Validación de Báscula**: Analiza fotos de pesajes para detectar el peso mostrado en el visor y compararlo con el ingreso manual.
*   **Detección de Discrepancias**: Alerta si el peso ingresado no coincide con la evidencia visual.
*   **Ciclo de Vida**: Seguimiento completo desde Congelado → Descongelado → Producido (Porcionado).

### 3. Gestión de Almacén y Transferencias
*   **Módulo de Transferencias**: Registro de movimientos de piezas entre diferentes almacenes o bodegas.
*   **Control de Mermas**: Cálculo automático de merma por descongelado (Max 8%) y merma total (Max 22%).
*   **Rendimiento Neto**: Monitoreo de eficiencia en el proceso de limpieza y porcionado.

### 4. Dashboard y Reportes
*   **Métricas en Tiempo Real**: Visualización de rendimiento promedio y alertas críticas por tipo de corte.
*   **Reportes PDF**: Generación de documentos listos para impresión con historial detallado y filtros aplicados.

## 🛠️ Tecnologías

*   **Frontend**: React 19 + TypeScript + Vite.
*   **Styling**: Tailwind CSS 4 + Lucide React (Iconografía).
*   **Backend & DB**: Supabase (PostgreSQL, Authentication & Bucket Storage).
*   **IA (Vision)**: OpenRouter API (Usando modelos como Gemini 2.0 Flash Lite para velocidad y precisión).
*   **Animaciones**: Motion (framer-motion).

## ⚙️ Configuración (Environment Variables)

Para que el sistema funcione correctamente, se requieren las siguientes variables en un archivo `.env`:

```env
VITE_SUPABASE_URL=tu_url_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_OPENROUTER_API_KEY=tu_openrouter_api_key
```

## 📋 Flujo de Trabajo

1.  **Registro de Pieza**: Se crea una pieza nueva recibida de proveedor.
2.  **Pesajes Críticos**: Se realizan los pesajes en cada etapa (Congelado, Descongelado, Producido) con captura de foto obligatoria.
3.  **Auditoría**: El sistema resalta en rojo las piezas con mermas fuera de rango o validación de IA fallida.
4.  **Batch Scanning**: Para preparaciones masivas, se usa el "Centro de Producción" para escanear hojas de trabajo diarias.

---
*Optimizado para A&B Bookcafe Val - Eficiencia y control total en cocina.*
