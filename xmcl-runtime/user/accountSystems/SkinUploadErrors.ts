import { SetSkinError } from '@xmcl/user'
import { UserException } from '@xmcl/runtime-api'

export function toSkinUploadException(error: unknown): UserException | undefined {
  if (!(error instanceof SetSkinError)) return undefined

  const reason = /\b(?:invalid|banned)\s+(?:skin\s+)?image\b/i.test(error.errorMessage)
    ? 'INVALID_IMAGE'
    : 'REQUEST_REJECTED'
  return new UserException(
    { type: 'userSetSkinFailed', reason },
    'Minecraft rejected the skin upload',
    { cause: error },
  )
}
