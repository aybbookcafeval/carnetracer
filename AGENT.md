# Developer & Agent Log (AGENT.md) 🤖

## Proyecto: CarneTracer - Traceability System

### Estado Actual: MVP Funcional
El sistema ha migrado de una persistencia local (LocalStorage) a una infraestructura en la nube (**Supabase**) y un motor de IA multimodal (**OpenRouter**).

### Arquitectura Técnica
- **Frontend Core**: React 19 (Vite) con TypeScript.
- **Backend-as-a-Service**: Supabase.
  - **Auth**: Gestión de sesiones de usuario.
  - **Database**: PostgreSQL para trazabilidad de piezas, registros de peso, transferencias y producción.
  - **Storage**: Cubeta (`meat-images`) para evidencias fotográficas de pesajes.
- **Vision AI**: Integración con OpenRouter usando el modelo `google/gemini-2.0-flash-lite-001`.
  - Procesa fotos de básculas para validar pesos manuales.
  - Procesa fotos de hojas de producción para extracción de datos (OCR inteligente).

### Módulos Implementados
1.  **Dashboard**: Filtros de fecha, tipo de pieza y estado. Cálculo dinámico de KPI (Mermas, Rendimiento).
2.  **Transferencias**: Movimientos entre almacenes (Bodega, Línea, etc.).
3.  **Producción (Batch Processing)**:
    - Escáner de IA para listas de productos.
    - Lista unificada de items pendientes con soporte para edición/eliminación previa a la persistencia.
4.  **Auditoría**: Agrupación cronológica de registros por pieza.

### Decisiones de Diseño Recientes
- **Producción Directa vs. Review**: Se implementó una lista "Pendiente de Guardado" en `ProduccionView` para permitir al usuario corregir errores de lectura de la IA antes de afectar la base de datos.
- **Validación IA de Pesos**: No bloquea el registro en caso de falla técnica o discrepancia leve, pero marca el registro con una alerta para supervisión.

### Siguientes Pasos Pendientes
- Implementar roles de usuario granulares (Admin vs. Staff) en las RLS de Supabase.
- Añadir exportación de reportes a Excel (CSV).
- Optimización de carga de imágenes (Compresión en cliente antes del upload).
