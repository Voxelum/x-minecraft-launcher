<template>
  <v-dialog
    v-model="isShown"
    aria-labelledby="java-installer-title"
    class="setting-page"
    max-width="950"
    transition="dialog-transition"
  >
    <v-card class="rounded-xl overflow-hidden java-installer-card">
      <!-- Toolbar Header -->
      <v-toolbar color="surface" density="comfortable" class="px-5 border-b">
        <v-avatar size="32" color="primary" class="mr-3" variant="tonal">
          <v-icon size="20">coffee</v-icon>
        </v-avatar>

        <v-toolbar-title id="java-installer-title" class="text-subtitle-1 font-weight-bold">
          {{ t('setting.installJava') }}
        </v-toolbar-title>

        <v-spacer />

        <div class="flex flex-wrap justify-end items-center gap-2 m-2">
          <v-switch
            v-model="showAllVersions"
            density="compact"
            hide-details
            color="primary"
            :label="t('setting.javaInstaller.showAllVersions')"
          />

          <v-btn
            v-shared-tooltip="() => t('shared.refresh')"
            data-testid="java-metadata-refresh"
            :aria-label="t('shared.refresh')"
            icon
            variant="text"
            density="comfortable"
            size="small"
            @click="refreshCatalog(true)"
          >
            <v-icon>refresh</v-icon>
          </v-btn>

          <v-btn
            v-shared-tooltip="() => t('shared.openFolder')"
            :aria-label="t('shared.openFolder')"
            icon
            variant="text"
            size="small"
            :disabled="!javaInstallDirectory"
            @click="openJavaInstallDirectory"
          >
            <v-icon>folder_open</v-icon>
          </v-btn>
          <v-btn
            v-shared-tooltip="() => t('shared.close')"
            :aria-label="t('shared.close')"
            icon
            variant="text"
            size="small"
            data-testid="java-installer-close"
            @click="hide"
          >
            <v-icon>close</v-icon>
          </v-btn>
        </div>
      </v-toolbar>

      <!-- Main Content -->
      <div class="content-layout">
        <!-- Sidebar -->
        <v-list ref="sidebarContainer" class="setting-sidebar visible-scroll" density="compact" nav>
          <template v-for="(vendor, vendorIndex) in vendors" :key="vendor.id">
            <div>
              <!-- Vendor -->
              <v-list-item
                :id="`sidebar-${vendor.id}`"
                :active="activeVendorIndex === vendorIndex"
                class="vendor-nav-item"
                color="primary"
                rounded="lg"
                :title="vendor.title"
                @click="scrollTo(vendor.id)"
              >
                <template #prepend>
                  <span>
                    <SettingIcon :icon="vendor.icon" :size="24" class="mr-2" />
                  </span>
                </template>
                <template #append>
                  <v-progress-circular v-if="vendor.loading" indeterminate size="14" width="2" />
                </template>
              </v-list-item>

              <!-- Nested Java Versions -->
              <div class="version-navigation">
                <v-list-item
                  v-for="version in getVendorVersionGroups(vendor)"
                  :key="version.id"
                  :id="`sidebar-${vendor.id}-${version.id}`"
                  :active="activeVersionId === `${vendor.id}-${version.id}`"
                  density="compact"
                  color="primary"
                  rounded="lg"
                  @click="scrollTo(`${vendor.id}-${version.id}`)"
                >
                  <template #prepend>
                    <v-icon size="small"> coffee </v-icon>
                  </template>

                  <v-list-item-title class="text-body-2">
                    {{ version.title }}
                  </v-list-item-title>
                </v-list-item>
              </div>
            </div>
          </template>
        </v-list>

        <v-divider vertical />

        <!-- Main Scroll Container -->
        <div
          ref="scrollContainer"
          class="scroll-container visible-scroll"
          @scroll="onScroll"
          @scrollend="onScrollEnd"
        >
          <v-alert v-if="installError" type="error" variant="tonal" closable @click:close="installError = ''">
            {{ installError }}
          </v-alert>
          <v-alert v-if="catalogError" type="error" variant="tonal">
            {{ catalogError }}
            <template #append>
              <v-btn size="small" variant="text" @click="refreshCatalog(true)">
                {{ t('setting.javaInstaller.retry') }}
              </v-btn>
            </template>
          </v-alert>
          <div v-else-if="loading && vendors.length === 0" class="d-flex justify-center pa-10">
            <v-progress-circular indeterminate color="primary" />
          </div>
          <div v-else-if="!loading && vendors.length === 0" class="text-medium-emphasis pa-3">
            {{ t('setting.javaInstaller.noCompatibleBuilds') }}
          </div>
          <!-- Vendors -->
          <div v-for="vendor in vendors" :key="vendor.id">
            <section :id="vendor.id" class="scroll-target" role="region" :aria-label="vendor.title">
              <SettingHeader
                :title="vendor.title"
                :icon="vendor.icon"
                class="vendor-content-header"
              />
              <v-alert v-if="vendor.error" type="error" variant="tonal" class="mb-3">
                {{ vendor.error }}
                <template #append>
                  <v-btn size="small" variant="text" @click="retryVendor(vendor)">
                    {{ t('setting.javaInstaller.retry') }}
                  </v-btn>
                </template>
              </v-alert>
              <div
                v-else-if="!vendor.loading && getVendorVersionGroups(vendor).length === 0"
                class="text-medium-emphasis pa-3"
              >
                {{ t('setting.javaInstaller.noCompatibleBuilds') }}
              </div>
              <!-- Java Versions -->
              <div
                v-for="version in getVendorVersionGroups(vendor)"
                :key="version.id"
                class="version-section"
              >
                <section
                  :id="`${vendor.id}-${version.id}`"
                  class="scroll-target"
                  role="region"
                  :aria-label="version.title"
                >
                  <SettingHeader :title="version.title" />

                  <!-- Installation Packages -->
                  <div
                    v-for="(subItem, subItemIndex) in getVendorVersions(vendor, version.major)"
                    :key="subItem.runtimeUrl || `${subItem.version}-${subItem.displayVersion}`"
                  >
                    <section
                      :id="`${vendor.id}-${version.id}-${subItemIndex}`"
                      class="java-version-item"
                      role="region"
                      :aria-label="subItem.version"
                    >
                      <div class="d-flex align-center justify-space-between pa-3">
                        <div>
                          <div class="text-subtitle-2">
                            {{ formatJavaRuntimeVersion(subItem.displayVersion) }}
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            {{
                              [
                                subItem.name,
                                subItem.packageType,
                                subItem.releaseTime ? getDateString(subItem.releaseTime) : '',
                              ]
                                .filter(Boolean)
                                .join(' · ') || `Java ${version.major}`
                            }}
                          </div>
                        </div>

                        <v-btn
                          color="primary"
                          variant="tonal"
                          :loading="
                            installing === `${vendor.id}/${subItem.version}/${subItem.runtimeUrl}`
                          "
                          :disabled="!!installing || isInstalled(subItem)"
                          @click="installVersion(vendor, subItem)"
                        >
                          {{ !isInstalled(subItem) ? t('shared.install') : t('shared.installed') }}
                        </v-btn>
                      </div>
                    </section>
                  </div>
                </section>
              </div>
            </section>
          </div>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { nextTick, ref, watch } from 'vue'
