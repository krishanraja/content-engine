-- A library file may be up to 2 GiB (was 500 MiB). Krish, 2026-10-18, asked "May I raise the recording size
-- limit from 500 MB to 2 GB ... so your machine sends the 1.1 GB take and I render the deep cut here?", picked
-- "Yes, raise to 2 GB". Friday 16 Oct's 14-minute take (1.1 GB) could not reach a cloud session at 500 MiB.
-- The project's storage limit was raised to match through the Supabase management API the same day.
alter table public.content_library_files drop constraint if exists content_library_files_bytes_check;
alter table public.content_library_files add constraint content_library_files_bytes_check check (bytes between 1 and 2147483648);
update storage.buckets set file_size_limit = 2147483648 where id = 'content-library';
