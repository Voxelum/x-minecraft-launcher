import { Resource } from 'universal/store/modules/resource';
import { Issue } from 'universal/store/modules/diagnose';

export type Exceptions = IssueBlockedException | InstanceDeleteSaveException | FixVersionException | LaunchGeneralException | LaunchBlockedException | LaunchException | LoginException | InstanceImportSaveException | InstanceImportResourceException | InstanceCopySaveException | GeneralException | ResourceException;

export interface Exception {
    type: string;
}

export interface InstanceImportResourceException extends Exception {
    type: 'instanceImportIllegalResource';
    file: string;
}

export interface InstanceImportSaveException extends Exception {
    type: 'instanceImportIllegalSave';
    path: string;
}

export interface InstanceDeleteSaveException extends Exception {
    /**
     * - instanceDeleteNoSave -> no save match name provided
     */
    type: 'instanceDeleteNoSave';
    /**
     * The save name
     */
    name: string;
}

export interface InstanceCopySaveException extends Exception {
    type: 'instanceCopySaveNotFound' | 'instanceCopySaveUnexpected';
    src: string;
    dest: string[];
}

export interface ResourceException extends Exception {
    type: 'deployLinkResourceOccupied';
    resource: Resource<any>;
}

export interface GeneralException extends Exception {
    type: 'fsError' | 'issueFix';
    error: Error;
}

export interface LoginException extends Exception {
    type: 'loginInternetNotConnected' | 'loginInvalidCredentials' | 'loginGeneral';
    error: Error;
}

export interface LaunchException extends Exception {
    type: 'launchInstanceEmpty' | 'launchIllegalAuth' | 'launchBlockedIssues' | 'launchGeneralException';
}

export interface IssueBlockedException extends Exception {
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

export interface FixVersionException extends Exception {
    /**
     * - fixVersionNoVersionMetadata -> no minecraft version metadata.
     * - fixVersionNoForgeVersionMetadata -> no forge version metadata.
     */
    type: 'fixVersionNoVersionMetadata' | 'fixVersionNoForgeVersionMetadata';
    minecraft: string;
    forge?: string;
}

export function makeException(exception: Exceptions) {
    return exception;
}

export function assertOrThrow(v: unknown, f: () => Exceptions): asserts v {
    if (!v) throw f();
}

export async function assertSuccess<Z, T extends Exception>(v: Promise<Z>, f: (e: any) => T) {
    try {
        return await v;
    } catch (e) {
        throw f(e);
    }
}

export function isFileNoFound(e: unknown) {
    return typeof e === 'object' && e !== null && ('code' in e && (e as any).code === 'ENOENT');
}
