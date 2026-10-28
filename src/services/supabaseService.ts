import { getSupabase } from '../lib/supabase';
import { Pieza, RegistroPeso, ConfigCorte, EstadoPieza, TipoEvento, Usuario, RolUsuario, Produccion, Transferencia, Receta, MateriaPrima } from '../types';

const getClient = () => {
  const client = getSupabase();
  if (!client) throw new Error('Supabase not configured');
  return client;
};

// Mapeo entre estados del frontend y enums de la base de datos Supabase (estado_pieza)
const mapDbEstadoToFrontend = (dbEstado: string): EstadoPieza => {
  switch (dbEstado) {
    case 'DESCONGELANDO':
      return EstadoPieza.CONGELADA;
    case 'PROCESANDO':
      return EstadoPieza.DESCONGELADA;
    case 'FINALIZADA':
      return EstadoPieza.PRODUCIDA;
    case 'CREADA':
    default:
      return EstadoPieza.CREADA;
  }
};

const mapFrontendEstadoToDb = (estado?: EstadoPieza): string => {
  switch (estado) {
    case EstadoPieza.CONGELADA:
      return 'DESCONGELANDO';
    case EstadoPieza.DESCONGELADA:
      return 'PROCESANDO';
    case EstadoPieza.PRODUCIDA:
    case EstadoPieza.CARGADO_EN_SISTEMA:
      return 'FINALIZADA';
    case EstadoPieza.CREADA:
    default:
      return 'CREADA';
  }
};

// Mapeo entre eventos del frontend y enums de la base de datos Supabase (tipo_evento_peso)
const mapDbEventoToFrontend = (dbEvento: string): TipoEvento => {
  switch (dbEvento) {
    case 'PESO_CONGELADO':
      return TipoEvento.CONGELADO;
    case 'PESO_DESCONGELADO':
      return TipoEvento.DESCONGELADO;
    case 'PESO_PRODUCIDO':
      return TipoEvento.PRODUCIDO;
    default:
      return TipoEvento.CONGELADO;
  }
};

const mapFrontendEventoToDb = (evento?: TipoEvento): string => {
  switch (evento) {
    case TipoEvento.CONGELADO:
      return 'PESO_CONGELADO';
    case TipoEvento.DESCONGELADO:
      return 'PESO_DESCONGELADO';
    case TipoEvento.PRODUCIDO:
      return 'PESO_PRODUCIDO';
    default:
      return 'PESO_CONGELADO';
  }
};

