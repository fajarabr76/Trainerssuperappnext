ALTER TABLE public.profiler_peserta
ADD COLUMN IF NOT EXISTS photo_frame jsonb;

COMMENT ON COLUMN public.profiler_peserta.photo_frame IS
'Stores photo framing metadata (x, y, zoom) for cross-device consistency.';
