import { describe, expect, it, vi } from 'vitest'
import { useJavaInstallerCatalog } from './javaInstallerCatalog'

const definitions = [{ uid: 'vendor', title: 'Vendor', icon: 'icon' }]
const entries = [{ version: 'java17', sha256: 'metadata-17' }, { version: 'java21' }]
const runtime = (version: string, marker = 'build') => ({
  version,
  runtimeUrl: `https://example.test/${version}/${marker}`,
  displayVersion: `${version.slice(4)}.0.1`,
  name: marker,
  vendor: 'vendor',
  path: `/fixture/${version}/${marker}`,
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function fixture() {
  const service = {
    getSupportedMajorJavaVersions: vi.fn(async () => [17]),
    getJavaVendors: vi.fn(async (_force?: boolean) => [{ uid: 'vendor', name: 'Vendor' }]),
    getMajorJavaVersionsFromVendor: vi.fn(async (_vendor: string, _force?: boolean) => entries),
    getJavaRuntimes: vi.fn(async (_vendor: string, version: string, _sha?: string, _force?: boolean) => [runtime(version)]),
  }
  return { service, catalog: useJavaInstallerCatalog(service, definitions) }
}

describe('Java installer catalog recovery', () => {
  it('keeps the compatibility lookup failure visible and retries that lookup on refresh', async () => {
    const { service, catalog } = fixture()
    service.getSupportedMajorJavaVersions.mockRejectedValueOnce(new Error('compatibility lookup failed'))
    await catalog.reload(false)
    expect(catalog.error.value).toBe('compatibility lookup failed')
    expect(catalog.vendors.value).toEqual([])
    expect(catalog.loading.value).toBe(false)
    expect(service.getJavaVendors).not.toHaveBeenCalled()

    await catalog.reload(false, true)
    expect(service.getSupportedMajorJavaVersions).toHaveBeenCalledTimes(2)
    expect(service.getJavaVendors).toHaveBeenCalledWith(true)
    expect(service.getJavaRuntimes).toHaveBeenCalledWith('vendor', 'java17', 'metadata-17', true)
    expect(catalog.error.value).toBe('')
    expect(catalog.vendors.value[0].versions.map(v => v.version)).toEqual(['java17'])
  })

  it('still lists all builds when the optional compatibility lookup is unavailable', async () => {
    const { service, catalog } = fixture()
    service.getSupportedMajorJavaVersions.mockRejectedValue(new Error('no compatibility metadata'))
    await catalog.reload(true)
    expect(service.getSupportedMajorJavaVersions).not.toHaveBeenCalled()
    expect(catalog.error.value).toBe('')
    expect(catalog.vendors.value[0].versions.map(v => v.version)).toEqual(['java21', 'java17'])
  })

  it('distinguishes an empty compatible result from a failed lookup', async () => {
    const { service, catalog } = fixture()
    service.getSupportedMajorJavaVersions.mockResolvedValue([])
    await catalog.reload(false)
    expect(catalog.error.value).toBe('')
    expect(catalog.vendors.value[0]).toMatchObject({ versions: [], loading: false, error: '' })
    expect(service.getJavaRuntimes).not.toHaveBeenCalled()
  })

  it('does not let a slow compatible-only response replace the newer all-versions result', async () => {
    const { service, catalog } = fixture()
    const older = deferred<ReturnType<typeof runtime>[]>()
    service.getJavaRuntimes.mockReturnValueOnce(older.promise)
    const compatible = catalog.reload(false)
    await vi.waitFor(() => expect(service.getJavaRuntimes).toHaveBeenCalledTimes(1))
    const oldVendor = catalog.vendors.value[0]

    await catalog.reload(true)
    expect(catalog.vendors.value[0]).not.toBe(oldVendor)
    older.resolve([runtime('java17', 'old response')])
    await compatible
    expect(catalog.vendors.value[0].versions.map(v => v.version)).toEqual(['java21', 'java17'])
    expect(oldVendor.versions).toEqual([])
    expect(catalog.loading.value).toBe(false)
  })

  it('ignores a failed vendor response that arrives after a newer vendor retry', async () => {
    const { service, catalog } = fixture()
    const older = deferred<ReturnType<typeof runtime>[]>()
    const newer = deferred<ReturnType<typeof runtime>[]>()
    service.getJavaRuntimes.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const first = catalog.reload(false)
    await vi.waitFor(() => expect(service.getJavaRuntimes).toHaveBeenCalledTimes(1))
    const vendor = catalog.vendors.value[0]
    const retry = catalog.loadVendor(vendor, true)
    await vi.waitFor(() => expect(service.getJavaRuntimes).toHaveBeenCalledTimes(2))
    older.reject(new Error('obsolete error'))
    await first
    expect(vendor.loading).toBe(true)
    expect(vendor.error).toBe('')
    newer.resolve([runtime('java17', 'new result')])
    await retry
    expect(vendor).toMatchObject({ versions: [expect.objectContaining({ name: 'new result' })], loading: false, error: '' })
  })

  it('invalidates an outstanding catalog when the installer closes', async () => {
    const { service, catalog } = fixture()
    const original = deferred<number[]>()
    service.getSupportedMajorJavaVersions.mockReturnValueOnce(original.promise)
    const pending = catalog.reload(false)
    catalog.reset()
    original.reject(new Error('obsolete failure after close'))
    await pending
    expect(service.getJavaVendors).not.toHaveBeenCalled()
    expect(catalog.vendors.value).toEqual([])
    expect(catalog.error.value).toBe('')
    expect(catalog.loading.value).toBe(false)
  })
})