import SettingHeader from '@/components/SettingHeader.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { useDialog } from '@/composables/dialog'
import { useService } from '@/composables'
import { javaVendors, kJavaContext } from '@/composables/java'
import { useJavaInstallerCatalog, type JavaInstallerRuntime as RuntimeVersion, type JavaInstallerVendor as JavaVendor } from '@/composables/javaInstallerCatalog'
import { VersionInstallServiceKey, JavaServiceKey, BaseServiceKey } from '@xmcl/runtime-api'
import { injection } from '@/util/inject'
import { useDateString } from '@/composables/date'
import { formatJavaRuntimeVersion, isJavaRuntimeInstalled } from '@/util/javaState'
import SettingIcon from '@/components/SettingIcon.vue'

const { t } = useI18n()
const { isShown, hide } = useDialog('java-installer')
const installService = useService(VersionInstallServiceKey)
const { install } = installService
const { vendors, loading, error: catalogError, supportedMajors, reload, loadVendor, reset } = useJavaInstallerCatalog(installService, javaVendors)
const { refreshLocalJava } = useService(JavaServiceKey)
const { getGameDataDirectory, openDirectory } = useService(BaseServiceKey)
const { getDateString } = useDateString()
const { all: javas } = injection(kJavaContext)

const activeVendorIndex = ref(0)
const activeVersionId = ref<string | null>(null)
const scrollContainer = ref<HTMLElement | null>(null)
const sidebarContainer = ref<any>(null)
const installError = ref('')
const installing = ref('')
const showAllVersions = ref(false)
const javaInstallDirectory = ref('')

