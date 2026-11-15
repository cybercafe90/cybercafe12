drop policy if exists "Owners can read private print job files" on storage.objects;
create policy "Owners can read private print job files" on storage.objects
for select to authenticated
using (
  bucket_id = 'print-jobs'
  and exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'owner')
);