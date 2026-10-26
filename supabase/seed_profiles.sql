-- Seed profiles for testing (admin + médico)
-- NOTE: This file inserts into a `profiles` table typically created by Supabase auth triggers.
-- If you use Supabase, run this in the SQL editor after creating the auth users with the matching emails.

-- Replace the UUIDs below with your auth users' IDs if you create real auth users in Supabase.

INSERT INTO profiles (id, full_name, email, role, specialty, avatar_url)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Administrador MedCore', 'admin@medcore.com', 'admin', NULL, NULL),
  ('00000000-0000-4000-8000-000000000002', 'Dra. Sofia Lopez', 'doctor@medcore.com', 'medico', 'Cardiología', NULL)
ON CONFLICT (id) DO NOTHING;
