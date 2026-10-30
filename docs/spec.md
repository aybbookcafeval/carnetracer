# CarneTracer — Especificación funcional y técnica

> Documento de referencia para desarrollo guiado por especificación (SDD).
> Última actualización: 2026-10-30
> Proyecto: CarneTracer — Meat Traceability System (A&B Bookcafe Val)
> Alcance: aplicación web completa (frontend SPA + Supabase + IA vía OpenRouter)

---

## 1. Objetivo

CarneTracer registra y audita el ciclo de vida del producto cárnico:

1. Recepción de una pieza cruda.
2. Pesaje en congelado.
3. Pesaje en descongelado.
4. Pesaje producido/porcionado.
5. Carga del resultado en el sistema.
6. Auditoría de mermas, rendimiento y evidencias fotográficas.

Además gestiona transferencias entre almacenes y producción masiva de preparados.

El sistema debe garantizar trazabilidad por pieza, evidencia fotográfica por pesaje,
validación asistida por IA y visibilidad de desviaciones operativas.

### Fuera de alcance (estado actual)

- Facturación, compras, proveedores y costos.
- App móvil nativa (la SPA es responsive).
- Edición de recetas, materias primas o perfiles desde la UI.
- RLS granular implementada en el repositorio (ver §12).

---

## 2. Glosario

| Término | Significado |
|---|---|
| Pieza | Unidad física de carne identificada por `P-<timestamp>` (ej. `P-1761...`). |
| Registro de peso | Evento de pesaje asociado a una pieza (`registros_peso`). |
| Etapa | Uno de los eventos: congelado, descongelado o producido. |
| Merma descongelado | Pérdida porcentual entre peso congelado y descongelado. |
| Merma total | Pérdida porcentual entre peso congelado y producido. |
| Rendimiento | Porcentaje de producto final respecto al peso descongelado. |
| Alerta | Pieza con merma o rendimiento fuera de umbral y no auditada. |
| Almacén | Ubicación configurable (`almacenes`). Sustituye el enum histórico `Sede`. |
| Preparado | Producto de producción masiva (`produccion`). |
| Transferencia | Movimiento de productos entre almacenes (`transferencias`). |
| Evidencia | Foto de báscula o de merma asociada a un pesaje. |

---

## 3. Roles y permisos

Los roles del frontend son `RolUsuario` (`src/types.ts`):

| Rol | Dashboard | Transferencias | Producción | Auditoría | Ajustes | Acciones administrativas |
|---|---|---|---|---|---|---|
| `COCINA` | Sí (sin KPIs ni alertas) | Sí | Sí | No | No | No |
| `ANALISTA` | Sí | Sí | Sí | Sí | No | No |
| `ADMIN` | Sí | Sí | Sí | Sí | Sí | Sí |

Origen del rol: `perfiles.rol` (`rol_usuario_db`). `fetchProfile` mapea
`admin` → `ADMIN`; cualquier otro valor → `COCINA`
(`src/services/supabaseService.ts`). `ANALISTA` existe en tipos pero hoy no se
asigna desde `fetchProfile`.

Acciones restringidas a `ADMIN`:

- Editar etapa (`handleEditStage`).
- Eliminar etapa (`handleDeleteStage`).
- Revertir “Cargado en Sistema” (`handleRevertLoaded`).
- Eliminar pieza completa (`handleDeletePiece`).
- Gestionar cortes y almacenes (`SettingsView`).

La autenticación es obligatoria: sin sesión se muestra `LoginView`.

---

## 4. Arquitectura

### 4.1 Stack

| Capa | Tecnología |
|---|---|
| UI | React 19, TypeScript 5.8, Vite 6 |
| Estilos | Tailwind CSS 4, `motion`, `lucide-react` |
| Estado | `useState`/`useMemo` locales; sin store global |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| IA | OpenRouter Chat Completions (modelos Gemini con visión) |
| Utilidades | `date-fns`, `clsx`, `tailwind-merge` |

### 4.2 Estructura

