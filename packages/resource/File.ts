/**
 * The resource representing a file metadata
 */
export interface File {
  /**
   * The path of the resource file
   */
  path: string
  /**
   * The original file name when this resource is imported with extension.
   */
  fileName: string
  /**
   * The size of the resource
   * @default 0
   */
  size: number
  /**
   * The last modified time of the resource
   */
  mtime: number
  /**
   * The access time of the resource
   */
  atime: number
  /**
   * The create time of the resource
   */
  ctime: number
  /**
   * The ino of the file
   */
  ino: number
  /**
   * Is this file a directory
   */
  isDirectory: boolean
}
