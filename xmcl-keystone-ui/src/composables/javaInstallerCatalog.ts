import type { VersionInstallService } from '@xmcl/runtime-api'
import { ref } from 'vue'

type CatalogService = Pick<VersionInstallService,
  'getSupportedMajorJavaVersions' | 'getJavaVendors' | 'getMajorJavaVersionsFromVendor' | 'getJavaRuntimes'>

export type JavaInstallerRuntime = Awaited<ReturnType<CatalogService['getJavaRuntimes']>>[number] & { sha256?: string }
type VendorDefinition = { uid: string; title: string; icon: string }

export interface JavaInstallerVendor {
  id: string
  title: string
  icon: string
  versions: JavaInstallerRuntime[]
  loading: boolean
  error: string
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error)

export function useJavaInstallerCatalog(service: CatalogService, definitions: readonly VendorDefinition[]) {
  const vendors = ref<JavaInstallerVendor[]>([])
  const error = ref('')
  const loading = ref(false)
  const supportedMajors = ref<number[]>()
  let catalogGeneration = 0
  const vendorGenerations = new WeakMap<JavaInstallerVendor, number>()

  function reset() {
    // Closing or reloading invalidates both the catalog and its vendor loads.
    ++catalogGeneration
    vendors.value = []
    error.value = ''
    loading.value = false
    supportedMajors.value = undefined
  }

  async function loadVendor(vendor: JavaInstallerVendor, force = false) {
    if (!vendors.value.includes(vendor)) return
    const catalog = catalogGeneration
    const generation = (vendorGenerations.get(vendor) ?? 0) + 1
    vendorGenerations.set(vendor, generation)
    const current = () => catalog === catalogGeneration && vendorGenerations.get(vendor) === generation
    const majors = supportedMajors.value
    vendor.error = ''
    vendor.loading = true
    try {
      const entries = await service.getMajorJavaVersionsFromVendor(vendor.id, force)
      if (!current()) return
      const selected = majors === undefined ? entries : entries.filter((entry) => {
        const major = Number(entry.version.match(/\d+/)?.[0] ?? 0)
        return majors.includes(major)
      })
      const expanded = await Promise.all(selected.map(async (entry) => {
        const runtimes = await service.getJavaRuntimes(vendor.id, entry.version, entry.sha256, force)
        return runtimes.map(runtime => ({ ...runtime, sha256: entry.sha256 }))
      }))
      if (!current()) return
      vendor.versions = expanded.flat().sort((a, b) =>
        b.displayVersion.localeCompare(a.displayVersion, undefined, { numeric: true }) ||
        (b.releaseTime ?? '').localeCompare(a.releaseTime ?? ''),
      )
    } catch (e) {
      if (current()) vendor.error = message(e)
    } finally {
      if (current()) vendor.loading = false
    }
  }

  async function reload(allVersions: boolean, force = false) {
    reset()
    const generation = catalogGeneration
    loading.value = true
    try {
      // A failure here is not an empty compatible catalog. All-versions mode
      // does not need this lookup and remains usable if it is unavailable.
      const majors = allVersions ? undefined : await service.getSupportedMajorJavaVersions()
      if (generation !== catalogGeneration) return
      const index = await service.getJavaVendors(force)
      if (generation !== catalogGeneration) return
      supportedMajors.value = majors
      const available = new Set(index.map(item => item.uid))
      vendors.value = definitions.filter(vendor => available.has(vendor.uid)).map(vendor => ({
        id: vendor.uid,
        title: vendor.title,
        icon: vendor.icon,
        versions: [],
        loading: false,
        error: '',
      }))
      await Promise.all(vendors.value.map(vendor => loadVendor(vendor, force)))
    } catch (e) {
      if (generation === catalogGeneration) error.value = message(e)
    } finally {
      if (generation === catalogGeneration) loading.value = false
    }
  }

  return { vendors, error, loading, supportedMajors, reload, loadVendor, reset }
}