```text
src/
  App.tsx                         # Shell, auth, dashboard, piezas, auditoría, ajustes
  main.tsx                        # ErrorBoundary + render
  types.ts                        # Enums, interfaces, umbrales, mapas de estado
  components/
    CameraCapture.tsx             # Captura de cámara / archivo y compresión
    ProduccionView.tsx            # Producción masiva + OCR IA + CSV
    TransferenciasView.tsx        # Transferencias + OCR IA + CSV
  services/
    openrouterService.ts          # Visión IA: validar peso, extraer productos, analizar
    supabaseService.ts            # Acceso a datos + mapeos DB ↔ frontend
  lib/
    supabase.ts                   # Cliente singleton desde variables Vite
    utils.ts                      # cn, normalización, similitud Levenshtein
    csv.ts                        # Exportación CSV UTF-8 con BOM
docs/
  camera_capture.md               # Especificación de captura
  spec.md                         # Este documento
supabase/migrations/              # Migraciones SQL versionadas
```

### 4.3 Configuración

Variables de entorno requeridas (`.env`, nunca versionado):

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_OPENROUTER_API_KEY=...
# Opcional:
VITE_OPENROUTER_VISION_MODEL=google/gemini-2.5-flash
```

Comandos:

```bash
npm run dev      # Vite en :3000
npm run build    # Build de producción
npm run lint     # tsc --noEmit
```

### 4.4 Auth y sesión

- `supabase.auth.getSession()` al montar.
- `onAuthStateChange` escucha cambios; `TOKEN_REFRESHED` actualiza la sesión pero
  **no** cambia `authUserId` ni recarga datos.
- `authUserId` (string estable) es la dependencia del `useEffect` que carga datos.
- `loadUserProfile` obtiene el perfil y el rol.
- Logout: `supabase.auth.signOut()`.

### 4.5 Storage

- Bucket usado por el código: **`evidencias`** (no `meat-images`; `AGENT.md` está desactualizado).
- `uploadImage` sube JPEG y devuelve URL pública. Si falla el upload, devuelve el
  base64 como respaldo para no perder la evidencia.
- Los registros históricos pueden contener base64 de ~1 MB en `foto_url` y
  `foto_merma_url`.

---

## 5. Modelo de datos

### 5.1 Tablas (esquema `public`)

#### `piezas`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | Generado en cliente: `P-<Date.now()>` |
| `tipo` | text NOT NULL | FK → `config_cortes.nombre` (`piezas_tipo_fkey`) |
| `estado` | `estado_pieza` NOT NULL | Default `CREADA` |
| `peso_congelado` | numeric | kg |
| `peso_descongelado` | numeric | kg |
| `peso_producido` | numeric | kg |
| `merma_descongelado` | numeric | % |
| `merma_total` | numeric | % |
| `merma` | numeric | % histórico/general |
| `rendimiento` | numeric | % |
| `porciones` | jsonb | `Porcion[] = {pesoGramos, cantidad}[]` |
| `foto_merma_url` | text | Evidencia de merma de la última etapa aplicable |
| `auditado` | boolean | Default `false` |
| `comentario_auditoria` | text | |
| `analisis_ia` | text | Diagnóstico de trazabilidad generado por IA |
| `created_at` / `updated_at` | timestamptz | |

#### `registros_peso`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | Generado por Supabase |
| `pieza_id` | text NOT NULL | FK → `piezas.id` |
| `tipo_evento` | `tipo_evento_peso` NOT NULL | |
| `peso` | numeric NOT NULL | kg |
| `foto_url` | text | URL o base64 |
| `foto_merma_url` | text | URL o base64 |
| `usuario_nombre` | text NOT NULL | |
| `validado_ia` | boolean | Default `false` |
| `ia_detected_weight` | numeric | Peso detectado por visión |
| `ia_reason` | text | Explicación de la IA |
| `suma_porciones` / `diferencia_kg` | numeric | Reservados (hoy no se escriben desde la app) |
| `analisis_ia` | text | Reservado |
| `fecha` | timestamptz | Default `now()` |

#### `config_cortes`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `nombre` | text UNIQUE NOT NULL | También es FK lógica desde `piezas.tipo` |
| `merma_descongelado_max` | numeric NOT NULL | Default 8 (%) |
| `merma_total_max` | numeric NOT NULL | Default 22 (%) |
| `created_at` | timestamptz | |

#### `almacenes`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `nombre` | text UNIQUE NOT NULL | Usado como origen/destino en transferencias y producción |

#### `produccion`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | `PROD-<timestamp>-<random>` |
| `nombre_preparado` | text NOT NULL | |
| `cantidad` | numeric NOT NULL | |
| `unidad` | text NOT NULL | `kg`, `g`, `unidades`, `lts`, `potes`, `paquetes` |
| `fecha` | timestamptz NOT NULL | |
| `encargado` | text NOT NULL | |
| `status` | boolean | `false` = pendiente; `true` = completado |
| `almacen_descuento` | text NOT NULL | Default `ALMACEN_PRINCIPAL` |
| `almacen_incremento` | text NOT NULL | Default `ALMACEN_PRINCIPAL` |

#### `transferencias`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | `TR-<timestamp>` |
| `sede_origen` | text NOT NULL | Nombre de almacén |
| `sede_destino` | text NOT NULL | Nombre de almacén |
| `productos` | jsonb NOT NULL | `ProductoTransferencia[]` |
| `foto_url` | text | Evidencia opcional |
| `usuario` | text NOT NULL | Nombre manual del responsable |
| `fecha` | timestamptz NOT NULL | |
| `status` | boolean | `false` = pendiente; `true` = completado |

#### `recetas`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `uuid_generate_v4()` |
| `nombre` | text UNIQUE NOT NULL | Autocompletado en Producción |
| `created_at` | timestamptz | |

#### `materia_prima`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `nombre` | text UNIQUE NOT NULL | Autocompletado en Transferencias |
| `unidad_base` | text NOT NULL | Default `unidades` |
| `created_at` / `updated_at` | timestamptz | |

#### `perfiles`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | FK → `auth.users.id` |
| `email` | text NOT NULL | |
| `nombre_completo` | text | |
| `rol` | `rol_usuario_db` | Default `user`; `admin` tiene privilegios |
| `updated_at` | timestamptz | |

#### `document_chunks`

Tabla de soporte RAG (documentos + `embedding`). No se usa actualmente desde la SPA.

### 5.2 Enums

| Enum DB | Valores | Uso |
|---|---|---|
| `estado_pieza` | `CREADA`, `DESCONGELANDO`, `PROCESANDO`, `FINALIZADA`, `CARGADO_EN_SISTEMA` | `piezas.estado` |
| `tipo_evento_peso` | `PESO_CONGELADO`, `PESO_DESCONGELADO`, `PESO_PRODUCIDO` | `registros_peso.tipo_evento` |
| `rol_usuario_db` | Default `user`; el código otorga privilegios a `admin` y trata cualquier otro valor como usuario estándar | `perfiles.rol` |

### 5.3 Mapeo frontend ↔ base de datos

El frontend usa nombres de dominio en español y la DB usa nombres técnicos.
Los mapeos viven en `src/services/supabaseService.ts` y **no deben duplicarse**.

Estados (`mapDbEstadoToFrontend` / `mapFrontendEstadoToDb`):

| Frontend `EstadoPieza` | DB `estado_pieza` |
|---|---|
| `CREADA` | `CREADA` |
| `CONGELADA` | `DESCONGELANDO` |
| `DESCONGELADA` | `PROCESANDO` |
| `PRODUCIDA` | `FINALIZADA` |
| `CARGADO_EN_SISTEMA` (`"CARGADO EN SISTEMA"`) | `CARGADO_EN_SISTEMA` |

Eventos (`mapDbEventoToFrontend` / `mapFrontendEventoToDb`):

| Frontend `TipoEvento` | DB `tipo_evento_peso` |
|---|---|
| `CONGELADO` | `PESO_CONGELADO` |
| `DESCONGELADO` | `PESO_DESCONGELADO` |
| `PRODUCIDO` | `PESO_PRODUCIDO` |
| `CARGADO` | No persistido como registro de peso; solo cambia estado |

> `TipoEvento.CARGADO` existe en el frontend para la máquina de estados, pero
> `registros_peso` no tiene evento de carga. “Marcar como Cargado” solo actualiza
> `piezas.estado`.

### 5.4 Relaciones

```text
config_cortes.nombre 1 ─── N piezas.tipo
piezas.id            1 ─── N registros_peso.pieza_id   (ON DELETE manual en app)
auth.users.id        1 ─── 1 perfiles.id
almacenes.nombre     ────── (referencia lógica, sin FK) ──> produccion / transferencias
recetas.nombre       ────── (autocompletado; no altera historial)
materia_prima.nombre ────── (autocompletado; no altera historial)
```

`deletePieza` elimina primero los registros y luego la pieza. No se debe borrar
un `config_corte` mientras existan piezas de ese tipo (la FK lo impide).

---

## 6. Máquina de estados

### 6.1 Flujo nominal

```text
CREADA
  └─ registrar CONGELADO ──> CONGELADA
       └─ registrar DESCONGELADO ──> DESCONGELADA
            └─ registrar PRODUCIDO ──> PRODUCIDA
                 └─ marcar cargado ──> CARGADO_EN_SISTEMA