export const supabaseService = {
  // Config Cortes
  async fetchConfigCortes(): Promise<ConfigCorte[]> {
    const { data, error } = await getClient()
      .from('config_cortes')
      .select('*')
      .order('nombre');

    if (error) throw error;

    return (data || []).map(c => ({
      id: c.id,
      nombre: c.nombre,
      mermaDescongeladoMax: Number(c.merma_descongelado_max),
      mermaTotalMax: Number(c.merma_total_max)
    }));
  },

  async saveConfigCorte(corte: ConfigCorte) {
    const { error } = await getClient()
      .from('config_cortes')
      .upsert({
        id: corte.id.startsWith('C-') ? undefined : corte.id, // Let Supabase generate UUID if it's a temp ID
        nombre: corte.nombre,
        merma_descongelado_max: corte.mermaDescongeladoMax,
        merma_total_max: corte.mermaTotalMax
      });
    if (error) throw error;
  },

  async deleteConfigCorte(id: string) {
    const { error } = await getClient()
      .from('config_cortes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Piezas
  async fetchPiezas(): Promise<Pieza[]> {
    const { data, error } = await getClient()
      .from('piezas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(p => ({
      id: p.id,
      tipo: p.tipo,
      estado: mapDbEstadoToFrontend(p.estado),
      pesoCongelado: Number(p.peso_congelado),
      pesoDescongelado: Number(p.peso_descongelado),
      pesoProducido: Number(p.peso_producido),
      fotoMerma: p.foto_merma_url,
      mermaDescongelado: Number(p.merma_descongelado),
      mermaTotal: Number(p.merma_total),
      merma: Number(p.merma),
      rendimiento: Number(p.rendimiento),
      porciones: p.porciones,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      auditado: p.auditado,
      comentarioAuditoria: p.comentario_auditoria,
      analisis_ia: p.analisis_ia
    }));
  },

  async createPieza(pieza: Pieza) {
    const { error } = await getClient()
      .from('piezas')
      .insert({
        id: pieza.id,
        tipo: pieza.tipo,
        estado: mapFrontendEstadoToDb(pieza.estado),
        peso_congelado: pieza.pesoCongelado,
        peso_descongelado: pieza.pesoDescongelado,
        peso_producido: pieza.pesoProducido,
        foto_merma_url: pieza.fotoMerma,
        merma_descongelado: pieza.mermaDescongelado,
        merma_total: pieza.mermaTotal,
        merma: pieza.merma,
        rendimiento: pieza.rendimiento,
        porciones: pieza.porciones,
        created_at: pieza.createdAt,
        updated_at: pieza.updatedAt
      });
    if (error) throw error;
  },

  async updatePieza(pieza: Partial<Pieza> & { id: string }) {
    const updateData: any = {
      peso_congelado: pieza.pesoCongelado,
      peso_descongelado: pieza.pesoDescongelado,
      peso_producido: pieza.pesoProducido,
      foto_merma_url: pieza.fotoMerma,
      merma_descongelado: pieza.mermaDescongelado,
      merma_total: pieza.mermaTotal,
      merma: pieza.merma,
      rendimiento: pieza.rendimiento,
      porciones: pieza.porciones,
      auditado: pieza.auditado,
      comentario_auditoria: pieza.comentarioAuditoria,
      analisis_ia: pieza.analisis_ia,
      updated_at: new Date().toISOString()
    };

    if (pieza.estado) {
      updateData.estado = mapFrontendEstadoToDb(pieza.estado);
    }

    const { error } = await getClient()
      .from('piezas')
      .update(updateData)
      .eq('id', pieza.id);
    if (error) throw error;
  },

  async updatePiezaOnly(pieza: { id: string; analisis_ia?: string }) {
    const { error } = await getClient()
      .from('piezas')
      .update({
        analisis_ia: pieza.analisis_ia,
        updated_at: new Date().toISOString()
      })
      .eq('id', pieza.id);
    if (error) throw error;
  },

  async fetchProduccion(): Promise<Produccion[]> {
    const { data, error } = await getClient()
      .from('produccion')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) throw error;

    return (data || []).map(p => ({
      id: p.id,
      nombrePreparado: p.nombre_preparado,
      cantidad: Number(p.cantidad),
      unidad: p.unidad,
      fecha: p.fecha,
      encargado: p.encargado,
      status: !!p.status
    }));
  },

  async createProduccion(produccion: Produccion) {
    const { error } = await getClient()
      .from('produccion')
      .insert({
        id: produccion.id,
        nombre_preparado: produccion.nombrePreparado,
        cantidad: produccion.cantidad,
        unidad: produccion.unidad,
        fecha: produccion.fecha,
        encargado: produccion.encargado,
        status: produccion.status || false
      });
    if (error) throw error;
  },

  async updateProduccionStatus(id: string, status: boolean) {
    const { error } = await getClient()
      .from('produccion')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
  },

  // Registros & Evidencias
  async uploadImage(base64Data: string, fileName: string): Promise<string> {
    try {
      const client = getClient();

      // Convert base64 to Blob
      const base64Response = await fetch(base64Data);
      const blob = await base64Response.blob();

      const { data, error } = await client
        .storage
        .from('evidencias')
        .upload(`${fileName}.jpg`, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.warn("Aviso al subir imagen a Supabase Storage ('evidencias'). Se usará respaldo seguro en base64:", error.message || error);
        return base64Data;
      }

      // Get Public URL
      const { data: { publicUrl } } = client
        .storage
        .from('evidencias')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (err: any) {
      console.warn("Excepción al subir imagen al Storage de Supabase, manteniendo foto como respaldo:", err?.message || err);
      return base64Data;
    }
  },

  async fetchRegistros(): Promise<RegistroPeso[]> {
    const { data, error } = await getClient()
      .from('registros_peso')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      piezaId: r.pieza_id,
      tipoEvento: mapDbEventoToFrontend(r.tipo_evento),
      peso: Number(r.peso),
      foto: r.foto_url,
      fotoMerma: r.foto_merma_url,
      usuario: r.usuario_nombre,
      validadoIA: r.validado_ia,
      iaDetectedWeight: r.ia_detected_weight,
      iaReason: r.ia_reason,
      fecha: r.fecha
    }));
  },

  async createRegistro(reg: RegistroPeso): Promise<RegistroPeso> {
    const { data, error } = await getClient()
      .from('registros_peso')
      .insert({
        pieza_id: reg.piezaId,
        tipo_evento: mapFrontendEventoToDb(reg.tipoEvento),
        peso: reg.peso,
        foto_url: reg.foto,
        foto_merma_url: reg.fotoMerma,
        usuario_nombre: reg.usuario,
        validado_ia: reg.validadoIA,
        ia_detected_weight: reg.iaDetectedWeight,
        ia_reason: reg.iaReason,
        fecha: reg.fecha
      })
      .select()
      .single();
    if (error) throw error;
    if (data) {
      return {
        ...reg,
        id: data.id
      };
    }
    return reg;
  },

  async updateRegistro(id: string, updates: { peso?: number; fecha?: string; tipoEvento?: TipoEvento; usuario?: string }) {
    const updateData: any = {};
    if (updates.peso !== undefined) updateData.peso = updates.peso;
    if (updates.fecha !== undefined) updateData.fecha = updates.fecha;
    if (updates.tipoEvento !== undefined) updateData.tipo_evento = mapFrontendEventoToDb(updates.tipoEvento);
    if (updates.usuario !== undefined) updateData.usuario_nombre = updates.usuario;

    const { error } = await getClient()
      .from('registros_peso')
      .update(updateData)
      .eq('id', id);
    if (error) throw error;
  },

  async deleteRegistro(id: string) {
    const { error } = await getClient()
      .from('registros_peso')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async deletePieza(id: string) {
    await getClient()
      .from('registros_peso')
      .delete()
      .eq('pieza_id', id);

    const { error } = await getClient()
      .from('piezas')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Perfiles
  async fetchProfile(userId: string): Promise<Usuario | null> {
    const { data, error } = await getClient()
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;

    return {
      id: data.id,
      nombre: data.nombre_completo || data.email.split('@')[0],
      rol: data.rol === 'admin' ? RolUsuario.ADMIN : RolUsuario.COCINA
    };
  },

  // Transferencias
  async createTransferencia(transferencia: Transferencia) {
    const { error } = await getClient()
      .from('transferencias')
      .insert({
        id: transferencia.id,
        sede_origen: transferencia.sedeOrigen,
        sede_destino: transferencia.sedeDestino,
        productos: JSON.stringify(transferencia.productos),
        foto_url: transferencia.fotoUrl,
        usuario: transferencia.usuario,
        fecha: transferencia.fecha,
        status: transferencia.status || false
      });
    if (error) throw error;
  },

  async getTransferencias(): Promise<Transferencia[]> {
    // Exclude foto_url from list query — it may contain large base64 strings
    // that cause statement timeouts when fetching many rows at once
    const { data, error } = await getClient()
      .from('transferencias')
      .select('id, sede_origen, sede_destino, productos, usuario, fecha, status')
      .order('fecha', { ascending: false })
      .limit(200);

    if (error) throw error;

    return (data || []).map(t => ({
      id: t.id,
      sedeOrigen: t.sede_origen,
      sedeDestino: t.sede_destino,
      productos: typeof t.productos === 'string' ? JSON.parse(t.productos) : t.productos,
      usuario: t.usuario,
      fecha: t.fecha,
      status: !!t.status,
    }));
  },

  async getTransferenciaFoto(id: string): Promise<string | null> {
    const { data, error } = await getClient()
      .from('transferencias')
      .select('foto_url')
      .eq('id', id)
      .single();

    if (error) return null;
    return data?.foto_url || null;
  },

  async updateTransferenciaStatus(id: string, status: boolean) {
    const { error } = await getClient()
      .from('transferencias')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
  },

  // Recetas
  async fetchRecetas(): Promise<Receta[]> {
    const { data, error } = await getClient()
      .from('recetas')
      .select('*')
      .order('nombre');

    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      nombre: r.nombre
    }));
  },

  async createRecetas(recetas: Partial<Receta>[]) {
    const { error } = await getClient()
      .from('recetas')
      .insert(recetas);
    if (error) throw error;
  },

  // Materias Primas
  async fetchMateriasPrimas(): Promise<MateriaPrima[]> {
    const { data, error } = await getClient()
      .from('materia_prima')
      .select('*')
      .order('nombre');
    
    if (error) throw error;
    return data || [];
  }
};
