import { MicrosoftMinecraftXboxLoginError } from '@xmcl/user'

export function isAccountSuspendedError(error: unknown): error is MicrosoftMinecraftXboxLoginError {
  if (!(error instanceof MicrosoftMinecraftXboxLoginError) || error.status !== 403) return false
  try {
    return JSON.parse(error.body)?.details?.reason === 'ACCOUNT_SUSPENDED'
  } catch {
    return false
  }
}

export function isUserCanceledError(error: unknown) {
  return typeof (error as Error | undefined)?.message === 'string' &&
    /\buser_cancel(?:led|ed)\b/.test((error as Error).message)
}

export function isNetworkError(error: unknown) {
  const candidate = error as { errorCode?: unknown; message?: unknown } | undefined
  return candidate?.errorCode === 'network_error' ||
    (typeof candidate?.message === 'string' && /\bnetwork_error\b/.test(candidate.message))
}