```

`NEXT_STATE` y `EVENT_FOR_STATE` en `src/types.ts` definen las transiciones.
`registerWeight` solo avanza al siguiente estado; no permite saltos ni retrocesos.

### 6.2 Reglas de transición

- Solo se registra peso cuando existe `NEXT_STATE[estadoActual]`.
- El evento se deriva del estado destino (`EVENT_FOR_STATE`), nunca lo elige el usuario.
- `CARGADO_EN_SISTEMA` es terminal para el flujo normal.
- `markAsLoaded` solo actúa si el estado actual es `PRODUCIDA`.
- `handleRevertLoaded` (solo admin) devuelve a `PRODUCIDA`.
- Editar o eliminar una etapa recalcula el estado desde los registros restantes.
- Una pieza `CARGADO_EN_SISTEMA` se mantiene en ese estado al recalcular si aún
  existe un registro `PRODUCIDO`; si se elimina el registro producido, retrocede.

### 6.3 Recalculo (`recalculatePieceState`)

- Pesos = pesos de los registros existentes (0 si no existe el evento).
- Mermas y rendimiento se recalculan con las fórmulas de §7.
- Estado resultante, en orden de prioridad:
  1. `CARGADO_EN_SISTEMA` si ya lo estaba y existe registro producido.
  2. `PRODUCIDA` si existe registro producido.
  3. `DESCONGELADA` si existe registro descongelado.
  4. `CONGELADA` si existe registro congelado.
  5. `CREADA` en caso contrario.
- `porciones` se conserva solo si existe registro producido.
- `fotoMerma` = foto de merma del producido, o del descongelado, o `undefined`.

---

## 7. Cálculos y reglas de negocio

### 7.1 Fórmulas

```text
mermaDescongelado % = ((pesoCongelado - pesoDescongelado) / pesoCongelado) * 100
mermaTotal %        = ((pesoCongelado - pesoProducido)     / pesoCongelado) * 100
rendimiento %       = (pesoProducido / pesoDescongelado) * 100
merma (legacy) %    = ((pesoCongelado - pesoActual) / pesoCongelado) * 100
                      pesoActual = producido > 0 ? producido
                                 : descongelado > 0 ? descongelado
                                 : congelado
