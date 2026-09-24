<template>
  <v-dialog
    v-model="isShownDialog"
    max-width="560"
    transition="fade-transition"
  >
    <!-- Step 1: Modpack URL Input -->
    <v-card v-if="dialogStep === 'input'" class="surface-card rounded-2xl p-5 border border-white/10 shadow-2xl backdrop-blur-xl">
      <v-card-title class="flex items-center gap-3 px-2 pt-1 pb-2">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/15 text-primary">
          <v-icon size="24">link</v-icon>
        </div>
        <div class="flex flex-col">
          <span class="text-base font-bold">{{ t('importModpack.fromUrlTitle') }}</span>
          <span class="text-xs opacity-60 font-normal">{{ t('importModpack.fromUrlSubtitle') }}</span>
        </div>
      </v-card-title>
      <v-card-text class="px-2 py-3">
        <p class="text-sm opacity-80 mb-3">
          {{ t('importModpack.fromUrlDescription') }}
        </p>
        <v-text-field
          v-model="modpackUrl"
          :placeholder="t('importModpack.fromUrlPlaceholder')"
          :error-messages="urlError"
          :loading="urlLoading"
          variant="filled"
          density="comfortable"
          rounded="xl"
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
              @click="pasteFromClipboard"
            >
              <v-icon size="18">content_paste</v-icon>
            </v-btn>
          </template>
        </v-text-field>
      </v-card-text>
      <v-card-actions class="justify-end gap-2 px-2 pb-1">
        <v-btn variant="text" rounded="pill" @click="closeAll">
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          rounded="pill"
          :loading="urlLoading"
          :disabled="!modpackUrl.trim()"
          @click="submitModpackUrl"
        >
          <v-icon start>download</v-icon>
          {{ t('importModpack.import') }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Step 2: Version Select Dialog -->
    <v-card v-else class="surface-card rounded-2xl p-5 border border-white/10 shadow-2xl backdrop-blur-xl">
      <v-card-title class="flex items-center gap-3 px-2 pt-1 pb-2">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/15 text-primary">
          <v-icon size="24" :icon="selectedSourceIcon" />
        </div>
        <div class="flex flex-col">
          <span class="text-base font-bold">{{ t('importModpack.selectVersion') }}</span>
          <span class="text-xs opacity-60 font-normal">{{ selectedProjectName }}</span>
        </div>
      </v-card-title>
      <v-card-text class="px-2 py-3">
        <p class="text-sm opacity-80 mb-3">
          {{ t('importModpack.selectVersionDescription', { name: selectedProjectName }) }}
        </p>
        <v-select
          v-model="selectedVersionId"
          :items="availableVersions"
          item-title="title"
          item-value="id"
          variant="filled"
          density="comfortable"
          rounded="xl"
          hide-details
        />

        <!-- Netdisk notice if version is hosted on a cloud disk -->
        <v-alert
          v-if="isSelectedVersionNetdisk"
          type="info"
          variant="tonal"
          density="compact"
          rounded="xl"
          class="mt-3 text-xs"
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
      <v-card-actions class="justify-end gap-2 px-2 pb-1">
        <v-btn variant="text" rounded="pill" @click="dialogStep = 'input'">
          <v-icon start size="16">arrow_back</v-icon>
          {{ t('shared.back') }}
        </v-btn>
        <v-btn variant="text" rounded="pill" @click="closeAll">
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          rounded="pill"
          :loading="versionLoading"
          :disabled="!selectedVersionId"
          @click="confirmVersionSelect"
        >
          <v-icon start>{{ isSelectedVersionNetdisk ? 'open_in_new' : 'download' }}</v-icon>
          {{ isSelectedVersionNetdisk ? t('importModpack.openNetdisk') : t('importModpack.importVersion') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { ImportUrlDialogKey } from '@/composables/modpackPaste'
import { useModpackInstaller, useModpackFinishInstall } from '@/composables/modpackInstaller'
import { useService } from '@/composables'
import { BaseServiceKey, MarketType, ModpackServiceKey, InstanceInstallServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { useNotifier } from '@/composables/notifier'
import { injection } from '@/util/inject'
import { kInstances } from '@/composables/instances'
import { InstanceFile } from '@xmcl/instance'
import { getErrorMessage } from '@/util/error'

const { t } = useI18n()
const { notify } = useNotifier()
const router = useRouter()
const { selectedInstance, instances } = injection(kInstances)

const { installModapckFromMarket, openModpack } = useService(ModpackServiceKey)
const { handleUrl } = useService(BaseServiceKey)
const { createInstance, editInstance } = useService(InstanceServiceKey)
const { installInstanceFiles } = useService(InstanceInstallServiceKey)
const installModpack = useModpackInstaller()
const finishModpackInstall = useModpackFinishInstall()

// Dialog states
const isShownDialog = ref(false)
const dialogStep = ref<'input' | 'version'>('input')
const modpackUrl = ref('')
const urlLoading = ref(false)
const urlError = ref('')

const selectedProjectName = ref('')
const selectedVersionId = ref<number | string | undefined>(undefined)
const availableVersions = ref<{ id: number | string; title: string; raw?: any }[]>([])
const selectedMarketType = ref<MarketType>(MarketType.Modrinth)
const selectedSource = ref<'modrinth' | 'curseforge' | 'atlauncher' | 'bbsmc' | 'github' | 'technic' | 'url'>('url')
const versionLoading = ref(false)

// Context data for ATLauncher / BBSMC
const atlauncherData = ref<{ safeName: string; packName: string } | null>(null)
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
  const firstUrl = raw.files?.[0]?.url
  return isNetdiskUrl(firstUrl)
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
  isShownDialog.value = false
  hide()
  dialogStep.value = 'input'
  urlLoading.value = false
  versionLoading.value = false
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      modpackUrl.value = text.trim()
      urlError.value = ''
    }
  } catch { }
}

const { isShown, show, hide } = useDialog(ImportUrlDialogKey, (param) => {
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
    nextTick(() => {
      submitModpackUrl()
    })
  } else {
    modpackUrl.value = ''
  }
})

