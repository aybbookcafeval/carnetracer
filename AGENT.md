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

### PRODUCCIÓN PASTELERÍA

DULCE - BROWNIE DUBAI: 150g
DULCE - TORTA TRIPLE CHOCOLATE: 244g
DULCE - PONQUÉ GLASEADO NARANJA: 120g
DULCE - PASTEL CHOCOLATE CROCANTE: 190g
DULCE TORTA VASCA: 275g
DULCE BROOKIES: (Sin gramaje especificado)
DULCE - CINNAMON ROLL: 125g
DULCE - GALLETAS CHISPAS: 100g
DULCE ZANAHORIA GLAS: 200g
DULCE - CHEESECAKE FRESA: 280g
DULCE - TORTA MARMOLEADA CON NUT: 168g
DULCE - TRES LECHES: 333g
DULCE PASTA SECA: 220g
PS TIRAMISU SALUDABLE A&B: 340g
DULCE - TORTA RED VELVET: 220g
PS GALLETA CHIPS REMOLACHA A&B: 71g
DULCE - PIE DE LIMON: 260g
PS PINGUINO: 60g
DULCE - CHEESECAKE DE MANZANA: 333g
PS - BROOKIES FIT A&B: 150g
DULCE - CHEESECAKE DE PISTACHO: 333g
PS GALLETA CHIPS OSCURO A&B: 71g
DULCE CHEESECAKE DUBAI: 333g
PS BROWNIE SALUDABLE: 90g
DULCE - CHEESECAKE OREO CHOCO: 350g
PS TORTA MARMOLEADA FIT A&B: 140g
DULCE - CHEESECAKE OREO VAINILLA: 350g
PS HELADO YOGURT SIN AZUCAR PLAIN: (Sin gramaje especificado)
DULCE - TIRAMISU: 340g
PS GALLETA CHIPS PISTACHO SECOS A&B: 70g
DULCE - BROWNIE: 250g
PS TORTA ZANAHORIA FIT A&B: 168g
PS TORTA NARANJA S FIT A&B: 135g
PANADERIA - CACHITO JAM PAISA: 100g
PANADERIA CACHITO JAM Q-CREM: 100g
CROISSANT: 120g
PANADERIA - CACHITO: 100g
PAN ARABE - 3 unid: 210g
PAN ARABE - Grande: 140g
PAN DELI-SANDWICH (DELI): 170g
PAN DELI-SANDWICH (SANDWICH): 1.100g
PAN DE BRUSCHETA: 500g
PAN DE BRUSCHETA (CANILLA): 300g
PAN DE BRIOCHE: 130g
BAGEL: 120g
MASA DE PIZZA: 380g
pasata seca lata