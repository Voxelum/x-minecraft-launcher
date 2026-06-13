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
})
