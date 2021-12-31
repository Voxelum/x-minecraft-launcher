
import { promises as fs } from 'fs'
import { pid } from 'process'
import { Logger } from '@azure/msal-common'
import { isSystemError } from './error'

/**
 * Error thrown when trying to write MSAL cache to persistence.
 */
export class PersistenceError extends Error {
  // Short string denoting error
  errorCode: string
  // Detailed description of error
  errorMessage: string

  constructor(errorCode: string, errorMessage: string) {
    const errorString = errorMessage ? `${errorCode}: ${errorMessage}` : errorCode
    super(errorString)
    Object.setPrototypeOf(this, PersistenceError.prototype)

    this.errorCode = errorCode
    this.errorMessage = errorMessage
    this.name = 'PersistenceError'
  }

  /**
   * Error thrown when trying to access the file system.
   */
  static createFileSystemError(errorCode: string, errorMessage: string): PersistenceError {
    return new PersistenceError(errorCode, errorMessage)
  }

  /**
   * Error thrown when trying to write, load, or delete data from keychain on macOs.
   */
  static createKeychainPersistenceError(errorMessage: string): PersistenceError {
    return new PersistenceError('KeychainError', errorMessage)
  }
}

/**
 * An existing file was the target of an operation that required that the target not exist
 */
export const EEXIST_ERROR = 'EEXIST'

/**
 * No such file or directory: Commonly raised by fs operations to indicate that a component
 * of the specified pathname does not exist. No entity (file or directory) could be found
 * by the given path
 */
export const ENOENT_ERROR = 'ENOENT'

/**
 * Operation not permitted. An attempt was made to perform an operation that requires
 * elevated privileges.
 */
export const EPERM_ERROR = 'EPERM'

/**
 * Default service name for using MSAL Keytar
 */
export const DEFAULT_SERVICE_NAME = 'msal-node-extensions'

/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Options for CrossPlatform lock.
 *
 * retryNumber: Numbers of times we should try to acquire a lock. Defaults to 500.
 * retryDelay: Time to wait before trying to retry a lock acquisition. Defaults to 100 ms.
 */

export type CrossPlatformLockOptions = {
  retryNumber: number
  retryDelay: number
}

/**
 * Cross-process lock that works on all platforms.
 */
export class CrossPlatformLock {
  private readonly lockFilePath: string
  private lockFileHandle: fs.FileHandle | undefined
  private readonly retryNumber: number
  private readonly retryDelay: number

  private logger: Logger

  constructor(lockFilePath: string, logger: Logger, lockOptions?: CrossPlatformLockOptions) {
    this.lockFilePath = lockFilePath
    this.retryNumber = lockOptions ? lockOptions.retryNumber : 500
    this.retryDelay = lockOptions ? lockOptions.retryDelay : 100
    this.logger = logger
  }

  /**
   * Locks cache from read or writes by creating file with same path and name as
   * cache file but with .lockfile extension. If another process has already created
   * the lockfile, will back off and retry based on configuration settings set by CrossPlatformLockOptions
   */
  public async lock(): Promise<void> {
    for (let tryCount = 0; tryCount < this.retryNumber; tryCount++) {
      try {
        this.logger.info(`Pid ${pid} trying to acquire lock`)
        this.lockFileHandle = await fs.open(this.lockFilePath, 'wx+')

        this.logger.info(`Pid ${pid} acquired lock`)
        await this.lockFileHandle.write(pid.toString())
        return
      } catch (err) {
        if (isSystemError(err) && (err.code === EEXIST_ERROR || err.code === EPERM_ERROR)) {
          this.logger.info(err.toString())
          await this.sleep(this.retryDelay)
        } else {
          this.logger.error(`${pid} was not able to acquire lock. Ran into error: ${(err as any).message}`)
          // throw PersistenceError.createCrossPlatformLockError(err.message)
        }
      }
    }
    this.logger.error(`${pid} was not able to acquire lock. Exceeded amount of retries set in the options`)
    // throw PersistenceError.createCrossPlatformLockError(
    //   'Not able to acquire lock. Exceeded amount of retries set in options')
  }

  /**
   * unlocks cache file by deleting .lockfile.
   */
  public async unlock(): Promise<void> {
    try {
      if (this.lockFileHandle) {
        // if we have a file handle to the .lockfile, delete lock file
        await fs.unlink(this.lockFilePath)
        await this.lockFileHandle.close()
        this.logger.info('lockfile deleted')
      } else {
        this.logger.warning('lockfile handle does not exist, so lockfile could not be deleted')
      }
    } catch (err) {
      if (isSystemError(err) && err.code === ENOENT_ERROR) {
        this.logger.info('Tried to unlock but lockfile does not exist')
      } else {
        this.logger.error(`${pid} was not able to release lock. Ran into error: ${(err as any).message}`)
        // throw PersistenceError.createCrossPlatformLockError(err.message)
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }
}