function getMajor(version: RuntimeVersion) {
  const normalized = version.displayVersion.replace(/^1\./, '')
  const match = normalized.match(/(?:java)?(\d{1,2})/i)
  return match ? Number(match[1]) : 0
}

function getVendorVersions(vendor: JavaVendor, major: number) {
  return vendor.versions.filter((version) => getMajor(version) === major)
}

async function openJavaInstallDirectory() {
  if (javaInstallDirectory.value) openDirectory(javaInstallDirectory.value)
}

async function resolveJavaInstallDirectory() {
  try {
    const root = await getGameDataDirectory()
    javaInstallDirectory.value = `${root.replace(/[\\/]+$/, '')}/jre`
  } catch {
    javaInstallDirectory.value = ''
  }
}

function getVendorVersionGroups(vendor: JavaVendor) {
  const majorVersions = new Set(vendor.versions.map(getMajor))
  return [...majorVersions]
    .filter(major => supportedMajors.value?.includes(major) ?? true)
    .sort((a, b) => b - a)
    .map(major => ({ id: `java${major}`, major, title: `Java ${major}` }))
}

async function refreshCatalog(force = false) {
  if (!isShown.value) return
  await reload(showAllVersions.value, force)
  await nextTick()
  if (isShown.value) updateActiveSections()
}

async function retryVendor(vendor: JavaVendor) {
  await loadVendor(vendor, true)
  await nextTick()
  if (isShown.value) updateActiveSections()
}

function isInstalled(version: RuntimeVersion) {
  return isJavaRuntimeInstalled(javas.value, version.path)
}

async function installVersion(vendor: JavaVendor, version: RuntimeVersion) {
  const majorVersion = getMajor(version)

  if (!majorVersion || installing.value) return

  const key = `${vendor.id}/${version.version}/${version.runtimeUrl}`
  installError.value = ''
  installing.value = key

  try {
    await install({
      type: 'java',
      vendor: vendor.id,
      version: version.version,
      majorVersion,
      metadataSha256: version.sha256,
      runtimeUrl: version.runtimeUrl,
    })

    await refreshLocalJava(true)
  } catch (e) {
    installError.value = e instanceof Error ? e.message : String(e)
  } finally {
    installing.value = ''
  }
}

function getSidebarElement(): HTMLElement | null {
  return (sidebarContainer.value?.$el as HTMLElement) ?? null
}

function scrollTo(id: string) {
  const container = scrollContainer.value
  const element = document.getElementById(id)

  if (!container || !element) return

  const offset =
    element.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop

  container.scrollTo({ top: offset, behavior: 'smooth' })
}

