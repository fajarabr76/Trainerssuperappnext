#!/usr/bin/env bash
set -euo pipefail

# Auto-detect Homebrew libpq (keg-only on macOS)
if [[ -d /usr/local/opt/libpq/bin ]]; then
  export PATH="/usr/local/opt/libpq/bin:$PATH"
elif [[ -d /opt/homebrew/opt/libpq/bin ]]; then
  export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
fi

###############################################################################
# backup-supabase.sh
#
# Local Supabase backup using pg_dump. Produces a timestamped folder under
# local-backups/supabase/ with custom dump, schema-only SQL, data-only SQL,
# row counts, metadata, and restore notes.
#
# Usage:
#   SUPABASE_DB_URL="postgresql://..." npm run backup:supabase
#   SUPABASE_DB_URL="postgresql://..." BACKUP_MODE=public bash scripts/backup-supabase.sh
#
# Modes:
#   public        (default) - schema + data for public schema only
#   supabase-full - includes auth, storage, and other Supabase-managed schemas
#   data-only     - data only, no schema
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DB_URL="${SUPABASE_DB_URL:-}"
BACKUP_MODE="${BACKUP_MODE:-public}"
BACKUP_ROOT="$ROOT_DIR/local-backups/supabase"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_PATH="$BACKUP_ROOT/$TIMESTAMP"

# Portable defaults for Neon/external Postgres restore
PG_DUMP_COMMON=(--no-owner --no-privileges --verbose)

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if [[ -z "$DB_URL" ]]; then
  echo "ERROR: SUPABASE_DB_URL is not set." >&2
  echo "Set it to a direct (unpooled) Supabase Postgres connection string." >&2
  exit 1
fi

for cmd in pg_dump pg_restore psql; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' is required but not found in PATH." >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Create backup directory
# ---------------------------------------------------------------------------
mkdir -p "$BACKUP_PATH"
echo "Backup directory: $BACKUP_PATH"

# ---------------------------------------------------------------------------
# Helper: extract host from connection string for metadata
# ---------------------------------------------------------------------------
extract_host() {
  local url="$1"
  # Strip protocol
  local stripped="${url#*://}"
  # Strip userinfo (user:pass@)
  stripped="${stripped#*@}"
  # Strip path (/dbname)
  stripped="${stripped%%/*}"
  # Strip port if present, keep host
  echo "${stripped%%:*}"
}

DB_HOST="$(extract_host "$DB_URL")"
PG_DUMP_VERSION="$(pg_dump --version)"
PSQL_VERSION="$(psql --version)"

# ---------------------------------------------------------------------------
# Mode: public (default)
# ---------------------------------------------------------------------------
backup_public() {
  echo "--- Custom format dump (public schema) ---"
  pg_dump "$DB_URL" \
    --format=custom \
    "${PG_DUMP_COMMON[@]}" \
    --schema=public \
    --file "$BACKUP_PATH/public.dump"

  echo "--- Schema-only dump (public schema) ---"
  pg_dump "$DB_URL" \
    --format=plain \
    "${PG_DUMP_COMMON[@]}" \
    --schema=public \
    --schema-only \
    --file "$BACKUP_PATH/public.schema.sql"

  echo "--- Data-only dump (public schema) ---"
  pg_dump "$DB_URL" \
    --format=plain \
    "${PG_DUMP_COMMON[@]}" \
    --schema=public \
    --data-only \
    --file "$BACKUP_PATH/public.data.sql"
}

# ---------------------------------------------------------------------------
# Mode: supabase-full
# ---------------------------------------------------------------------------
backup_supabase_full() {
  echo "WARNING: supabase-full mode includes auth, storage, and other" >&2
  echo "Supabase-managed schemas. This may NOT be portable to Neon." >&2

  echo "--- Custom format dump (full database) ---"
  pg_dump "$DB_URL" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --verbose \
    --file "$BACKUP_PATH/full.dump"

  echo "--- Schema-only dump (full database) ---"
  pg_dump "$DB_URL" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --verbose \
    --schema-only \
    --file "$BACKUP_PATH/full.schema.sql"

  echo "--- Data-only dump (full database) ---"
  pg_dump "$DB_URL" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --verbose \
    --data-only \
    --file "$BACKUP_PATH/full.data.sql"
}

# ---------------------------------------------------------------------------
# Mode: data-only
# ---------------------------------------------------------------------------
backup_data_only() {
  echo "--- Data-only dump (public schema) ---"
  pg_dump "$DB_URL" \
    --format=plain \
    "${PG_DUMP_COMMON[@]}" \
    --schema=public \
    --data-only \
    --file "$BACKUP_PATH/public.data.sql"

  echo "--- Custom format data-only dump (public schema) ---"
  pg_dump "$DB_URL" \
    --format=custom \
    "${PG_DUMP_COMMON[@]}" \
    --schema=public \
    --data-only \
    --file "$BACKUP_PATH/public-data.dump"
}

