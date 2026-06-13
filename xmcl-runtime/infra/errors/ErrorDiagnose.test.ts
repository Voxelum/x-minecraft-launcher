import { describe, expect, test, vi } from 'vitest'
import { ErrorDiagnose } from './ErrorDiagnose'

vi.mock('~/settings', () => ({ kSettings: Symbol('kSettings') }))

const makeApp = () => ({
  registry: { get: async () => ({ diskFullErrorSet: () => undefined }) },
}) as any

const sysErr = (code: string, message: string) => {
  const e: any = new Error(message)
  e.code = code
  e.errno = -1
  return e as Error
}

const namedSysErr = (name: string, code: string, message: string) => {
  const e: any = new Error(message)
  e.name = name
  e.code = code
  e.errno = -1
  return e as Error
}

describe('ErrorDiagnose - new regression suppressions', () => {
  test('EPERM is reported up to 3 times then suppressed', () => {
    const d = new ErrorDiagnose(makeApp())
    const err = sysErr('EPERM', "EPERM: operation not permitted, open 'foo.json'")
    expect(d.processError(err)).toBe(false)
    expect(d.processError(err)).toBe(false)
    expect(d.processError(err)).toBe(false)
    expect(d.processError(err)).toBe(true)
  })

  test.each(['EBUSY', 'EEXIST', 'EINVAL', 'EROFS', 'EIO', 'UNKNOWN'])(
    '%s is bucketed into the same N>3 throttle as EPERM', (code) => {
      const d = new ErrorDiagnose(makeApp())
      const err = sysErr(code, `${code}: filesystem error`)
      expect(d.processError(err)).toBe(false)
      expect(d.processError(err)).toBe(false)
      expect(d.processError(err)).toBe(false)
      expect(d.processError(err)).toBe(true)
    },
  )

  test('ClientAuthError device_code_expired is suppressed (user left dialog open)', () => {
    const d = new ErrorDiagnose(makeApp())
    const err: any = new Error('device_code_expired: Device code is expired.')
    err.name = 'ClientAuthError'
    expect(d.processError(err)).toBe(true)
  })

  test('ClientAuthError endpoints_resolution_error is suppressed (network/DNS)', () => {
    const d = new ErrorDiagnose(makeApp())
    const err: any = new Error('endpoints_resolution_error: Endpoints cannot be resolved')
    err.name = 'ClientAuthError'
    expect(d.processError(err)).toBe(true)
  })

  test('InstallInstanceFilesError EPERM on .install-profile is suppressed (AV/OneDrive)', () => {
    const d = new ErrorDiagnose(makeApp())
    const err = namedSysErr(
      'InstallInstanceFilesError',
      'EPERM',
      "EPERM: operation not permitted, open 'C:\\Users\\x\\.minecraftx\\instances\\foo\\.install-profile'",
    )
    expect(d.processError(err)).toBe(true)
  })

  test('Raw Error EPERM stat .install-profile (chokidar) is fully suppressed (not throttled)', () => {
    const d = new ErrorDiagnose(makeApp())
    // The exact production sample from user @range — chokidar's
    // internal stat surfaced as `name === 'Error'`. Previously fell
    // into the generic EPERM throttle (3 events visible per session).
    const err = sysErr(
      'EPERM',
      "EPERM: operation not permitted, stat 'C:\\Users\\range\\.minecraftx\\instances\\1.12.2-forge14.23.5.2859\\.install-profile'",
    )
    expect(d.processError(err)).toBe(true)
    expect(d.processError(err)).toBe(true)
  })

  test('InstanceInstallWatcherError (retagged chokidar error) is suppressed', () => {
    const d = new ErrorDiagnose(makeApp())
    const err = namedSysErr('InstanceInstallWatcherError', 'EBUSY', 'EBUSY: resource busy')
    expect(d.processError(err)).toBe(true)
  })

  test('Third-party API 5xx is suppressed (Modrinth/CurseForge/Yggdrasil)', () => {
    const d = new ErrorDiagnose(makeApp())
    const modrinth: any = new Error('Fail to fetch modrinth api https://api.modrinth.com/v2/version_files. Status=503. no available server')
    modrinth.name = 'ModerinthApiError'
    expect(d.processError(modrinth)).toBe(true)

    const ygg: any = new Error('504:<html><head><title>504 Gateway Time-out</title></head></html>')
    ygg.name = 'YggdrasilError'
    expect(d.processError(ygg)).toBe(true)

    const cf: any = new Error('CurseForge returned Status=502')
    cf.name = 'CurseforgeApiError'
    expect(d.processError(cf)).toBe(true)
  })

  test('Third-party API 4xx is still reported (real bug surface)', () => {
    const d = new ErrorDiagnose(makeApp())
    const err: any = new Error('Modrinth returned Status=400. id is invalid')
    err.name = 'ModerinthApiError'
    expect(d.processError(err)).toBe(false)
  })

  test('UpdateError with 5xx selfhost message is suppressed (#1456)', () => {
    const d = new ErrorDiagnose(makeApp())
    const err: any = new Error('Fail to get update from selfhost: <html>502 Bad Gateway</html>')
    err.name = 'UpdateError'
    err.status = 502
    expect(d.processError(err)).toBe(true)
  })

  test.each(['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ENETUNREACH'])(
    'UpdateError with network cause %s is suppressed', (code) => {
      const d = new ErrorDiagnose(makeApp())
      const cause: any = new Error(`fetch failed: ${code}`)
      cause.code = code
      const err: any = new Error('Fail to get update from selfhost: fetch failed')
      err.name = 'UpdateError'
      err.cause = cause
      expect(d.processError(err)).toBe(true)
    })

  test('UpdateError on rename/install failure is still reported (real bug)', () => {
    const d = new ErrorDiagnose(makeApp())
    const err: any = new Error('Fail to rename update the file: /tmp/foo.asar')
    err.name = 'UpdateError'
    err.cause = new Error('EACCES')
    expect(d.processError(err)).toBe(false)
  })
})
