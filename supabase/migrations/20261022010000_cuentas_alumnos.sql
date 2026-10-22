-- Los alumnos ahora se registran con correo y contraseña (registro temporal hasta
-- conectar la API de la UAT). Una misma cuenta es alumno o local, no las dos.
alter policy "registrar mi local" on public.locales
  with check (propietario = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and not exists (select 1 from public.alumnos where id = (select auth.uid())));

alter policy "guardar mis datos" on public.alumnos
  with check (id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and not exists (select 1 from public.locales where propietario = (select auth.uid())));
