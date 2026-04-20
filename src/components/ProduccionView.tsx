import React, { useState, useEffect } from "react";
import { Plus, Trash2, ChefHat, Camera as CameraIcon, Check, Edit2, Save, X, Filter, Calendar, Search } from "lucide-react";
import { Produccion, Usuario } from "../types";
import { supabaseService } from "../services/supabaseService";
import { extractProductsFromImage } from "../services/openrouterService";
import { CameraCapture } from "./CameraCapture";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  user: Usuario | null;
}

interface PendingItem {
  id: string;
  nombrePreparado: string;
  cantidad: number;
  unidad: 'kg' | 'g' | 'unidades' | 'lts' | 'potes' | 'paquetes';
  source: 'ai' | 'manual'; // Para saber de dónde vino
}

export const ProduccionView: React.FC<Props> = ({ user }) => {
  // Historial real de la BD
  const [produccion, setProduccion] = useState<Produccion[]>([]);

  // Lista unificada de items pendientes de guardar (IA + Manuales)
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  // Estados del formulario
  const [nombrePreparado, setNombrePreparado] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState<'kg' | 'g' | 'unidades' | 'lts' | 'potes' | 'paquetes'>('unidades');

  // Control de UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estados de Filtros
  const [filterName, setFilterName] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterEncargado, setFilterEncargado] = useState("");

  // Cargar historial al inicio
  useEffect(() => {
    supabaseService.fetchProduccion().then(setProduccion);
  }, []);

  // Lógica de Filtrado
  const filteredProduccion = React.useMemo(() => {
    return produccion.filter(p => {
      const matchesName = p.nombrePreparado.toLowerCase().includes(filterName.toLowerCase());
      const matchesEncargado = p.encargado.toLowerCase().includes(filterEncargado.toLowerCase());

      const itemDate = new Date(p.fecha).toISOString().split('T')[0];
      const matchesStartDate = !filterStartDate || itemDate >= filterStartDate;
      const matchesEndDate = !filterEndDate || itemDate <= filterEndDate;

      return matchesName && matchesEncargado && matchesStartDate && matchesEndDate;
    });
  }, [produccion, filterName, filterEncargado, filterStartDate, filterEndDate]);

  // --- LÓGICA DE IA ---
  const handleCapture = async (imageSrc: string) => {
    setIsCapturing(false);
    setIsExtracting(true);
    try {
      const extracted = await extractProductsFromImage(imageSrc);
      if (extracted.length > 0) {
        const newItems: PendingItem[] = extracted.map((item, index) => ({
          id: `ai-${Date.now()}-${index}`,
          nombrePreparado: item.nombre,
          cantidad: item.cantidad,
          unidad: item.unidad as any,
          source: 'ai'
        }));
        // Agregamos los items detectados a la lista pendiente existente
        setPendingItems(prev => [...prev, ...newItems]);
      } else {
        alert("No se detectaron productos. Agrega manualmente.");
      }
    } catch (error) {
      console.error("Error extracting:", error);
      alert("Error al procesar la imagen.");
    } finally {
      setIsExtracting(false);
    }
  };

  // --- LÓGICA DEL FORMULARIO (Agregar Manual o Actualizar Edición) ---
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombrePreparado || !cantidad) return;

    const newItem: PendingItem = {
      id: editingId || `manual-${Date.now()}`,
      nombrePreparado,
      cantidad: parseFloat(cantidad),
      unidad,
      source: 'manual'
    };

    if (editingId) {
      // Si estamos editando, actualizamos el item en la lista
      setPendingItems(prev => prev.map(item => item.id === editingId ? newItem : item));
      setEditingId(null);
    } else {
      // Si no, agregamos uno nuevo a la lista pendiente
      setPendingItems(prev => [newItem, ...prev]);
    }

    // Limpiar formulario para el siguiente ingreso rápido
    setNombrePreparado("");
    setCantidad("");
    // Mantener la unidad seleccionada suele ser útil si son varios del mismo tipo
  };

  // --- ACCIONES DE LISTA ---
  const startEditing = (item: PendingItem) => {
    setEditingId(item.id);
    setNombrePreparado(item.nombrePreparado);
    setCantidad(item.cantidad.toString());
    setUnidad(item.unidad);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removePendingItem = (id: string) => {
    setPendingItems(prev => prev.filter(item => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setNombrePreparado("");
      setCantidad("");
    }
  };

  // --- GUARDAR TODO EN BD ---
  const handleSaveAllToDatabase = async () => {
    if (pendingItems.length === 0) return;
    setIsSubmitting(true);

    try {
      const itemsToSave: Produccion[] = pendingItems.map(item => ({
        id: `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        nombrePreparado: item.nombrePreparado,
        cantidad: item.cantidad,
        unidad: item.unidad,
        fecha: new Date().toISOString(),
        encargado: user?.nombre || "Sistema"
      }));

      // Guardar en paralelo
      await Promise.all(itemsToSave.map(item => supabaseService.createProduccion(item)));

      // Recargar historial y limpiar pendiente
      const updatedHistory = await supabaseService.fetchProduccion();
      setProduccion(updatedHistory);
      setPendingItems([]);
      setEditingId(null);

      alert(`✅ ${itemsToSave.length} registros guardados exitosamente.`);
    } catch (error) {
      console.error("Error saving batch:", error);
      alert("Hubo un error al guardar los registros.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {isCapturing ? (
        <CameraCapture onCapture={handleCapture} />
      ) : (
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <ChefHat className="text-brand" />
              Centro de Producción
            </h2>
            <button
              onClick={() => setIsCapturing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              <CameraIcon className="w-5 h-5" /> Escanear Hoja
            </button>
          </div>

          {isExtracting && (
            <div className="mb-4 p-4 bg-brand/10 text-brand rounded-xl font-bold text-center animate-pulse">
              Analizando imagen con IA...
            </div>
          )}

          {/* FORMULARIO DE INGRESO RÁPIDO */}
          <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="md:col-span-12 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              {editingId ? "✏️ Editando Item..." : "➕ Agregar Item a la Lista"}
            </div>

            <div className="md:col-span-5">
              <input
                type="text"
                placeholder="Nombre del preparado (ej. Salsa BBQ)"
                value={nombrePreparado}
                onChange={e => setNombrePreparado(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand/50 outline-none"
                required
              />
            </div>

            <div className="md:col-span-4 flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Cant."
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand/50 outline-none"
                required
              />
              <select
                value={unidad}
                onChange={e => setUnidad(e.target.value as any)}
                className="p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand/50 outline-none w-24"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="unidades">unds</option>
                <option value="lts">lts</option>
                <option value="potes">potes</option>
              </select>
            </div>

            <div className="md:col-span-3 flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700 transition-colors flex justify-center items-center gap-2"
              >
                {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingId ? "Actualizar" : "Agregar"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setNombrePreparado(""); setCantidad(""); }}
                  className="px-3 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>

          {/* LISTA UNIFICADA (Pendientes de Guardar) */}
          {pendingItems.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-700">Lista Pendiente de Guardado</h3>
                  <p className="text-xs text-slate-500">{pendingItems.length} items en cola</p>
                </div>
                <button
                  onClick={handleSaveAllToDatabase}
                  disabled={isSubmitting}
                  className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand/80 disabled:opacity-50 font-bold shadow-md flex items-center gap-2"
                >
                  {isSubmitting ? "Guardando..." : <><Check className="w-4 h-4" /> Guardar Todo en BD</>}
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {pendingItems.map((item) => (
                  <div key={item.id} className={`flex justify-between items-center p-4 hover:bg-slate-50 transition-colors ${editingId === item.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${item.source === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'}`}>
                        {item.source === 'ai' ? 'IA' : 'MAN'}
                      </span>
                      <div>
                        <div className="font-medium text-slate-800 text-lg">{item.nombrePreparado}</div>
                        <div className="text-sm text-slate-500 font-mono">{item.cantidad} {item.unidad}</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditing(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removePendingItem(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar de la lista"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
              <p>No hay items pendientes. Escanea una hoja o agrega manualmente.</p>
            </div>
          )}
        </section>
      )}

      {/* HISTORIAL RECIENTE Y FILTROS */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              Historial de Producción
            </h2>

            {(filterName || filterEncargado || filterStartDate || filterEndDate) && (
              <button
                onClick={() => { setFilterName(""); setFilterEncargado(""); setFilterStartDate(""); setFilterEndDate(""); }}
                className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Limpiar Filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Encargado..."
                value={filterEncargado}
                onChange={e => setFilterEncargado(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Preparado</th>
                <th className="p-4">Cantidad</th>
                <th className="p-4">Encargado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProduccion.length > 0 ? (
                filteredProduccion.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-500">{format(new Date(p.fecha), "dd MMM, HH:mm", { locale: es })}</td>
                    <td className="p-4 font-medium text-slate-700">{p.nombrePreparado}</td>
                    <td className="p-4 text-slate-600">{p.cantidad} {p.unidad}</td>
                    <td className="p-4 text-slate-500">{p.encargado}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    No se encontraron registros con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};