```

Cada fórmula solo se aplica si los denominadores son > 0; de lo contrario el
resultado es 0.

### 7.2 Tolerancia de empaque

Si `pesoActual > pesoCongelado` pero la diferencia es ≤ 5% del peso congelado,
la merma se registra como `0` (tolerancia por empaque). Si supera 5%, la merma
resulta negativa y se muestra tal cual.

### 7.3 Umbrales y alertas

Umbrales por corte (`config_cortes`):

- `mermaDescongeladoMax` (default 8%).
- `mermaTotalMax` (default 22%).

Umbral global (`GLOBAL_THRESHOLDS.RENDIMIENTO_MIN`): 70%.

Una pieza genera alerta si **no está auditada** y cumple al menos una condición:

- `mermaDescongelado > mermaDescongeladoMax`.
- `mermaTotal > mermaTotalMax`.
- `rendimiento > 0 && rendimiento < 70`.

La configuración ausente usa defaults 8/22.

### 7.4 Reglas físicas (manual de operaciones)

- Peso descongelado no debería superar el congelado.
- Peso producido no debería superar el descongelado.
- La app **no bloquea** estos casos; los expone vía merma/rendimiento y alertas.

### 7.5 Porciones

- Solo aplican a la etapa producida.
- `sumaPorcionesKg = Σ(pesoGramos × cantidad) / 1000`.
- Se usan en el análisis IA de trazabilidad, no en los KPI del dashboard.
- La UI permite agregar/eliminar porciones al registrar o editar la etapa producida.

---

## 8. Flujos funcionales

### 8.1 Carga inicial y sincronización

`App.tsx` (`loadData`):

- Depende de `authUserId`.
- `Promise.allSettled` para `fetchPiezas`, `fetchRegistros`, `fetchConfigCortes`.
- Un fallo parcial no vacía las demás colecciones.
- Mientras carga, se muestra “Sincronizando con Supabase...”.

**Rendimiento obligatorio:** `fetchRegistros` nunca debe seleccionar
`foto_url`/`foto_merma_url` en la carga masiva. Las fotos se cargan por demanda:

- `fetchFotosPorPieza(piezaId)` para el detalle de una pieza.
- `fetchFotoRegistro(registroId)` para miniaturas de auditoría.
- `getTransferenciaFoto(id)` para el detalle de una transferencia.

### 8.2 Crear pieza

1. Botón “Nueva Pieza” en Dashboard.
2. Seleccionar tipo desde `configCortes` (`AddPieceForm`).
3. Se crea con estado `CREADA`, pesos y métricas en 0.
4. `id = P-<Date.now()>`.

**Aceptación:** la pieza aparece en “Piezas en Proceso” y persiste tras recargar.

### 8.3 Registrar peso

`registerWeight` (`src/App.tsx:486`):

1. Validar que exista siguiente estado/evento.
2. Ejecutar `validateWeightWithAI(foto, peso)`.
3. Si la IA marca discrepancia, mostrar advertencia y **permitir** el registro.
4. Si la IA falla técnicamente, permitir el registro con `iaReason` de error.
5. Calcular métricas (`calculateMetrics`).
6. Subir foto principal y foto de merma (si existe) a Storage.
7. Crear `registro_peso` y actualizar `pieza` en paralelo.
8. Actualizar estado local y cerrar modal.
9. Si el evento es `PRODUCIDO`, generar `analyzeTraceability` y guardar
   `piezas.analisis_ia`; un fallo de IA no revierte el pesaje.

**Aceptación:** el registro aparece en auditoría, la pieza avanza de estado y la
foto se puede ver en el detalle sin bloquear la carga del dashboard.

### 8.4 Marcar como cargado

`markAsLoaded` (`src/App.tsx:593`):

1. Solo si `estado === PRODUCIDA`.
2. Confirmación del usuario.
3. Actualizar `estado` a `CARGADO_EN_SISTEMA` y `updated_at`.
4. El botón desaparece (“PROCESO COMPLETADO”).

**Aceptación:** tras recargar, la pieza sigue en `CARGADO_EN_SISTEMA` y no vuelve
a mostrar “Marcar como Cargado”.

### 8.5 Revertir carga

`handleRevertLoaded` (solo admin): `CARGADO_EN_SISTEMA` → `PRODUCIDA`.
Disponible desde el detalle de la pieza.

### 8.6 Editar / eliminar etapa

Solo admin, desde `PieceDetails`:

- Editar: actualiza peso y fecha del registro; si es producido, actualiza porciones.
  Luego recalcula la pieza completa.
- Eliminar: elimina el registro y recalcula pesos, mermas, rendimiento y estado.

### 8.7 Auditar alerta

- El botón “Auditada” abre un modal con comentario.
- Guarda `auditado = true` y `comentario_auditoria`.
- La pieza deja de aparecer en alertas.
- En la pestaña Auditoría se puede filtrar “Solo auditadas”.

### 8.8 Reporte imprimible

`generateReport` abre una ventana nueva con HTML imprimible:

- Encabezado, fecha y filtros aplicados.
- Tabla de piezas filtradas con pesos, merma total, rendimiento y estado.
- Dispara `window.print()`.

> El README menciona “Reportes PDF”; la implementación actual es impresión HTML
> del navegador (el usuario puede guardar como PDF).

### 8.9 Transferencias

`TransferenciasView`:

1. Cargar transferencias, materias primas y almacenes.
2. Crear nueva: origen, destino, usuario responsable obligatorio y productos.
3. Captura opcional: `extractProductsFromImage` extrae productos; se intenta
   emparejar con `materia_prima` usando `similarity >= 0.65` y se adopta su
   `unidad_base`.
4. Edición manual de nombre, cantidad y unidad; autocompletado de materias primas.
5. Validaciones: ≥ 2 almacenes, origen ≠ destino, usuario obligatorio,
   productos con nombre/cantidad > 0/unidad.
6. Confirmación y guardado; la foto se sube a `evidencias`.
7. La tabla permite filtrar por almacén, texto, fechas y estado; ver detalle con
   foto bajo demanda; compartir; marcar completada/pendiente.
8. Exportar CSV de pendientes con columnas `nombre, cantidad, almacen_descuento,
   almacen_incremento` (reutiliza `INVENTORY_CSV_HEADERS`).

**Aceptación:** una transferencia guardada sobrevive recarga, no incluye fotos en
la consulta de lista y su estado se puede alternar.

### 8.10 Producción masiva

`ProduccionView`:

1. Cargar historial (`produccion`), almacenes y recetas.
2. “Escanear Hoja” usa `extractProductsFromImage` y agrega ítems a
   `pendingItems` con `source: 'ai'`.
3. Ingreso manual agrega ítems con `source: 'manual'`.
4. La cola permite editar y eliminar antes de guardar.
5. “Guardar todo” valida almacenes y que cada ítem tenga descuento e incremento.
6. Inserta en paralelo con `createProduccion`; recarga historial y limpia la cola.
7. Historial filtrable por nombre, encargado, fechas y estado.
8. Exportar CSV de pendientes (`produccion_pendientes.csv`).

**Aceptación:** la cola no persiste hasta confirmar; cada ítem guardado tiene
`status = false` y aparece en el historial.

### 8.11 Ajustes

Solo `ADMIN`:

- CRUD de tipos de corte (`config_cortes`) con mermas máximas.
- CRUD de almacenes (`almacenes`).
- No permite eliminar un corte referenciado por piezas (error de FK).
- El borrado de un almacén no valida referencias históricas; es responsabilidad
  del administrador.

### 8.12 Captura de evidencia

`CameraCapture` (`docs/camera_capture.md`):

- Usa `getUserMedia` con cámara trasera cuando está disponible.
- Alternativa de subir archivo.
- Redimensiona a máximo 1920 px y comprime JPEG al 88%.
- Devuelve data URL base64 para previsualización y carga.

---

## 9. Inteligencia artificial

Servicio: `src/services/openrouterService.ts`.

### 9.1 Proveedor y modelos

- Endpoint: `https://openrouter.ai/api/v1/chat/completions`.
- Modelo primario: `VITE_OPENROUTER_VISION_MODEL` o `google/gemini-2.5-flash`.
- Fallbacks: `google/gemini-3.1-flash-lite`, `google/gemini-2.5-flash-lite`.
- Reintenta con el siguiente modelo ante `429` o `5xx`.
- `response_format: json_object` para validación y extracción; texto libre para análisis.

