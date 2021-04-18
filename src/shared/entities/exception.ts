import { AnyResource, PersistedResource } from '/@shared/entities/resource'
import { Issue } from '/@shared/entities/issue'

export type Exceptions = InstanceNotFoundException | ResourceNotFoundException | ResourceImportDirectoryException | ResourceDomainMissmatchedException | MinecraftProfileError | PingServerException | UserNoProfilesException | CurseforgeModpackImportException | IssueBlockedException | InstanceDeleteSaveException | FixVersionException | LaunchGeneralException | LaunchBlockedException | LaunchException | LoginException | InstanceImportSaveException | InstanceImportResourceException | InstanceCopySaveException | GeneralException | ResourceException

export interface ExceptionBase {
  type: string
}

export class Exception extends Error implements ExceptionBase {
  type: string

  constructor(readonly exception: Exceptions, message?: string) {
    super(message)
    this.type = exception.type
    Object.assign(this, exception)
  }

  static from(error: Error, exception: Exceptions): Exception {
    return Object.assign(error, exception) as Exception
  }
}

export interface InstanceNotFoundException extends ExceptionBase {
  type: 'instanceNotFound'
  instancePath: string
}

export interface InstanceImportResourceException extends ExceptionBase {
  type: 'instanceImportIllegalResource'
  file: string
}

export interface ResourceDomainMissmatchedException extends ExceptionBase {
  type: 'resourceDomainMissmatched'
  path: string
  expectedDomain: string
  actualDomain: string
  actualType: string
}

export interface ResourceImportDirectoryException extends ExceptionBase {
  type: 'resourceImportDirectoryException'
  path: string
}

export interface ResourceNotFoundException extends ExceptionBase {
  type: 'resourceNotFoundException'
  resource: string | AnyResource
}

export interface InstanceImportSaveException extends ExceptionBase {
  type: 'instanceImportIllegalSave'
  path: string
}

export interface InstanceDeleteSaveException extends ExceptionBase {
  /**
   * - instanceDeleteNoSave -> no save match name provided
   */
  type: 'instanceDeleteNoSave'
  /**
   * The save name
   */
  name: string
}

export interface InstanceCopySaveException extends ExceptionBase {
  type: 'instanceCopySaveNotFound' | 'instanceCopySaveUnexpected'
  src: string
  dest: string[]
}

export interface ResourceException extends ExceptionBase {
  type: 'deployLinkResourceOccupied'
  resource: PersistedResource<any>
}

export interface GeneralException extends ExceptionBase {
  type: 'fsError' | 'issueFix' | 'general'
  error: Error
}

export interface LoginException extends ExceptionBase {
  type: 'loginInternetNotConnected' | 'loginInvalidCredentials' | 'loginGeneral'
}

export interface CurseforgeModpackImportException extends ExceptionBase {
  type: 'invalidCurseforgeModpack' | 'requireCurseforgeModpackAFile'
  path: string
}

export interface LaunchException extends ExceptionBase {
  type: 'launchInstanceEmpty' | 'launchIllegalAuth' | 'launchBlockedIssues' | 'launchGeneralException' | 'launchNoVersionInstalled'
}

export interface IssueBlockedException extends ExceptionBase {
  type: 'issueBlocked'
  issues: Issue[]
}

export interface LaunchBlockedException extends LaunchException {
  type: 'launchBlockedIssues'
  issues: Issue[]
}

export interface LaunchGeneralException extends LaunchException {
  type: 'launchGeneralException'
  error: any
}

export interface FixVersionException extends ExceptionBase {
  /**
   * - fixVersionNoVersionMetadata -> no minecraft version metadata.
   * - fixVersionNoForgeVersionMetadata -> no forge version metadata.
   */
  type: 'fixVersionNoVersionMetadata' | 'fixVersionNoForgeVersionMetadata'
  minecraft: string
  forge?: string
}

export interface UserNoProfilesException extends ExceptionBase {
  type: 'userNoProfiles'
  authService: string
  profileService: string
  username: string
}

export interface PingServerException extends ExceptionBase {
  type: 'pingServerTimeout' | 'pingServerNotFound' | 'pingServerRefused'
  host: string
  port: number
}

export interface MinecraftProfileError extends ExceptionBase {
  type: 'fetchMinecraftProfileFailed'
  path: '/minecraft/profile'
  errorType: 'NOT_FOUND' | string
  error: string | 'NOT_FOUND'
  errorMessage: string
  developerMessage: string
}

export function isFileNoFound(e: unknown) {
  return typeof e === 'object' && e !== null && ('code' in e && (e as any).code === 'ENOENT')
}

export function wrapError(e: Error, exception: Exceptions) {
  Object.assign(e, exception)
  return e
}
