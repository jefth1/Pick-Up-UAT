-- Fotos de productos y logo del local (Supabase Storage).
-- Las imágenes se guardan en el bucket público "fotos", en la carpeta del local:
-- fotos/<local_id>/<archivo>. Cualquiera las ve; solo el dueño del local sube o borra.
alter table public.productos add column foto_url text check (length(foto_url) <= 500);
alter table public.locales add column logo_url text check (length(logo_url) <= 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "subir fotos de mi local" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and privado.es_dueno(((storage.foldername(name))[1])::bigint));
create policy "cambiar fotos de mi local" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and privado.es_dueno(((storage.foldername(name))[1])::bigint));
create policy "borrar fotos de mi local" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and privado.es_dueno(((storage.foldername(name))[1])::bigint));
