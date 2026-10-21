-- es_dueno() solo la usan las políticas: se saca del esquema público para que no
-- quede expuesta como /rest/v1/rpc/es_dueno (aviso del asesor de seguridad).
create schema if not exists privado;
grant usage on schema privado to authenticated;
alter function public.es_dueno(bigint) set schema privado;