watch(isShownDialog, (val) => {
  if (!val) {
    hide()
  }
})

watch(isShown, (val) => {
  if (!val) {
    isShownDialog.value = false
  }
})

async function confirmVersionSelect() {
  if (!selectedVersionId.value) return
  versionLoading.value = true
  const targetProjectName = selectedProjectName.value
  try {
    // 1. Modrinth
    if (selectedSource.value === 'modrinth') {
      const selectedVer = availableVersions.value.find((v) => v.id === selectedVersionId.value)
      const projectId = (selectedVer?.raw as any)?.project_id || targetProjectName
      closeAll()
      await installModpack({
        market: MarketType.Modrinth,
        projectId,
        versionId: selectedVersionId.value as string,
      })
      return
    }

    // 2. CurseForge
    if (selectedSource.value === 'curseforge') {
      const selectedVer = availableVersions.value.find((v) => v.id === selectedVersionId.value)
      const modId = (selectedVer?.raw as any)?.modId
      closeAll()
      await installModpack({
        market: MarketType.CurseForge,
        modId,
        fileId: selectedVersionId.value as number,
      })
      return
    }

    // 3. ATLauncher
    if (selectedSource.value === 'atlauncher' && atlauncherData.value) {
      const { safeName, packName } = atlauncherData.value
      const versionStr = selectedVersionId.value as string
      closeAll()

      let configUrl = `https://download.nodecdn.net/containers/atl/packs/${safeName}/versions/${versionStr}/Configs.json`
      let res = await fetch(configUrl)
      if (!res.ok) {
        configUrl = `https://download.nodecdn.net/containers/atl/packs/${safeName.toLowerCase()}/versions/${versionStr}/Configs.json`
        res = await fetch(configUrl)
      }
      if (!res.ok) throw new Error(`Failed to fetch ATLauncher configs: ${res.statusText}`)
      const config = await res.json()

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

      // Create instance
      const instanceName = `${packName} - ${versionStr}`
      const newPath = await createInstance({
        name: instanceName,
        runtime,
      })

      // Download Configs.zip if present
      if (config.configs && config.configs.filesize > 0) {
        let configsZipUrl = `https://download.nodecdn.net/containers/atl/packs/${safeName}/versions/${versionStr}/Configs.zip`
        try {
          let openedZip = await openModpack(configsZipUrl).catch(() => null)
          if (!openedZip) {
            configsZipUrl = `https://download.nodecdn.net/containers/atl/packs/${safeName.toLowerCase()}/versions/${versionStr}/Configs.zip`
            openedZip = await openModpack(configsZipUrl)
          }
          if (openedZip && openedZip.modpackPath) {
            await finishModpackInstall(openedZip.modpackPath, undefined, undefined, newPath)
          }
        } catch (e) {
          console.warn('Failed to install Configs.zip for ATLauncher pack:', e)
        }
      }

      // Install mods
      if (modFiles.length > 0) {
        await installInstanceFiles({
          path: newPath,
          oldFiles: [],
          files: modFiles,
        })
      }

      selectedInstance.value = newPath
      if (router.currentRoute.value.path !== '/') {
        await router.push('/')
      }

      notify({
        level: 'success',
        title: t('importModpack.name'),
        body: instanceName,
      })
      return
    }

    // 4. BBSMC
    if (selectedSource.value === 'bbsmc' && bbsmcData.value) {
      const selectedVer = currentSelectedVersion.value
      const rawVer = selectedVer?.raw
      const file = rawVer?.files?.[0]
      const fileUrl = (file?.url as string) || ''
      const diskUrl = rawVer?.disk_urls?.[0]?.url || (isNetdiskUrl(fileUrl) ? fileUrl : '')

      // If this version is on a netdisk (Quark, Baidu, 123pan, etc.):
      if (rawVer?.disk_only || diskUrl) {
        const targetDiskUrl = diskUrl || fileUrl
        if (targetDiskUrl) {
          window.open(targetDiskUrl, '_blank')
          try {
            await navigator.clipboard.writeText(targetDiskUrl)
          } catch { }
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
        const cfMatch = fileUrl.match(/curseforge\.com\/minecraft\/modpacks\/[^/]+\/download\/(\d+)/i)
        if (cfMatch) {
          const fileId = parseInt(cfMatch[1], 10)
          closeAll()
          await installModpack({
            market: MarketType.CurseForge,
            modId: 0,
            fileId,
          })
          return
        }

        // Direct download
        closeAll()
        const opened = await openModpack(fileUrl)
        if (opened.modpackPath) {
          await finishModpackInstall(opened.modpackPath, undefined, undefined, undefined)
          if (targetProjectName && selectedInstance.value) {
            const current = instances.value.find((i) => i.path === selectedInstance.value)
            if (current && (current.name === 'Technic Modpack' || /^\d+\.\d+/.test(current.name))) {
              await editInstance({
                instancePath: selectedInstance.value,
                name: targetProjectName,
              })
            }
          }
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
      closeAll()
      const opened = await openModpack(targetUrl)
      if (opened.modpackPath) {
        await finishModpackInstall(opened.modpackPath, undefined, undefined, undefined)
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
      return
    }
  } catch (e: any) {
    const msg = getErrorMessage(e)
    urlError.value = msg
    closeAll()
    notify({
      level: 'error',
      title: t('importModpack.name'),
      body: msg,
    })
  } finally {
    versionLoading.value = false
  }
}

async function submitModpackUrl() {
  const inputUrl = modpackUrl.value.trim()
  if (!inputUrl) return

  if (
    !inputUrl.startsWith('http://') &&
    !inputUrl.startsWith('https://') &&
    !inputUrl.startsWith('curseforge://') &&
    !inputUrl.startsWith('modrinth://') &&
    !inputUrl.startsWith('technic://')
  ) {
    urlError.value = t('importModpack.invalidUrl')
    return
  }

  urlLoading.value = true
  urlError.value = ''

  try {
    // 1. Modrinth URL
    const modrinthMatch = inputUrl.match(/modrinth\.com\/(?:modpack|project)\/([a-zA-Z0-9\-_]+)/i)
    if (modrinthMatch) {
      const slug = modrinthMatch[1]
      const versionMatch = inputUrl.match(/\/version\/([a-zA-Z0-9\-_]+)/i)
      const reqVersionId = versionMatch ? versionMatch[1] : null

      const project = await clientModrinthV2.getProject(slug).catch(() => null)
      const versions = await clientModrinthV2.getProjectVersions(slug).catch(() => [])

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
          selectedVersionId.value = directMatch ? directMatch.id : availableVersions.value[0]?.id
        } else {
          selectedVersionId.value = availableVersions.value[0]?.id
        }

        dialogStep.value = 'version'
        return
      }
    }

    // 2. CurseForge URL
    const curseforgeMatch = inputUrl.match(/curseforge\.com\/minecraft\/modpacks\/([a-zA-Z0-9\-_]+)/i)
    if (curseforgeMatch) {
      const slug = curseforgeMatch[1]
      const fileIdMatch = inputUrl.match(/\/files\/(\d+)/i)
      const reqFileId = fileIdMatch ? parseInt(fileIdMatch[1], 10) : null
      let versionsList: { id: number; title: string; raw?: any }[] = []

      try {
        const searchRes = await clientCurseforgeV1.searchMods({ slug, classId: 4471 }).catch(() => ({ data: [] }))
        let mod = searchRes.data?.[0]
        if (!mod) {
          const fallbackRes = await clientCurseforgeV1.searchMods({ slug }).catch(() => ({ data: [] }))
          mod = fallbackRes.data?.[0]
        }
        if (mod) {
          selectedProjectName.value = mod.name || slug
          const filesRes = await clientCurseforgeV1.getModFiles({ modId: mod.id }).catch(() => ({ data: [] }))
          if (filesRes.data && filesRes.data.length > 0) {
            versionsList = filesRes.data.map((f: any) => ({
              id: f.id,
              title: `${f.displayName} (${f.gameVersions?.filter((v: string) => /^\d+\.\d+/.test(v)).join(', ') || ''})`,
              raw: { ...f, modId: mod!.id },
            }))
          }
        }
      } catch { }

      if (versionsList.length > 0) {
        selectedSource.value = 'curseforge'
        selectedMarketType.value = MarketType.CurseForge
        availableVersions.value = versionsList

        if (reqFileId) {
          const matched = versionsList.find((v) => v.id === reqFileId)
          selectedVersionId.value = matched ? matched.id : versionsList[0]?.id
        } else {
          selectedVersionId.value = versionsList[0]?.id
        }

        dialogStep.value = 'version'
        return
      }
    }

    // 3. ATLauncher URL: e.g. https://atlauncher.com/pack/PixelmonMod
    const atlauncherMatch = inputUrl.match(/atlauncher\.com\/pack\/([a-zA-Z0-9\-_]+)/i)
    if (atlauncherMatch) {
      const packSlug = atlauncherMatch[1]
      const res = await fetch(`https://api.atlauncher.com/v1/pack/${packSlug}`)
      if (res.ok) {
        const json = await res.json()
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

    // 4. BBSMC URL: e.g. https://bbsmc.net/modpack/vefc or https://bbsmc.net/project/the-fool
    const bbsmcMatch = inputUrl.match(/bbsmc\.net\/(?:modpack|project)\/([a-zA-Z0-9\-_]+)/i)
    if (bbsmcMatch) {
      const slug = bbsmcMatch[1]
      const versionMatch = inputUrl.match(/\/version\/([a-zA-Z0-9\-_]+)/i)
      const reqVersionId = versionMatch ? versionMatch[1] : null

      const projRes = await fetch(`https://api.bbsmc.net/v2/project/${slug}`).catch(() => null)
      const verRes = await fetch(`https://api.bbsmc.net/v2/project/${slug}/version`).catch(() => null)

      if (verRes && verRes.ok) {
        const versions = await verRes.json()
        const project = projRes && projRes.ok ? await projRes.json() : null

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
            selectedVersionId.value = matched ? matched.id : availableVersions.value[0]?.id
          } else {
            selectedVersionId.value = availableVersions.value[0]?.id
          }

          dialogStep.value = 'version'
          return
        }
      }
    }

    // 5. Planet Minecraft URL: e.g. https://www.planetminecraft.com/mod/...
    const pmcMatch = inputUrl.match(/planetminecraft\.com\/(?:mod|data-pack|texture-pack|project|mods\/tag\/modpacks)\/([a-zA-Z0-9\-_/]+)/i)
    if (pmcMatch) {
      // Planet Minecraft has Cloudflare challenge on direct scraper requests
      urlError.value = t('importModpack.pmcProtected')
      return
    }

    // 6. Technic URL: e.g. https://www.technicpack.net/modpack/the-1122-pack.1406454
    const technicMatch = inputUrl.match(/(?:technicpack\.net\/modpack\/|technic:\/\/modpack\/)([a-zA-Z0-9\-_.]+)/i)
    if (technicMatch) {
      const slugOrId = technicMatch[1]
      try {
        const res = await fetch(`https://api.technicpack.net/modpack/${slugOrId}?build=launchercore`).catch(() => null)
        if (res && res.ok) {
          const pack = await res.json()
          if (pack && pack.url) {
            selectedProjectName.value = pack.displayName || pack.name || slugOrId
            const opened = await openModpack(pack.url)
            if (opened.modpackPath) {
              await finishModpackInstall(opened.modpackPath, pack.icon?.url, undefined, undefined)
            }
            closeAll()
            return
          }
        }
      } catch { }
    }

    // 7. GitHub URL: e.g. https://github.com/Fabulously-Optimized/fabulously-optimized
    const githubMatch = inputUrl.match(/github\.com\/([^/\s]+)\/([^/?#\s]+)/i)
    if (githubMatch) {
      const owner = githubMatch[1]
      const repo = githubMatch[2].replace(/\.git$/, '')

      const directAssetMatch = inputUrl.match(/\/releases\/download\/([^/]+)\/([^/?#]+\.(?:mrpack|zip))/i)
      const directTag = directAssetMatch ? decodeURIComponent(directAssetMatch[1]) : null
      const directFilename = directAssetMatch ? decodeURIComponent(directAssetMatch[2]) : null

      const tagMatch = inputUrl.match(/\/releases\/tag\/([^/?#]+)/i)
      const targetTag = tagMatch ? decodeURIComponent(tagMatch[1]) : directTag

      selectedProjectName.value = repo
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

      const versionsList: { id: string; title: string }[] = []

      if (directAssetMatch && directFilename) {
        versionsList.push({
          id: inputUrl,
          title: directTag ? `${directTag} - ${directFilename}` : directFilename,
        })
      }

      try {
        const headers: Record<string, string> = {
          Accept: 'application/vnd.github.v3+json',
        }
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers }).catch(() => null)
        if (res && res.ok) {
          const releases = await res.json()
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
        }
      } catch { }

      if (versionsList.length === 0) {
        try {
          const pageRes = await fetch(`https://github.com/${owner}/${repo}/releases`).catch(() => null)
          if (pageRes && pageRes.ok) {
            const html = await pageRes.text()
            const assetRegex = /href="(\/[^/]+\/[^/]+\/releases\/download\/[^"]+\.(?:mrpack|zip))"/gi
            let m: RegExpExecArray | null
            while ((m = assetRegex.exec(html)) !== null) {
              const downloadUrl = `https://github.com${m[1]}`
              const filename = decodeURIComponent(m[1].split('/').pop() || '')
              const tag = decodeURIComponent(m[1].split('/')[4] || '')
              if (!versionsList.some((v) => v.id === downloadUrl)) {
                versionsList.push({
                  id: downloadUrl,
                  title: `${tag} - ${filename}`,
                })
              }
            }
          }
        } catch { }
      }

      if (versionsList.length > 0) {
        selectedSource.value = 'github'
        availableVersions.value = versionsList

        if (targetTag) {
          const matched = versionsList.find((v) => v.title.startsWith(targetTag) || v.id.includes(`/${targetTag}/`))
          selectedVersionId.value = matched ? matched.id : versionsList[0]?.id
        } else {
          selectedVersionId.value = versionsList[0]?.id
        }

        dialogStep.value = 'version'
        return
      } else {
        urlError.value = t('importModpack.noReleasesFound')
        return
      }
    }

    // 8. Try protocol URL
    const handled = await handleUrl(inputUrl)
    if (handled) {
      closeAll()
      return
    }

    // 9. Direct download URL (.mrpack / .zip)
    if (/\.(mrpack|zip)(\?.*)?$/i.test(inputUrl)) {
      const opened = await openModpack(inputUrl)
      if (opened.modpackPath) {
        await finishModpackInstall(opened.modpackPath, undefined, undefined, undefined)
      }
      closeAll()
      return
    }

    urlError.value = t('importModpack.invalidUrl')
  } catch (e: any) {
    urlError.value = getErrorMessage(e)
  } finally {
    urlLoading.value = false
  }
}
</script>
