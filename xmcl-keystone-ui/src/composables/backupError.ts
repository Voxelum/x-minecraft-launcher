/** IPC errors may retain service-specific fields on the serialized exception. */
export function formatBackupError(error: unknown): { message: string; recoveryPath: string } {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : undefined
  const exception = value?.exception && typeof value.exception === 'object' ? value.exception as Record<string, unknown> : undefined
  const recoveryPath = value?.recoveryPath ?? exception?.recoveryPath
  return {
    message: typeof value?.message === 'string' && value.message.trim()
      ? value.message
      : typeof exception?.message === 'string' && exception.message.trim()
        ? exception.message
        : typeof value?.name === 'string' && value.name.trim()
          ? value.name
          : 'Backup operation failed or was cancelled.',
    recoveryPath: typeof recoveryPath === 'string' ? recoveryPath : '',
  }
}