### 9.2 Validación de peso

`validateWeightWithAI(imageBase64, expectedWeight)`:

- Exige carne visible, báscula visible y peso legible.
- Devuelve `{ isValid, detectedWeight, confidence, reason }`.
- Tolerancia: `|detectado - esperado| <= max(0.1 kg, esperado × 5%)`.
- `isValid = coincidencia && isMeatPresent && isScalePresent`.
- Sin API key devuelve `isValid = false` con motivo explícito.
- Errores técnicos devuelven `isValid = false`, pero la app permite continuar.

### 9.3 Extracción de productos (OCR)

`extractProductsFromImage(imageBase64)`:

- Devuelve `{ nombre, cantidad, unidad }[]`.
- Unidades permitidas: `kg`, `g`, `unidades`, `lts`, `potes`, `paquetes`.
- Acepta respuesta como array o `{ products: [...] }`.
- Sin API key o error devuelve `[]`; la UI permite continuar manualmente.
- Usado en Transferencias y Producción.

### 9.4 Análisis de trazabilidad

`analyzeTraceability(pieza, registros)`:

- Evalúa progresión lógica de pesos, distancia descongelado→producido (alerta 10%)
  y coherencia de porciones vs producido (alerta 5%).
- Responde texto libre breve (máx. 3 líneas).
- Se guarda en `piezas.analisis_ia`; se muestra en el detalle con opción de copiar.
- Un fallo no bloquea el pesaje.