function scrollSidebarToActiveItem() {
  const sidebar = getSidebarElement()
  const vendor = vendors.value[activeVendorIndex.value]

  if (!sidebar || !vendor) return

  const activeId = activeVersionId.value
    ? `sidebar-${activeVersionId.value}`
    : `sidebar-${vendor.id}`
  const activeElement = document.getElementById(activeId)

  if (!activeElement) return

  const sidebarRect = sidebar.getBoundingClientRect()
  const itemRect = activeElement.getBoundingClientRect()

  if (itemRect.top >= sidebarRect.top && itemRect.bottom <= sidebarRect.bottom) return

  const offset = itemRect.top - sidebarRect.top + sidebar.scrollTop

  sidebar.scrollTo({
    top: offset - sidebar.clientHeight / 2 + activeElement.clientHeight / 2,
    behavior: 'smooth',
  })
}

function updateActiveSections() {
  const container = scrollContainer.value

  if (!container) return

  const threshold = container.getBoundingClientRect().top + 100
  let vendorIndex = 0

  for (let i = vendors.value.length - 1; i >= 0; i--) {
    const element = document.getElementById(vendors.value[i].id)

    if (element && element.getBoundingClientRect().top <= threshold) {
      vendorIndex = i
      break
    }
  }

  activeVendorIndex.value = vendorIndex

  const vendor = vendors.value[vendorIndex]
  let versionId: string | null = null

  if (vendor) {
    const groups = getVendorVersionGroups(vendor)

    for (let i = groups.length - 1; i >= 0; i--) {
      const id = `${vendor.id}-${groups[i].id}`
      const element = document.getElementById(id)

      if (element && element.getBoundingClientRect().top <= threshold) {
        versionId = id
        break
      }
    }
  }
  activeVersionId.value = versionId
  scrollSidebarToActiveItem()
}

function onScroll() {
  updateActiveSections()
}

function onScrollEnd() {
  updateActiveSections()
}

watch([isShown, showAllVersions], ([shown], [wasShown]) => {
  if (!shown) {
    reset()
    installError.value = ''
    return
  }
  if (!wasShown) void resolveJavaInstallDirectory()
  void refreshCatalog()
})
</script>

<style scoped>
.setting-page {
  background: transparent;
  user-select: none;
}

.java-installer-card {
  display: flex;
  flex-direction: column;
  height: 720px;
  max-height: 90vh;
  min-height: 0;
}

.content-layout {
  display: grid;
  grid-template-columns: 220px 1px minmax(0, 1fr);

  min-width: 0;
  min-height: 0;

  flex: 1;
  min-height: 0;

  overflow: hidden;

  gap: 10px;
  padding: 10px;
}

.setting-sidebar {
  background: transparent !important;
  padding: 0px 8px;

  min-width: 0;
  min-height: 0;

  overflow-y: auto;
  overflow-x: hidden;

  overscroll-behavior: contain;
  scroll-behavior: smooth;

  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-sidebar::-webkit-scrollbar-track {
  margin-bottom: 20px;
}

.vendor-nav-item :deep(.v-list-item-title) {
  font-size: 1rem;
  font-weight: 700;
}

.version-navigation {
  margin-top: 4px;
  padding-left: 20px;
}

.version-navigation :deep(.v-list-item) {
  min-height: 36px;
}

.version-navigation :deep(.v-list-item--active) {
  background: rgba(var(--v-theme-primary), 0.1);
}

.version-navigation :deep(.v-list-item--active .v-list-item-title) {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.scroll-container {
  position: relative;

  min-width: 0;
  min-height: 0;

  overflow-x: hidden;
  overflow-y: auto;

  scroll-behavior: smooth;
  overscroll-behavior: contain;

  padding-right: 10px;

  display: flex;
  flex-direction: column;
  gap: 24px;
}

.scroll-container::-webkit-scrollbar-track {
  margin-bottom: 20px;
}

.vendor-content-header :deep(.xtext-h5) {
  font-size: 1.5rem !important;
  font-weight: 700;

  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.version-section {
  padding-left: 16px;
}

.scroll-target {
  scroll-margin-top: 16px;
}

.java-version-item {
  border-radius: 8px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  margin: 4px 0;
}
</style>
