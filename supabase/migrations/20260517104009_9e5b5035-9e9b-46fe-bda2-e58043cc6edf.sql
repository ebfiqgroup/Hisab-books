
insert into storage.buckets (id, name, public) values ('feedback', 'feedback', true)
on conflict (id) do nothing;

create policy "feedback public read"
on storage.objects for select
using (bucket_id = 'feedback');

create policy "feedback auth upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'feedback' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "feedback auth update own"
on storage.objects for update to authenticated
using (bucket_id = 'feedback' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "feedback auth delete own"
on storage.objects for delete to authenticated
using (bucket_id = 'feedback' and auth.uid()::text = (storage.foldername(name))[1]);
