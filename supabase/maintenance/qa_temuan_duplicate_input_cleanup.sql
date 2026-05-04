-- Diagnostic and cleanup helper for deploying
-- 20260504000000_add_unique_index_qa_temuan_duplicate_input.sql.
--
-- The unique index rejects duplicate non-phantom findings with the same:
-- peserta_id + period_id + service_type + normalized no_tiket + indicator_id.
-- Run the diagnostic query first. Review each duplicate group with the product/data
-- owner before deleting rows; this file intentionally does not auto-delete data.

-- 1) Summary of duplicate groups that block uq_qa_temuan_duplicate_input.
WITH duplicate_groups AS (
  SELECT
    peserta_id,
    period_id,
    service_type,
    LOWER(TRIM(no_tiket)) AS normalized_no_tiket,
    indicator_id,
    COUNT(*) AS duplicate_count,
    ARRAY_AGG(id ORDER BY created_at NULLS LAST, id) AS row_ids
  FROM public.qa_temuan
  WHERE is_phantom_padding = false
    AND no_tiket IS NOT NULL
    AND TRIM(no_tiket) != ''
  GROUP BY 1, 2, 3, 4, 5
  HAVING COUNT(*) > 1
)
SELECT *
FROM duplicate_groups
ORDER BY duplicate_count DESC, peserta_id, period_id, service_type, normalized_no_tiket, indicator_id;

-- 2) Full row details for the duplicate groups, for manual review.
WITH duplicate_groups AS (
  SELECT
    peserta_id,
    period_id,
    service_type,
    LOWER(TRIM(no_tiket)) AS normalized_no_tiket,
    indicator_id
  FROM public.qa_temuan
  WHERE is_phantom_padding = false
    AND no_tiket IS NOT NULL
    AND TRIM(no_tiket) != ''
  GROUP BY 1, 2, 3, 4, 5
  HAVING COUNT(*) > 1
)
SELECT
  t.*,
  LOWER(TRIM(t.no_tiket)) AS normalized_no_tiket
FROM public.qa_temuan t
JOIN duplicate_groups d
  ON d.peserta_id = t.peserta_id
  AND d.period_id = t.period_id
  AND d.service_type = t.service_type
  AND d.normalized_no_tiket = LOWER(TRIM(t.no_tiket))
  AND d.indicator_id = t.indicator_id
WHERE t.is_phantom_padding = false
ORDER BY t.peserta_id, t.period_id, t.service_type, normalized_no_tiket, t.indicator_id, t.created_at NULLS LAST, t.id;

-- 3) Optional reviewed-delete template.
-- Replace the UUIDs below with duplicate row ids that have been explicitly approved
-- for removal, then run inside a transaction.
--
-- BEGIN;
-- DELETE FROM public.qa_temuan
-- WHERE id IN (
--   '00000000-0000-0000-0000-000000000000'
-- );
-- COMMIT;

-- 4) Re-run the summary query. It must return zero rows before retrying the
-- unique index migration.