### 9.5 Política de fallos

La IA es **asistiva, no bloqueante**. Cualquier fallo de red, API o parseo debe:

1. No perder el pesaje ni la foto.
2. Registrar el motivo en `ia_reason` (si aplica).
3. Permitir corrección manual.

---

## 10. Especificación de pantallas

### 10.1 Dashboard

Componentes: filtros, KPIs, resumen de procesamiento, alertas, piezas, paginación.

Requisitos:

- RF-DASH-01: filtrar por fecha inicio/fin, tipo (texto) y estado.
- RF-DASH-02: KPIs solo para roles ≠ `COCINA`.
- RF-DASH-03: “Piezas Filtradas”, “Alertas Críticas” y “Rendimiento Promedio”.
- RF-DASH-04: resumen de kg producidos por tipo en rango (default últimos 7 días).
- RF-DASH-05: alertas filtradas, paginadas y auditables.
- RF-DASH-06: “Piezas en Proceso (Filtradas)” con 12 por página.
- RF-DASH-07: crear pieza y generar reporte.
- RF-DASH-08: cada tarjeta muestra estado, última etapa, mermas y acción siguiente.
- RF-DASH-09: al llegar a `PRODUCIDA`, la acción es “Marcar como Cargado”.

### 10.2 Detalle de pieza

