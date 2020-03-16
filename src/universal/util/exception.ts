import { Resource } from '@universal/store/modules/resource';
import { Issue } from '@universal/store/modules/diagnose';

export type Exceptions = CurseforgeModpackImportException | IssueBlockedException | InstanceDeleteSaveException | FixVersionException | LaunchGeneralException | LaunchBlockedException | LaunchException | LoginException | InstanceImportSaveException | InstanceImportResourceException | InstanceCopySaveException | GeneralException | ResourceException;

export interface ExceptionBase {
    type: string;
}

export class Exception extends Error implements ExceptionBase {
    type: string;

    constructor(readonly exception: Exceptions, message?: string) {
        super(message);
        this.type = exception.type;
        Object.assign(this, exception);
    }
}

export interface InstanceImportResourceException extends ExceptionBase {
    type: 'instanceImportIllegalResource';
    file: string;
}

export interface InstanceImportSaveException extends ExceptionBase {
    type: 'instanceImportIllegalSave';
    path: string;
}

export interface InstanceDeleteSaveException extends ExceptionBase {
    /**
     * - instanceDeleteNoSave -> no save match name provided
     */
    type: 'instanceDeleteNoSave';
    /**
     * The save name
     */
    name: string;
}

export interface InstanceCopySaveException extends ExceptionBase {
    type: 'instanceCopySaveNotFound' | 'instanceCopySaveUnexpected';
    src: string;
    dest: string[];
}

export interface ResourceException extends ExceptionBase {
    type: 'deployLinkResourceOccupied';
    resource: Resource<any>;
}

export interface GeneralException extends ExceptionBase {
    type: 'fsError' | 'issueFix';
    error: Error;
}

export interface LoginException extends ExceptionBase {
    type: 'loginInternetNotConnected' | 'loginInvalidCredentials' | 'loginGeneral';
    error: Error;
}

export interface CurseforgeModpackImportException extends ExceptionBase {
    type: 'invalidCurseforgeModpack' | 'requireCurseforgeModpackAFile';
    path: string;
}

export interface LaunchException extends ExceptionBase {
    type: 'launchInstanceEmpty' | 'launchIllegalAuth' | 'launchBlockedIssues' | 'launchGeneralException';
}

export interface IssueBlockedException extends ExceptionBase {
    type: 'issueBlocked';
    issues: Issue[];
}

export interface LaunchBlockedException extends LaunchException {
    type: 'launchBlockedIssues';
    issues: Issue[];
}

export interface LaunchGeneralException extends LaunchException {
    type: 'launchGeneralException';
    error: any;
}

export interface FixVersionException extends ExceptionBase {
    /**
     * - fixVersionNoVersionMetadata -> no minecraft version metadata.
     * - fixVersionNoForgeVersionMetadata -> no forge version metadata.
     */
    type: 'fixVersionNoVersionMetadata' | 'fixVersionNoForgeVersionMetadata';
    minecraft: string;
    forge?: string;
}

export function isFileNoFound(e: unknown) {
    return typeof e === 'object' && e !== null && ('code' in e && (e as any).code === 'ENOENT');
}
