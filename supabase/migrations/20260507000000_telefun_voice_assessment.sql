-- Bucket for Telefun recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('telefun-recordings', 'telefun-recordings', false, 52428800, 
        ARRAY['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg', 'audio/mp4']::text[])
ON CONFLICT (id) DO UPDATE SET 
  public = false, 
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage INSERT policy: Users can upload their own recordings
DROP POLICY IF EXISTS "Users upload own telefun recordings" ON storage.objects;
CREATE POLICY "Users upload own telefun recordings" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'telefun-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage SELECT policy: Users can read their own recordings
DROP POLICY IF EXISTS "Users read own telefun recordings" ON storage.objects;
CREATE POLICY "Users read own telefun recordings" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'telefun-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage UPDATE policy: Required for upsert: true in browser client
DROP POLICY IF EXISTS "Users update own telefun recordings" ON storage.objects;
CREATE POLICY "Users update own telefun recordings" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'telefun-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'telefun-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Extend telefun_history with voice assessment metadata
ALTER TABLE telefun_history 
  ADD COLUMN IF NOT EXISTS recording_path TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS agent_recording_path TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS voice_assessment JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS session_metrics JSONB DEFAULT NULL;

-- Note: No general UPDATE RLS on telefun_history is added.
-- Mutations to score/assessment are handled via server actions with admin client.
