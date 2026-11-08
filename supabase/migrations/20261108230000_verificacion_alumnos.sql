-- Verificación de cuentas de alumnos.
-- Supabase Auth verifica el correo con un código (Confirm email): sin verificarlo no hay
-- sesión. Aquí se asegura que esa verificación diga algo: solo un correo institucional
-- puede tener perfil de alumno, y el correo guardado en alumnos es siempre el de la
-- cuenta (el que se verificó), no el que se escribió en el formulario.
-- Los dominios se cambian en ajustes.dominios_alumnos; una lista vacía acepta cualquier
-- correo (sirve para probar con un correo personal).

alter table public.ajustes
  add column dominios_alumnos text[] not null default array['alumnos.uat.edu.mx'];

-- ¿El correo de la sesión es de un dominio de alumnos?
create function privado.correo_de_alumno() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select cardinality(dominios_alumnos) = 0
      or lower(split_part((select auth.jwt()) ->> 'email', '@', 2)) = any (dominios_alumnos)
    from public.ajustes
  ), false);
$$;

alter policy "guardar mis datos" on public.alumnos
  with check (id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and not exists (select 1 from public.locales where propietario = (select auth.uid()))
    and privado.correo_de_alumno());

-- El correo del alumno es el de su cuenta. Sin sesión (SQL Editor) se deja el que venga.
create function privado.correo_de_la_cuenta() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.correo := coalesce(lower((select auth.jwt()) ->> 'email'), new.correo);
  return new;
end;
$$;

create trigger correo_de_la_cuenta before insert or update of correo on public.alumnos
  for each row execute function privado.correo_de_la_cuenta();

revoke execute on function privado.correo_de_alumno(), privado.correo_de_la_cuenta() from public, anon;
grant execute on function privado.correo_de_alumno() to authenticated;
