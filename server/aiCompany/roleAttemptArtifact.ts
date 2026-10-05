/** Current own-output identity: legacy work-only files cannot satisfy this path. */
export function roleAttemptArtifactName(workId: string, attemptId: string | undefined): string {
  if (!/^[A-Za-z0-9:_-]+$/.test(workId) || !attemptId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(attemptId)) {
    throw new Error('role artifact requires safe work identity and actual claimed attempt');
  }
  return `role-output-${workId}-${attemptId}.md`;
}
