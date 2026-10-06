-- The recordings lane: lets the library's private bucket hold Matroska (.mkv)
-- recordings from the Video Engine Inbox.
--
-- Krish, 2026-10-06, after a session told him it could not reach his file:
-- "figure out how to never make that error again". The recordings upload on
-- both runner machines (scripts/recordings-upload.ps1) sends every recording from the Inbox to this bucket
-- under recordings/, and a cloud session fetches it with
-- scripts/post-pack/recording.py (api/library/_recordings.ts).
--
-- Only Matroska needs this. mp4, mov, webm, m4a, wav and mp3 are in the bucket
-- from 20261006120000_content_library.sql, so the lane works for them without
-- it. Until this is applied an .mkv recording is refused with
-- recording_type_not_enabled and the sync says so in its log. The engine
-- accepts the bucket with or without this type (LIBRARY_OPTIONAL_MIME_TYPES),
-- so the order of applying this and deploying does not matter.
--
-- No table: a recording and its manifest are objects in the bucket.
--
-- Idempotent: safe to run twice. Nothing here is applied by a session.

update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct type order by type)
  from unnest(allowed_mime_types || array['video/x-matroska']) as type
)
where id = 'content-library'
  -- A bucket with no type list is not the one the library migration made:
  -- left alone, and the engine refuses it as misconfigured.
  and allowed_mime_types is not null
  and not ('video/x-matroska' = any(allowed_mime_types));
