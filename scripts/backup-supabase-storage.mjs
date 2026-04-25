import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_FILTER = process.env.SUPABASE_STORAGE_BUCKETS;

const SCRIPT_DIR = import.meta.dirname
  ? import.meta.dirname
  : new URL('.', import.meta.url).pathname;
const ROOT_DIR = join(SCRIPT_DIR, '..');
const BACKUP_ROOT = join(ROOT_DIR, 'local-backups', 'supabase-storage');
const TIMESTAMP = new Date()
  .toISOString()
  .replace(/[:.]/g, '-')
  .replace(/T/, '-')
  .slice(0, 19);
const BACKUP_PATH = join(BACKUP_ROOT, TIMESTAMP);
const STORAGE_DIR = join(BACKUP_PATH, 'storage');

// ---------------------------------------------------------------------------
// Pre-flight
// ---------------------------------------------------------------------------
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function safePath(bucket, objectPath) {
  const normalized = normalize(join(bucket, objectPath));
  const parts = normalized.split(sep).filter((p) => p !== '..' && p !== '.');
  return parts.join(sep);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function appendJsonl(filePath, obj) {
  const line = JSON.stringify(obj) + '\n';
  writeFileSync(filePath, line, { flag: 'a' });
}

// ---------------------------------------------------------------------------
// Bucket discovery
// ---------------------------------------------------------------------------
async function discoverBuckets() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`Failed to list buckets: ${error.message}`);

  let buckets = data.map((b) => b.name);

  if (BUCKET_FILTER) {
    const allowed = BUCKET_FILTER.split(',').map((s) => s.trim());
    buckets = buckets.filter((b) => allowed.includes(b));
    console.log(`Bucket filter applied: ${allowed.join(', ')}`);
  }

  if (buckets.length === 0) {
    console.error('ERROR: No buckets found to backup.');
    process.exit(1);
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// Recursive listing
// ---------------------------------------------------------------------------
async function listAllObjects(bucket, prefix = '') {
  const allObjects = [];
  let offset = 0;
  const LIMIT = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, {
        limit: LIMIT,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) throw new Error(`Failed to list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const item of data) {
      if (item.metadata?.mimetype) {
        // This is a file
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        allObjects.push({ name: fullPath, ...item });
      } else {
        // This is a folder, recurse
        const folderPrefix = prefix ? `${prefix}/${item.name}` : item.name;
        const subObjects = await listAllObjects(bucket, folderPrefix);
        allObjects.push(...subObjects);
      }
    }

    if (data.length < LIMIT) break;
    offset += LIMIT;
  }

  return allObjects;
}

// ---------------------------------------------------------------------------
// Download a single object
// ---------------------------------------------------------------------------
async function downloadObject(bucket, objectPath, localPath) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(objectPath);

  if (error) throw new Error(`Download failed ${bucket}/${objectPath}: ${error.message}`);

  const buffer = Buffer.from(await data.arrayBuffer());
  mkdirSync(dirname(localPath), { recursive: true });
  writeFileSync(localPath, buffer);

  return {
    size: buffer.length,
    sha256: sha256(buffer),
  };
}

// ---------------------------------------------------------------------------
// Backup a single bucket
// ---------------------------------------------------------------------------
async function backupBucket(bucket, manifestPath, errorsPath) {
  console.log(`\n--- Bucket: ${bucket} ---`);

  const objects = await listAllObjects(bucket);
  console.log(`  Found ${objects.length} objects`);

  let downloaded = 0;
  let failed = 0;
  let totalBytes = 0;

  for (const obj of objects) {
    const safe = safePath(bucket, obj.name);
    const localPath = join(STORAGE_DIR, safe);
    const entry = {
      bucket,
      path: obj.name,
      localPath: safe,
      contentType: obj.metadata?.mimetype || 'unknown',
      lastModified: obj.metadata?.lastModified || null,
      etag: obj.metadata?.eTag || null,
      size: null,
      sha256: null,
      status: 'pending',
    };

    try {
      const { size, sha256: hash } = await downloadObject(
        bucket,
        obj.name,
        localPath
      );
      entry.size = size;
      entry.sha256 = hash;
      entry.status = 'ok';
      downloaded++;
      totalBytes += size;
    } catch (err) {
      entry.status = 'error';
      entry.error = err.message;
      failed++;
      appendJsonl(errorsPath, entry);
    }

    appendJsonl(manifestPath, entry);
  }

  console.log(`  Downloaded: ${downloaded}, Failed: ${failed}, Total: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  return { bucket, total: objects.length, downloaded, failed, totalBytes };
}

// ---------------------------------------------------------------------------
// Summary and notes
// ---------------------------------------------------------------------------
function writeSummary(results) {
  const summary = {
    timestamp: new Date().toISOString(),
    buckets: results.map((r) => ({
      bucket: r.bucket,
      totalObjects: r.total,
      downloaded: r.downloaded,
      failed: r.failed,
      totalBytes: r.totalBytes,
    })),
    totalObjects: results.reduce((s, r) => s + r.total, 0),
    totalDownloaded: results.reduce((s, r) => s + r.downloaded, 0),
    totalFailed: results.reduce((s, r) => s + r.failed, 0),
    totalBytes: results.reduce((s, r) => s + r.totalBytes, 0),
  };

  writeFileSync(
    join(BACKUP_PATH, 'storage-summary.json'),
    JSON.stringify(summary, null, 2) + '\n'
  );

  return summary;
}

function writeRestoreNotes() {
  writeFileSync(
    join(BACKUP_PATH, 'restore-storage-notes.md'),
    `# Restore Storage Backup

## Manual Restore to Supabase Storage

### 1. Create target buckets (if not exists)

\`\`\`sql
-- In Supabase SQL Editor or via Admin API
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('profiler-foto', 'profiler-foto', true),
  ('reports', 'reports', false),
  ('telefun-recordings', 'telefun-recordings', false)
ON CONFLICT (id) DO NOTHING;
\`\`\`

### 2. Upload files back

Use Supabase Dashboard, CLI, or Admin API to upload files from the \`storage/\` folder:

\`\`\`bash
# Example with Supabase CLI
supabase storage cp storage/profiler-foto profiler-foto --recursive
supabase storage cp storage/reports reports --recursive
supabase storage cp storage/telefun-recordings telefun-recordings --recursive
\`\`\`

Or programmatically with the Admin SDK:

\`\`\`js
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabase = createClient(URL, SERVICE_ROLE_KEY);

// Upload a single file
const file = readFileSync(join('storage', 'profiler-foto', 'path/to/file.jpg'));
await supabase.storage.from('profiler-foto').upload('path/to/file.jpg', file);
\`\`\`

### 3. Verify against manifest

Compare uploaded files with \`storage-manifest.jsonl\`:
- Each line contains \`bucket\`, \`path\`, \`sha256\`, and \`size\`.
- Download files from target and compare SHA256 hashes.

## Important Notes

1. This backup contains PII and internal documents. Handle with care.
2. \`profiler-foto\` bucket is public; \`reports\` and \`telefun-recordings\` are private.
3. RLS policies on \`storage.objects\` are NOT backed up here.
   They live in the database backup (\`pg_dump\`).
4. File paths are preserved exactly as stored in Supabase.
`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('========================================');
  console.log(' Supabase Storage Backup');
  console.log(` Time: ${new Date().toISOString()}`);
  console.log('========================================');

  mkdirSync(STORAGE_DIR, { recursive: true });

  const manifestPath = join(BACKUP_PATH, 'storage-manifest.jsonl');
  const errorsPath = join(BACKUP_PATH, 'storage-errors.jsonl');

  // Clear previous runs for this timestamp
  writeFileSync(manifestPath, '');
  writeFileSync(errorsPath, '');

  const buckets = await discoverBuckets();
  const results = [];

  for (const bucket of buckets) {
    const result = await backupBucket(bucket, manifestPath, errorsPath);
    results.push(result);
  }

  const summary = writeSummary(results);
  writeRestoreNotes();

  console.log('\n========================================');
  console.log(` Backup complete: ${BACKUP_PATH}`);
  console.log(` Total objects: ${summary.totalObjects}`);
  console.log(` Downloaded: ${summary.totalDownloaded}`);
  console.log(` Failed: ${summary.totalFailed}`);
  console.log(` Total size: ${(summary.totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log('========================================');

  if (summary.totalFailed > 0) {
    console.error(`\nWARNING: ${summary.totalFailed} file(s) failed. See storage-errors.jsonl`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