- Pesos congelado/descongelado/producido.
- Mermas y rendimiento.
- Porciones y suma.
- Evidencias por etapa (carga lazy).
- Estado de validación IA por registro.
- Análisis IA de trazabilidad (copiar).
- Acciones admin: editar/eliminar etapa, revertir carga, eliminar pieza.
- Auditada: comentario y estado.

### 10.3 Auditoría

- Agrupa registros por pieza.
- Filtro “Solo auditadas”.
- Muestra fecha, usuario, evento, peso, validación IA y motivo.
- Miniaturas de evidencia con carga lazy (`RegistroThumb`).
- 20 grupos por página.
- Solo roles ≠ `COCINA`.

### 10.4 Ajustes

- CRUD de cortes con edición inline.
- CRUD de almacenes con edición inline.
- Solo `ADMIN`.

### 10.5 Transferencias

- Formulario de creación + captura IA + tabla histórica + filtros + detalle + CSV.
- Solo disponible con sesión.

### 10.6 Producción

- Escaneo IA + formulario manual + cola editable + historial + filtros + CSV.
- Solo disponible con sesión.

---

## 11. Requisitos no funcionales

- RNF-01: TypeScript estricto en compilación (`npm run lint` sin errores).
- RNF-02: build de Vite exitoso (`npm run build`).
- RNF-03: carga del dashboard en tiempos normales incluso con evidencias base64
  históricas; prohibido seleccionar fotos en listados masivos.
- RNF-04: operaciones de escritura deben ser idempotentes a nivel de UI: no
  duplicar registros por doble clic (usar `isSubmitting`).
- RNF-05: fechas mostradas en español (`date-fns/locale/es`).
- RNF-06: exportaciones CSV en UTF-8 con BOM para Excel.
- RNF-07: diseño responsive (móvil primero para cocina).
- RNF-08: nunca registrar secretos en el repositorio; `.env*` está ignorado.

---

## 12. Seguridad y RLS

Estado actual del repositorio:

- La UI exige sesión para acceder a datos.
- El rol se lee de `perfiles`.
- El repositorio **no contiene** definiciones de RLS ni políticas versionadas.
- `AGENT.md` deja pendiente “roles granulares en RLS”.

Requisito para producción:

- RNF-SEC-01: versionar políticas RLS por tabla.
- RNF-SEC-02: impedir escrituras anónimas.
- RNF-SEC-03: restringir `config_cortes`, `almacenes`, `perfiles` a `ADMIN` para
  escritura.
- RNF-SEC-04: `authenticated` puede leer/escribir piezas y registros según rol.
- RNF-SEC-05: bucket `evidencias` con políticas de lectura/escritura acordes.

> Hasta implementar RLS, la seguridad depende de la anon key y de las reglas de
> la UI; esto no es suficiente para producción.

---

## 13. Rendimiento y limitaciones conocidas

1. **Fotos base64:** registros antiguos guardan imágenes en la columna. Las
   consultas de lista excluyen fotos y las cargan por pieza/registro.
2. **Statement timeout:** cualquier `select('*')` sobre `registros_peso` o
   `transferencias` puede agotar el tiempo. Usar columnas explícitas.
