-- Historical rows: before CARGADO_EN_SISTEMA existed, "Marcar como Cargado"
-- stored FINALIZADA. Those pieces have updated_at well after their last weight
-- record, unlike pieces that were merely produced (a few seconds apart).
update public.piezas p
set estado = 'CARGADO_EN_SISTEMA'
where p.estado = 'FINALIZADA'
  and exists (
    select 1 from public.registros_peso r where r.pieza_id = p.id
  )
  and p.updated_at > (
    select max(r.fecha) from public.registros_peso r where r.pieza_id = p.id
  ) + interval '1 hour';
