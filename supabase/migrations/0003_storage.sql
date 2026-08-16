-- Bucket privado para las fotos de los casos (metadatos en public.photos).
-- Acceso de lectura vía URLs firmadas; escribe solo la Edge Function
-- kobo-webhook (service_role). Límite 5 MB: KoboCollect ya comprime
-- client-side (max-pixels en el XLSForm).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