# ---------------------------------------------------------------------------
# Row counts
# ---------------------------------------------------------------------------
dump_table_counts() {
  echo "--- Table row counts (exact) ---"
  psql "$DB_URL" -t -A -c "
    SELECT 'public.' || tablename || ': ' || (xpath('/row/cnt/text()', xml_count))[1]::text
    FROM (
      SELECT tablename,
             query_to_xml(format('SELECT count(*) AS cnt FROM public.%I', tablename), false, true, '') AS xml_count
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    ) t;
  " > "$BACKUP_PATH/table-counts.txt" 2>/dev/null || {
    # Fallback to pg_stat_user_tables if exact count fails (slow on large tables)
    echo "WARNING: Exact count failed, falling back to pg_stat_user_tables (estimates)" >&2
    psql "$DB_URL" -t -A -c "
      SELECT schemaname || '.' || relname || ': ' || n_live_tup
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY relname;
    " > "$BACKUP_PATH/table-counts.txt" 2>/dev/null || {
      echo "(row counts unavailable)" > "$BACKUP_PATH/table-counts.txt"
    }
  }
}

# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------
write_meta() {
  local mode="$1"
  cat > "$BACKUP_PATH/backup-meta.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backup_mode": "$mode",
  "db_host": "$DB_HOST",
  "pg_dump_version": "$PG_DUMP_VERSION",
  "psql_version": "$PSQL_VERSION",
  "portable_flags": ["--no-owner", "--no-privileges"],
  "artifacts": $(
    ls -1 "$BACKUP_PATH" | grep -v 'backup-meta.json' | grep -v 'restore-notes.md' | \
    python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))" 2>/dev/null || \
    ls -1 "$BACKUP_PATH" | grep -v 'backup-meta.json' | grep -v 'restore-notes.md' | \
    jq -R '.' | jq -s '.' 2>/dev/null || \
    echo '[]'
  )
}
EOF
}

# ---------------------------------------------------------------------------
# Restore notes
# ---------------------------------------------------------------------------
write_restore_notes() {
  local mode="$1"
  local primary_dump=""
  local schema_sql=""
  local data_sql=""
  local scope_note=""

  case "$mode" in
    public)
      primary_dump="public.dump"
      schema_sql="public.schema.sql"
      data_sql="public.data.sql"
      scope_note="This backup covers only the \`public\` schema (application data)."
      ;;
    supabase-full)
      primary_dump="full.dump"
      schema_sql="full.schema.sql"
      data_sql="full.data.sql"
      scope_note="This backup includes Supabase-managed schemas (\`auth\`, \`storage\`). Restore to Neon may require manual adjustments."
      ;;
    data-only)
      primary_dump="public-data.dump"
      schema_sql=""
      data_sql="public.data.sql"
      scope_note="This backup contains data only (no schema). Target database must already have matching schema."
      ;;
  esac

  cat > "$BACKUP_PATH/restore-notes.md" <<ENDNOTES
# Restore Notes

**Mode:** $mode
**Scope:** $scope_note

## Quick Restore to Neon / External Postgres

### Using pg_restore (recommended)

\`\`\`bash
pg_restore \\
  --verbose \\
  --no-owner \\
  --no-privileges \\
  --dbname "\$TARGET_DATABASE_URL" \\
  $primary_dump
\`\`\`
$(if [[ -n "$schema_sql" ]]; then cat <<SCHEMA

### Using psql (schema SQL)

\`\`\`bash
psql "\$TARGET_DATABASE_URL" -f $schema_sql
\`\`\`
SCHEMA
fi)

### Using psql (data SQL)

\`\`\`bash
psql "\$TARGET_DATABASE_URL" -f $data_sql
\`\`\`

## Important Notes

1. Use an **unpooled** Neon connection string (not PgBouncer pooled).
2. \`--no-owner --no-privileges\` ensures compatibility with Neon's managed roles.
3. Supabase Auth (\`auth\` schema), Storage (\`storage\` schema), and RLS policies
   are NOT included in \`public\` mode. These require separate migration planning.
4. Supabase Storage **object files** (photos, documents) are NOT in this backup.
   Only metadata tables are captured. Back up the Storage bucket separately.
5. This backup contains PII. Handle with care and do not commit to git.

## Verify After Restore

\`\`\`bash
psql "\$TARGET_DATABASE_URL" -c "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables ORDER BY schemaname, tablename;"
\`\`\`

Compare row counts with \`table-counts.txt\` from this backup folder.
ENDNOTES
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "========================================"
echo " Supabase Local Backup"
echo " Mode: $BACKUP_MODE"
echo " Time: $(date)"
echo "========================================"

case "$BACKUP_MODE" in
  public)
    backup_public
    ;;
  supabase-full)
    backup_supabase_full
    ;;
  data-only)
    backup_data_only
    ;;
  *)
    echo "ERROR: Unknown BACKUP_MODE='$BACKUP_MODE'. Use: public, supabase-full, data-only" >&2
    exit 1
    ;;
esac

dump_table_counts
write_meta "$BACKUP_MODE"
write_restore_notes "$BACKUP_MODE"

echo ""
echo "========================================"
echo " Backup complete: $BACKUP_PATH"
echo "========================================"
ls -lh "$BACKUP_PATH"
