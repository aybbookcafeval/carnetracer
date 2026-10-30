-- Distinguish pieces already loaded into the system from pieces only produced.
-- Previously both were stored as FINALIZADA, so the "Marcar como Cargado"
-- action was lost after reloading the data.
alter type public.estado_pieza add value if not exists 'CARGADO_EN_SISTEMA';
