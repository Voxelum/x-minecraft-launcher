<template>
  <v-dialog
    v-model="isShownDialog"
    max-width="560"
    transition="fade-transition"
    :persistent="versionLoading"
  >
    <!-- Step 1: Modpack URL Input -->
    <v-card v-if="dialogStep === 'input'" class="p-5 flex flex-col">
      <v-card-title class="shrink-0 flex items-center gap-3 px-2 pt-1 pb-2">
        <div class="surface-rounded-item w-10 h-10 flex items-center justify-center bg-primary/15 text-primary">
          <v-icon size="24">link</v-icon>
        </div>
        <div class="flex flex-col">
          <span class="text-base font-bold">{{ t('importModpack.name') }}</span>
          <span class="text-xs opacity-60 font-normal">{{ t('importModpack.fromUrlSubtitle') }}</span>
        </div>
      </v-card-title>
      <v-card-text class="min-h-0 overflow-y-auto px-2 py-3">
        <p class="text-sm opacity-80 mb-3">
          {{ t('importModpack.fromUrlDescription') }}
        </p>
        <v-text-field
          v-model="modpackUrl"
          placeholder="https://..."
          :aria-label="t('importModpack.fromUrlDescription')"
          :error-messages="urlError"
          :loading="urlLoading"
          variant="filled"
          density="comfortable"
          :disabled="urlLoading"
          clearable
          hide-details="auto"
          autofocus
          @keydown.enter="submitModpackUrl"
        >
          <template #prepend-inner>
            <v-icon size="20" class="opacity-60">travel_explore</v-icon>
          </template>
          <template #append-inner>
            <v-btn
              icon
              variant="text"
              size="small"
              class="opacity-70 hover:opacity-100"
              :aria-label="t('importModpack.fromUrlDescription')"
              :disabled="urlLoading"
              @click="pasteFromClipboard"
            >
              <v-icon size="18">content_paste</v-icon>
            </v-btn>
          </template>
        </v-text-field>
      </v-card-text>
      <v-card-actions class="shrink-0 justify-end gap-2 px-2 pb-1">
        <v-btn variant="text" rounded="pill" @click="closeAll">
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          rounded="pill"
          class="!px-6"
          :loading="urlLoading"
          :disabled="!urlInput.url || urlLoading"
          @click="submitModpackUrl"
        >
          <v-icon start class="!ml-0">download</v-icon>
          {{ t('shared.install') }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Step 2: Version Select Dialog -->
    <v-card v-else class="p-5 flex flex-col">
      <v-card-title class="shrink-0 flex items-center gap-3 px-2 pt-1 pb-2">
        <div class="surface-rounded-item w-10 h-10 shrink-0 flex items-center justify-center bg-primary/15 text-primary">
          <v-icon size="24" :icon="selectedSourceIcon" />
        </div>
        <div class="flex flex-col min-w-0">
          <span class="text-base font-bold">{{ t('importModpack.selectVersion') }}</span>
          <span class="text-xs opacity-60 font-normal truncate">{{ selectedProjectName }}</span>
        </div>
      </v-card-title>
      <v-card-text class="min-h-0 overflow-y-auto px-2 py-3">
        <p class="text-sm opacity-80 mb-3">
          {{ t('importModpack.selectVersionDescription', { name: selectedProjectName }) }}
        </p>
        <v-select
          v-model="selectedVersionId"
          :items="availableVersions"
          item-title="title"
          item-value="id"
          :label="t('importModpack.selectVersion')"
          :disabled="versionLoading"
          :error-messages="urlError"
          variant="filled"
          density="comfortable"
          hide-details="auto"
        />

        <!-- Netdisk notice if version is hosted on a cloud disk -->
        <v-alert
          v-if="isSelectedVersionNetdisk"
          type="info"
          variant="tonal"
          density="compact"
          class="surface-rounded-item mt-3 text-xs"
        >
          <div class="font-semibold text-sm mb-1 flex items-center gap-1.5">
            <v-icon size="16">cloud_download</v-icon>
            {{ t('importModpack.netdiskTitle') }}
          </div>
          <div class="opacity-80 leading-relaxed">
            {{ t('importModpack.netdiskDescription') }}
          </div>
        </v-alert>
      </v-card-text>
      <v-card-actions class="shrink-0 justify-end gap-2 px-2 pb-1">
        <v-btn variant="text" rounded="pill" :disabled="versionLoading" @click="dialogStep = 'input'; urlError = ''">
          <v-icon start size="16">arrow_back</v-icon>
          {{ t('shared.back') }}
        </v-btn>
        <v-btn variant="text" rounded="pill" :disabled="versionLoading" @click="closeAll">
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          rounded="pill"
          class="!px-6"
          :loading="versionLoading"
          :disabled="!selectedVersionId || versionLoading"
          @click="confirmVersionSelect"
        >
          <v-icon start class="!ml-0">{{ isSelectedVersionNetdisk ? 'open_in_new' : 'download' }}</v-icon>
          {{ isSelectedVersionNetdisk ? t('importModpack.openNetdisk') : t('shared.install') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { ImportUrlDialogKey } from '@/composables/modpackPaste'
import { getModpackProviderPath, parseModpackUrlInput, routeModpackUrlInput } from '@/composables/modpackUrlInput'
import { useModpackInstaller, useModpackFinishInstall } from '@/composables/modpackInstaller'
import { useService } from '@/composables'
import { BaseServiceKey, MarketType, ModpackServiceKey, InstanceInstallServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { useNotifier } from '@/composables/notifier'
import { injection } from '@/util/inject'
import { kInstances } from '@/composables/instances'
import { InstanceFile } from '@xmcl/instance'
import { useLocaleError } from '@/composables/error'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { kJavaContext } from '@/composables/java'

const { t } = useI18n()
const formatError = useLocaleError()
const { notify } = useNotifier()
const router = useRouter()
const { selectedInstance, instances } = injection(kInstances)

const { openModpack, getModpackArchiveFiles } = useService(ModpackServiceKey)
const { handleUrl } = useService(BaseServiceKey)
const { createInstance, editInstance } = useService(InstanceServiceKey)
const { installInstanceFiles } = useService(InstanceInstallServiceKey)
const installModpack = useModpackInstaller()
const finishModpackInstall = useModpackFinishInstall()
const { getInstanceLock, getInstallInstruction, handleInstallInstruction } = injection(kInstanceVersionInstall)
const { all: javas } = injection(kJavaContext)

// Dialog states
const isShownDialog = ref(false)
const dialogStep = ref<'input' | 'version'>('input')
const modpackUrl = ref<string | null>('')
const urlInput = computed(() => parseModpackUrlInput(modpackUrl.value))
const urlLoading = ref(false)
const urlError = ref('')

const selectedProjectName = ref('')
const selectedVersionId = ref<number | string | undefined>(undefined)
const availableVersions = ref<{ id: number | string; title: string; raw?: any }[]>([])
const selectedMarketType = ref<MarketType>(MarketType.Modrinth)
const selectedSource = ref<'modrinth' | 'curseforge' | 'atlauncher' | 'bbsmc' | 'github' | 'technic' | 'url'>('url')
const versionLoading = ref(false)
let revision = 0

function operation() {
  const id = ++revision
  return {
    current: () => id === revision,
    async wait<T>(promise: Promise<T>): Promise<T> {
      const result = await promise
      if (id !== revision) throw new DOMException('Import dialog closed', 'AbortError')
      return result
    },
  }
}

// Context data for ATLauncher / BBSMC
const atlauncherData = ref<{ safeName: string; packName: string } | null>(null)
const atlauncherInstallTarget = ref<{ source: string; path: string }>()
const bbsmcData = ref<{ slug: string; versions: any[] } | null>(null)

function isNetdiskUrl(url?: string): boolean {
  if (!url) return false
  return /pan\.quark\.cn|pan\.baidu\.com|123pan\.com|123684\.com|lanzou|sharepoint|drive\.google\.com\/drive/i.test(url)
}

function resolveAtlDownloadUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return `https://download.nodecdn.net/containers/atl/${url.replace(/^\/+/, '')}`
}

const currentSelectedVersion = computed(() => {
  return availableVersions.value.find((v) => v.id === selectedVersionId.value)
})

const isSelectedVersionNetdisk = computed(() => {
  if (selectedSource.value !== 'bbsmc') return false
  const raw = currentSelectedVersion.value?.raw
  if (!raw) return false
  if (raw.disk_only) return true
  if (raw.disk_urls && raw.disk_urls.length > 0) return true
  const file = raw.files?.find((file: { primary?: boolean }) => file.primary) || raw.files?.[0]
  return isNetdiskUrl(file?.url)
})

const selectedSourceIcon = computed(() => {
  switch (selectedSource.value) {
    case 'modrinth': return 'xmcl:modrinth'
    case 'curseforge': return 'xmcl:curseforge'
    case 'atlauncher': return 'rocket_launch'
    case 'bbsmc': return 'forum'
    case 'github': return 'xmcl:github'
    case 'technic': return 'xmcl:technic'
    default: return 'folder_zip'
  }
})

function closeAll() {
  revision++
  isShownDialog.value = false
  hide()
  dialogStep.value = 'input'
  urlLoading.value = false
  versionLoading.value = false
}

async function pasteFromClipboard() {
  const id = revision
  try {
    const text = await navigator.clipboard.readText()
    if (text && id === revision) {
      modpackUrl.value = text.trim()
      urlError.value = ''
    }
  } catch (e) {
    if (id === revision) urlError.value = formatError(e)
  }
}

const { isShown, show, hide } = useDialog(ImportUrlDialogKey, (param) => {
  revision++
  availableVersions.value = []
  selectedVersionId.value = undefined
  selectedSource.value = 'url'
  selectedProjectName.value = ''
  atlauncherData.value = null
  atlauncherInstallTarget.value = undefined
  bbsmcData.value = null
  let targetUrl = ''
  if (typeof param === 'string') {
    targetUrl = param
  } else if (param && typeof param === 'object' && 'url' in param && param.url) {
    targetUrl = param.url
  }

  dialogStep.value = 'input'
  urlLoading.value = false
  versionLoading.value = false
  urlError.value = ''
  isShownDialog.value = true

  if (targetUrl) {
    modpackUrl.value = targetUrl
    const id = revision
    nextTick(() => {
      if (id === revision) submitModpackUrl()
    })
  } else {
    modpackUrl.value = ''
  }
})

watch(isShownDialog, (val) => {
  if (!val) {
    revision++
    hide()
  }
}, { flush: 'sync' })

watch(isShown, (val) => {
  if (!val) {
    revision++
    isShownDialog.value = false
  }
}, { flush: 'sync' })

async function confirmVersionSelect() {
  if (!selectedVersionId.value || versionLoading.value || urlLoading.value) return
  const op = operation()
  versionLoading.value = true
  urlError.value = ''
  const targetProjectName = selectedProjectName.value
  try {
    // 1. Modrinth
    if (selectedSource.value === 'modrinth') {
      const selectedVer = availableVersions.value.find((v) => v.id === selectedVersionId.value)
      const projectId = (selectedVer?.raw as any)?.project_id || targetProjectName
      await op.wait(installModpack({
        market: MarketType.Modrinth,
        projectId,
        versionId: selectedVersionId.value as string,
      }))
      closeAll()
      return
    }

    // 2. CurseForge
    if (selectedSource.value === 'curseforge') {
      const selectedVer = availableVersions.value.find((v) => v.id === selectedVersionId.value)
      const modId = (selectedVer?.raw as any)?.modId
      await op.wait(installModpack({
        market: MarketType.CurseForge,
        modId,
        fileId: selectedVersionId.value as number,
      }))
      closeAll()
      return
    }

    // 3. ATLauncher
    if (selectedSource.value === 'atlauncher' && atlauncherData.value) {
      const { safeName, packName } = atlauncherData.value
      const versionStr = selectedVersionId.value as string
      let configUrl = `https://download.nodecdn.net/containers/atl/packs/${safeName}/versions/${versionStr}/Configs.json`
      let res = await op.wait(fetch(configUrl))
      if (!res.ok) {
        configUrl = `https://download.nodecdn.net/containers/atl/packs/${safeName.toLowerCase()}/versions/${versionStr}/Configs.json`
        res = await op.wait(fetch(configUrl))
      }
      if (!res.ok) throw new Error(`Failed to fetch ATLauncher configs: ${res.statusText}`)
      const config = await op.wait(res.json())
      if (!config.minecraft) throw new Error('ATLauncher configs are missing the Minecraft version')

      const runtime: any = {
        minecraft: config.minecraft,
      }
      if (config.loader?.type === 'neoforge') {
        runtime.neoForged = config.loader.metadata?.version || config.loader.metadata?.rawVersion || ''
      } else if (config.loader?.type === 'forge') {
        runtime.forge = config.loader.metadata?.version || config.loader.metadata?.rawVersion || ''
      } else if (config.loader?.type === 'fabric') {
        runtime.fabricLoader = config.loader.metadata?.version || ''
      } else if (config.loader?.type === 'quilt') {
        runtime.quiltLoader = config.loader.metadata?.version || ''
      }

      // Collect mod files
      const modFiles: InstanceFile[] = (config.mods || [])
        .filter((m: any) => m.client !== false && m.url && (m.type === 'mods' || !m.type) && (!m.optional || m.recommended || m.selected))
        .map((m: any) => ({
          path: `mods/${m.file || m.name + '.jar'}`,
          hashes: m.md5 ? { md5: m.md5 } : (m.sha1 ? { sha1: m.sha1 } : {}),
          downloads: [resolveAtlDownloadUrl(m.url)],
          size: m.filesize,
        }))

      // Overrides have no modpack manifest and must never supply a guessed runtime.
      let overrides: InstanceFile[] = []
      if (config.configs && config.configs.filesize > 0) {
        overrides = await op.wait(getModpackArchiveFiles(configUrl.replace(/Configs\.json$/, 'Configs.zip')))
      }

      const instanceName = `${packName} - ${versionStr}`
      const source = `${safeName}/${versionStr}`
      const newPath = atlauncherInstallTarget.value?.source === source
        ? atlauncherInstallTarget.value.path
        : await op.wait(createInstance({ name: instanceName, runtime }))
      atlauncherInstallTarget.value = { source, path: newPath }
      // Both layers belong to one install operation, not competing replacement locks.
      if (modFiles.length > 0 || overrides.length > 0) {
        await op.wait(installInstanceFiles({
          path: newPath,
          oldFiles: [],
          files: [...overrides, ...modFiles],
        }))
      }
      await op.wait(getInstanceLock(newPath).runExclusive(async () => {
        const instruction = await getInstallInstruction(newPath, runtime, '', undefined, javas.value)
        await handleInstallInstruction(instruction)
      }))

      selectedInstance.value = newPath
      if (router.currentRoute.value.path !== '/') {
        await op.wait(router.push('/'))
      }

      notify({
        level: 'success',
        title: t('importModpack.name'),
        body: instanceName,
      })
      closeAll()
      return
    }

    // 4. BBSMC
    if (selectedSource.value === 'bbsmc' && bbsmcData.value) {
      const selectedVer = currentSelectedVersion.value
      const rawVer = selectedVer?.raw
      const file = rawVer?.files?.find((file: { primary?: boolean }) => file.primary) || rawVer?.files?.[0]
      const fileUrl = (file?.url as string) || ''
      const diskUrl = rawVer?.disk_urls?.[0]?.url || (isNetdiskUrl(fileUrl) ? fileUrl : '')

      // If this version is on a netdisk (Quark, Baidu, 123pan, etc.):
      if (rawVer?.disk_only || diskUrl) {
        const targetDiskUrl = diskUrl || fileUrl
        if (targetDiskUrl) {
          window.open(targetDiskUrl, '_blank')
          await op.wait(navigator.clipboard.writeText(targetDiskUrl))
          notify({
            level: 'info',
            title: t('importModpack.name'),
            body: t('importModpack.netdiskOpened'),
          })
          closeAll()
          return
        }
      }

      if (fileUrl) {
        // Check if CurseForge download URL
        const cfMatch = getModpackProviderPath(fileUrl).match(/^(?:www\.)?curseforge\.com\/minecraft\/modpacks\/[^/]+\/(?:download|files)\/(\d+)/i)
        if (cfMatch) {
          const fileId = parseInt(cfMatch[1], 10)
          const files = await op.wait(clientCurseforgeV1.getFiles([fileId]))
          const file = files.find(file => file.id === fileId)
          if (!file) throw new Error(t('importModpack.noReleasesFound'))
          await op.wait(installModpack({
            market: MarketType.CurseForge,
            modId: file.modId,
            fileId,
          }))
          closeAll()
          return
        }

        // Direct download
        const opened = await op.wait(openModpack(fileUrl))
        if (opened.error) throw opened.error
        if (opened.modpackPath) {
          await op.wait(finishModpackInstall(opened.modpackPath, undefined, undefined, undefined))
          if (targetProjectName && selectedInstance.value) {
            const current = instances.value.find((i) => i.path === selectedInstance.value)
            if (current && (current.name === 'Technic Modpack' || /^\d+\.\d+/.test(current.name))) {
              await editInstance({
                instancePath: selectedInstance.value,
                name: targetProjectName,
              })
            }
          }
          closeAll()
          return
        }
      }
    }

    // 5. Direct URL / GitHub / other
    if (
      typeof selectedVersionId.value === 'string' &&
      (selectedVersionId.value.startsWith('http://') || selectedVersionId.value.startsWith('https://'))
    ) {
      const targetUrl = selectedVersionId.value
      const opened = await op.wait(openModpack(targetUrl))
      if (opened.error) throw opened.error
      if (opened.modpackPath) {
        await op.wait(finishModpackInstall(opened.modpackPath, undefined, undefined, undefined))
        if (targetProjectName && selectedInstance.value) {
          const current = instances.value.find((i) => i.path === selectedInstance.value)
          if (current && (current.name === 'Technic Modpack' || /^\d+\.\d+/.test(current.name))) {
            await editInstance({
              instancePath: selectedInstance.value,
              name: targetProjectName,
            })
          }
        }
      }
      closeAll()
      return
    }
    throw new Error(t('importModpack.noReleasesFound'))
  } catch (e: any) {
    if (op.current()) urlError.value = formatError(e)
  } finally {
    if (op.current()) versionLoading.value = false
  }
}

async function submitModpackUrl() {
  if (urlLoading.value || versionLoading.value) return
  const input = urlInput.value
  const inputUrl = input.url
  if (!inputUrl) return

  if (input.kind === 'invalid') {
    urlError.value = t('importModpack.invalidUrl')
    return
  }

  urlLoading.value = true
  urlError.value = ''
  const op = operation()
  const providerPath = getModpackProviderPath(inputUrl)

  try {
    // 1. Modrinth URL
    const modrinthMatch = providerPath.match(/^(?:www\.)?modrinth\.com\/(?:modpack|project)\/([a-zA-Z0-9\-_]+)/i)
    if (modrinthMatch) {
      const slug = modrinthMatch[1]
      const versionMatch = providerPath.match(/\/version\/([a-zA-Z0-9\-_]+)/i)
      const reqVersionId = versionMatch ? versionMatch[1] : null

      const project = await op.wait(clientModrinthV2.getProject(slug))
      const versions = await op.wait(clientModrinthV2.getProjectVersions(slug))

      if (versions && versions.length > 0) {
        selectedSource.value = 'modrinth'
        selectedProjectName.value = project?.title || slug
        selectedMarketType.value = MarketType.Modrinth
        availableVersions.value = versions.map((v: any) => ({
          id: v.id,
          title: `${v.name || v.version_number} (${v.game_versions?.join(', ') || ''}${v.loaders?.length ? ' - ' + v.loaders.join(', ') : ''})`,
          raw: v,
        }))

        if (reqVersionId) {
          const directMatch = versions.find((v: any) => v.id === reqVersionId || v.version_number === reqVersionId || v.name === reqVersionId)
          if (!directMatch) throw new Error(t('importModpack.noReleasesFound'))
          selectedVersionId.value = directMatch.id
        } else {
          selectedVersionId.value = availableVersions.value[0]?.id
        }

        dialogStep.value = 'version'
        return
      }
      throw new Error(t('importModpack.noReleasesFound'))
    }

    // 2. CurseForge URL
    const curseforgeMatch = providerPath.match(/^(?:www\.)?curseforge\.com\/minecraft\/modpacks\/([a-zA-Z0-9\-_]+)/i)
    if (curseforgeMatch) {
      const slug = curseforgeMatch[1]
      const fileIdMatch = providerPath.match(/\/(?:files|download)\/(\d+)/i)
      const reqFileId = fileIdMatch ? parseInt(fileIdMatch[1], 10) : null
      let versionsList: { id: number; title: string; raw?: any }[] = []

      {
        const searchRes = await op.wait(clientCurseforgeV1.searchMods({ slug, classId: 4471 }))
        let mod = searchRes.data?.[0]
        if (!mod) {
          const fallbackRes = await op.wait(clientCurseforgeV1.searchMods({ slug }))
          mod = fallbackRes.data?.[0]
        }
        if (mod) {
          selectedProjectName.value = mod.name || slug
          const filesRes = await op.wait(clientCurseforgeV1.getModFiles({ modId: mod.id }))
          if (reqFileId && !filesRes.data.some(file => file.id === reqFileId)) {
            const requested = await op.wait(clientCurseforgeV1.getFiles([reqFileId]))
            const file = requested.find(file => file.id === reqFileId && file.modId === mod.id)
            if (!file) throw new Error(t('importModpack.noReleasesFound'))
            filesRes.data.push(file)
          }
          if (filesRes.data && filesRes.data.length > 0) {
            versionsList = filesRes.data.map((f: any) => ({
              id: f.id,
              title: `${f.displayName} (${f.gameVersions?.filter((v: string) => /^\d+\.\d+/.test(v)).join(', ') || ''})`,
              raw: { ...f, modId: mod!.id },
            }))
          }
        }
      }

      if (versionsList.length > 0) {
        selectedSource.value = 'curseforge'
        selectedMarketType.value = MarketType.CurseForge
        availableVersions.value = versionsList

        if (reqFileId) {
          const matched = versionsList.find((v) => v.id === reqFileId)
          if (!matched) throw new Error(t('importModpack.noReleasesFound'))
          selectedVersionId.value = matched.id
        } else {
          selectedVersionId.value = versionsList[0]?.id
        }

        dialogStep.value = 'version'
        return
      }
      throw new Error(t('importModpack.noReleasesFound'))
    }

    // 3. ATLauncher URL: e.g. https://atlauncher.com/pack/PixelmonMod
    const atlauncherMatch = providerPath.match(/^(?:www\.)?atlauncher\.com\/pack\/([a-zA-Z0-9\-_]+)/i)
    if (atlauncherMatch) {
      const packSlug = atlauncherMatch[1]
      const res = await op.wait(fetch(`https://api.atlauncher.com/v1/pack/${packSlug}`))
      if (!res.ok) throw new Error(`ATLauncher: ${res.status} ${res.statusText}`)
      if (res.ok) {
        const json = await op.wait(res.json())
        if (json.data && Array.isArray(json.data.versions) && json.data.versions.length > 0) {
          selectedSource.value = 'atlauncher'
          selectedProjectName.value = json.data.name || packSlug
          atlauncherData.value = {
            safeName: json.data.safeName || packSlug,
            packName: json.data.name || packSlug,
          }
          availableVersions.value = json.data.versions.map((v: any) => ({
            id: v.version,
            title: `${v.version} (Minecraft ${v.minecraft})`,
            raw: v,
          }))
          selectedVersionId.value = availableVersions.value[0]?.id

          dialogStep.value = 'version'
          return
        }
      }
    }

    if (atlauncherMatch) throw new Error(t('importModpack.noReleasesFound'))

    // 4. BBSMC URL: e.g. https://bbsmc.net/modpack/vefc or https://bbsmc.net/project/the-fool
    const bbsmcMatch = providerPath.match(/^(?:www\.)?bbsmc\.net\/(?:modpack|project)\/([a-zA-Z0-9\-_]+)/i)
    if (bbsmcMatch) {
      const slug = bbsmcMatch[1]
      const versionMatch = providerPath.match(/\/version\/([a-zA-Z0-9\-_]+)/i)
      const reqVersionId = versionMatch ? versionMatch[1] : null

      const projRes = await op.wait(fetch(`https://api.bbsmc.net/v2/project/${slug}`))
      const verRes = await op.wait(fetch(`https://api.bbsmc.net/v2/project/${slug}/version`))
      if (!projRes.ok || !verRes.ok) throw new Error(`BBSMC: ${!projRes.ok ? projRes.status : verRes.status}`)

      if (verRes && verRes.ok) {
        const versions = await op.wait(verRes.json())
        const project = await op.wait(projRes.json())

        if (Array.isArray(versions) && versions.length > 0) {
          selectedSource.value = 'bbsmc'
          selectedProjectName.value = project?.title || slug
          bbsmcData.value = { slug, versions }
          availableVersions.value = versions.map((v: any) => ({
            id: v.id,
            title: `${v.name || v.version_number} (${v.game_versions?.join(', ') || ''}${v.loaders?.length ? ' - ' + v.loaders.join(', ') : ''})`,
            raw: v,
          }))

          if (reqVersionId) {
            const matched = availableVersions.value.find((v) => v.id === reqVersionId)
            if (!matched) throw new Error(t('importModpack.noReleasesFound'))
            selectedVersionId.value = matched.id
          } else {
            selectedVersionId.value = availableVersions.value[0]?.id
          }
          dialogStep.value = 'version'
          return
        }
      }
    }

    if (bbsmcMatch) throw new Error(t('importModpack.noReleasesFound'))

    // 5. Planet Minecraft URL: e.g. https://www.planetminecraft.com/mod/...
    const pmcMatch = providerPath.match(/^(?:www\.)?planetminecraft\.com\/(?:mod|data-pack|texture-pack|project|mods\/tag\/modpacks)(?:\/|$)/i)
    if (pmcMatch) {
      // Planet Minecraft has Cloudflare challenge on direct scraper requests
      urlError.value = t('importModpack.pmcProtected')
      return
    }

    // 6. Technic URL: e.g. https://www.technicpack.net/modpack/the-1122-pack.1406454
    const technicMatch = providerPath.match(/^(?:(?:www\.)?technicpack\.net\/modpack\/|technic:\/\/modpack\/)([a-zA-Z0-9\-_.]+)/i)
    if (technicMatch) {
      const slugOrId = technicMatch[1]
      {
        const res = await op.wait(fetch(`https://api.technicpack.net/modpack/${slugOrId}?build=launchercore`))
        if (!res.ok) throw new Error(`Technic: ${res.status} ${res.statusText}`)
        if (res && res.ok) {
          const pack = await op.wait(res.json())
          if (pack && pack.url) {
            selectedProjectName.value = pack.displayName || pack.name || slugOrId
            const opened = await op.wait(openModpack(pack.url))
            if (opened.error) throw opened.error
            if (opened.modpackPath) {
              await op.wait(finishModpackInstall(opened.modpackPath, pack.icon?.url, undefined, undefined))
            }
            closeAll()
            return
          }
        }
      }
      throw new Error(t('importModpack.noReleasesFound'))
    }

    // 7. GitHub URL: e.g. https://github.com/Fabulously-Optimized/fabulously-optimized
    const githubMatch = providerPath.match(/^(?:www\.)?github\.com\/([^/\s]+)\/([^/?#\s]+)(?:\/releases(?:\/|$)|\/?$)/i)
    if (githubMatch) {
      const owner = githubMatch[1]
      const repo = githubMatch[2].replace(/\.git$/, '')

      const directAssetMatch = providerPath.match(/\/releases\/download\/([^/]+)\/([^/?#]+)$/i)
      const directTag = directAssetMatch ? decodeURIComponent(directAssetMatch[1]) : null
      const directFilename = directAssetMatch ? decodeURIComponent(directAssetMatch[2]) : null

      const tagMatch = providerPath.match(/\/releases\/tag\/([^/?#]+)/i)
      const targetTag = tagMatch ? decodeURIComponent(tagMatch[1]) : directTag

      selectedProjectName.value = repo
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

      const versionsList: { id: string; title: string }[] = []
      let releaseError: unknown

      if (directAssetMatch && directFilename) {
        versionsList.push({
          id: inputUrl,
          title: directTag ? `${directTag} - ${directFilename}` : directFilename,
        })
      }

      if (!directAssetMatch) {
        try {
          const headers: Record<string, string> = {
            Accept: 'application/vnd.github.v3+json',
          }
          const res = await op.wait(fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers }))
          if (!res.ok) throw new Error(`GitHub: ${res.status} ${res.statusText}`)
          const releases = await op.wait(res.json())
          if (Array.isArray(releases) && releases.length > 0) {
            for (const rel of releases) {
              if (Array.isArray(rel.assets)) {
                for (const asset of rel.assets) {
                  const name = asset.name || ''
                  if (/\.(mrpack|zip)$/i.test(name)) {
                    const downloadUrl = asset.browser_download_url
                    if (!versionsList.some((v) => v.id === downloadUrl)) {
                      versionsList.push({
                        id: downloadUrl,
                        title: `${rel.name || rel.tag_name} - ${name}`,
                      })
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          if (!op.current()) throw e
          // Preserve the release-page fallback, but report the API error if it has no assets either.
          releaseError = e
        }
      }

      if (versionsList.length === 0) {
        const pageRes = await op.wait(fetch(`https://github.com/${owner}/${repo}/releases`))
        if (!pageRes.ok) throw releaseError || new Error(`GitHub: ${pageRes.status} ${pageRes.statusText}`)
        if (pageRes && pageRes.ok) {
          const html = await op.wait(pageRes.text())
          const assetRegex = /href="(\/[^/]+\/[^/]+\/releases\/download\/[^"]+\.(?:mrpack|zip))"/gi
          let m: RegExpExecArray | null
          while ((m = assetRegex.exec(html)) !== null) {
            const downloadUrl = `https://github.com${m[1]}`
            const filename = decodeURIComponent(m[1].split('/').pop() || '')
            const tag = decodeURIComponent(m[1].split('/')[5] || '')
            if (!versionsList.some((v) => v.id === downloadUrl)) {
              versionsList.push({
                id: downloadUrl,
                title: `${tag} - ${filename}`,
              })
            }
          }
        }
      }

      if (versionsList.length > 0) {
        selectedSource.value = 'github'
        availableVersions.value = versionsList

        if (targetTag) {
          const matched = versionsList.find(v => {
            const tag = new URL(v.id).pathname.match(/\/releases\/download\/([^/]+)\//)?.[1]
            return tag !== undefined && decodeURIComponent(tag) === targetTag
          })
          if (!matched) throw new Error(t('importModpack.noReleasesFound'))
          selectedVersionId.value = matched.id
        } else {
          selectedVersionId.value = versionsList[0]?.id
        }

        dialogStep.value = 'version'
        return
      } else {
        if (releaseError) throw releaseError
        urlError.value = t('importModpack.noReleasesFound')
        return
      }
    }

    const handled = await routeModpackUrlInput(input, async (url) => {
      const opened = await op.wait(openModpack(url))
      if (opened.error) throw opened.error
      if (opened.modpackPath) {
        await op.wait(finishModpackInstall(opened.modpackPath, undefined, undefined, undefined))
      }
    }, (url) => op.wait(handleUrl(url)))
    if (handled) {
      closeAll()
      return
    }

    urlError.value = t('importModpack.invalidUrl')
  } catch (e: any) {
    if (op.current()) urlError.value = formatError(e)
  } finally {
    if (op.current()) urlLoading.value = false
  }
}
</script>