3. **Carga parcial:** `Promise.allSettled` evita que un fallo vacíe todo.
4. **`transferencias.productos`:** jsonb; se serializa
   con `JSON.stringify` al insertar y se parsea defensivamente al leer.
5. **Duplicados de estado:** el enum DB usa nombres distintos al frontend; no
   agregar valores sin actualizar ambos mapeos y la migración.
6. **Corte FK:** `piezas.tipo` referencia `config_cortes.nombre`; los tipos deben
   existir antes de crear piezas.
7. **Roles:** `ANALISTA` no se obtiene desde `fetchProfile`; si se requiere, hay
   que extender el mapeo.
8. **Textos:** algunos literales de UI tienen problemas de codificación y typos
   (ej. “Oricesamiento”, “AuditorA-a”); no afectan la lógica pero deben corregirse.
9. **Documentación desactualizada:** `AGENT.md` menciona bucket `meat-images` y
   modelo `gemini-2.0-flash-lite-001`; el código usa `evidencias` y
   `gemini-2.5-flash` con fallbacks.
10. **Migraciones:** las dos migraciones de `CARGADO_EN_SISTEMA` están en el
    working tree sin commit.

---

## 14. Criterios de aceptación globales

Una entrega se considera válida si:

1. `npm run lint` pasa sin errores.
2. `npm run build` pasa.
3. Login, logout y refresco de token no recargan datos innecesariamente.
4. Crear pieza → congelado → descongelado → producido → cargado persiste tras
   recargar y muestra el estado correcto en cada paso.
5. “Marcar como Cargado” desaparece tras la acción y no reaparece.
6. La lista de piezas carga aunque existan fotos base64 históricas.
7. Una discrepancia o fallo de IA no impide registrar el peso.
8. Las alertas respetan los umbrales por corte y el mínimo de rendimiento.
9. Las acciones destructivas exigen admin y confirmación.
10. Transferencias y producción validan almacenes y productos antes de guardar.

### Verificación rápida

```bash
npm run lint
npm run build
npx supabase db push --linked
npx supabase db query --linked "select estado, count(*) from piezas group by estado;"
```

---

## 15. Deuda técnica y próximos pasos

- Implementar y versionar RLS por tabla y por rol.
- Mapear `ANALISTA` en `fetchProfile` y definir sus permisos.
- Migrar evidencias base64 históricas a Storage y dejar solo URLs.
- Unificar el bucket documentado (`meat-images` vs `evidencias`).
- Reemplazar `window.confirm`/`alert` por modales consistentes.
- Añadir pruebas automatizadas (unitarias de cálculos y de mapeos; E2E del flujo).
- Corregir textos con problemas de codificación y typos.
- Documentar el contrato de la IA y versionar prompts.
- Evaluar índices para `registros_peso(pieza_id)`, `registros_peso(fecha)` y
  `piezas(estado)`.
- Confirmar si `document_chunks`/RAG forma parte del roadmap o debe eliminarse.

---

## 16. Matriz de trazabilidad (spec → código)

| Requisito | Implementación |
|---|---|
| Autenticación y roles | `src/App.tsx` auth listener, `LoginView`, `loadUserProfile` |
| Dashboard y filtros | `src/App.tsx` `filteredPiezas`, `alerts`, `paginated*` |
| Máquina de estados | `src/types.ts` `NEXT_STATE`, `EVENT_FOR_STATE` |
| Cálculos | `src/App.tsx` `calculateMetrics`, `recalculatePieceState` |
| Persistencia y mapeos | `src/services/supabaseService.ts` |
| Validación IA de peso | `src/services/openrouterService.ts` `validateWeightWithAI` |
| OCR de productos | `src/services/openrouterService.ts` `extractProductsFromImage` |
| Análisis de trazabilidad | `src/services/openrouterService.ts` `analyzeTraceability` |
| Captura y compresión | `src/components/CameraCapture.tsx`, `docs/camera_capture.md` |
| Transferencias | `src/components/TransferenciasView.tsx` |
| Producción | `src/components/ProduccionView.tsx` |
| CSV | `src/lib/csv.ts` |
| Similitud de nombres | `src/lib/utils.ts` `normalizeText`, `similarity` |
| Migraciones de estado | `supabase/migrations/20261030193804_add_cargado_en_sistema_estado.sql`, `20261030194053_backfill_cargado_en_sistema.sql` |
