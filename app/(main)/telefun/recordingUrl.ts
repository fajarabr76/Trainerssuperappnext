export function getPersistableRecordingUrl(recordingUrl?: string | null): string {
  if (!recordingUrl || recordingUrl.startsWith('blob:')) return '';
  return recordingUrl;
}

export function getServerRecordRecordingUrl({
  recordingPath,
  persistedRecordingUrl,
  localRecordingUrl,
}: {
  recordingPath?: string | null;
  persistedRecordingUrl?: string | null;
  localRecordingUrl?: string | null;
}): string {
  if (recordingPath) return '';

  const persistableUrl = getPersistableRecordingUrl(persistedRecordingUrl);
  return persistableUrl || localRecordingUrl || '';
}

export function shouldRevokeOptimisticRecordingUrl(optimisticUrl?: string | null, replacementUrl?: string | null): boolean {
  return Boolean(optimisticUrl?.startsWith('blob:') && optimisticUrl !== replacementUrl);
}
