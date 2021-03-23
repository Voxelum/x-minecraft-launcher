import { FileExtension } from 'file-type/core'
import { PersistedResource } from '/@shared/entities/resource'
import { ResourceDomain, ResourceType } from '/@shared/entities/resource.schema'
export declare type ExpectFileType = string | '*' | 'mods' | 'forge' | 'fabric' | 'resourcepack' | 'liteloader' | 'curseforge-modpack' | 'save';
export interface ReadFileMetadataOptions {
  path: string;
  hint?: ExpectFileType;
  size?: number;
}
export interface ImportFileOptions {
  path: string;
  hint?: ExpectFileType;
  size?: number;
}
export interface FileMetadata {
  /**
   * Where the file import from
   */
  path: string;
  domain: ResourceDomain;
  type: ResourceType;
  fileType: FileExtension | 'unknown' | 'directory';
  existed: boolean;
  /**
   * Suggested display name
   */
  displayName: string;
  /**
   * Metadata of the file
   */
  metadata: any;
  uri: string[];
}
export interface FileCommitImportOptions {
  files: FileMetadata[];
}
export default class IOService {
  /**
   * Import the file to the launcher
   * @param options
   */
  importFile(options: ImportFileOptions): Promise<PersistedResource>;
  /**
   * Read an external file metadata. This can be used before the file drop into the launcher.
   */
  readFileMetadata(options: ReadFileMetadataOptions): Promise<FileMetadata>;
  readFilesMetadata(options: ReadFileMetadataOptions[]): Promise<FileMetadata[]>;
}
