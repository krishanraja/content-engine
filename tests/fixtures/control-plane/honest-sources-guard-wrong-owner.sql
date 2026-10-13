-- Guard case: pilot_build already exists under another owner, which the
-- migration's on conflict skips silently. The migration must refuse to
-- commit (CI expects it to fail after this file).
insert into public.intake_sources (slug, label, what, owner) values
  ('pilot_build', 'Pilot build', 'A synthetic row under the wrong owner.', 'manual');
