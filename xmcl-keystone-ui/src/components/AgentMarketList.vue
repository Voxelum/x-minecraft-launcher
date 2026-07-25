<template>
  <section data-testid="agent-market-list" class="agent-market">
    <div class="agent-market__header">
      <div class="flex items-center gap-2 min-w-0">
        <v-icon size="18">{{ providerIcon }}</v-icon>
        <strong class="truncate">{{ providerName }}</strong>
        <span class="text-medium-emphasis truncate">{{ presentation.query }}</span>
      </div>
      <span class="text-xs text-medium-emphasis flex-shrink-0">
        {{ t('agent.marketResultCount', { count: presentation.total }) }}
      </span>
    </div>

    <div class="agent-market__items">
      <div
        v-for="item in presentation.items"
        :key="`${item.provider}:${item.id}`"
        data-testid="agent-market-item"
        class="agent-market__item"
        role="button"
        tabindex="0"
        @click="openProject(item)"
        @keydown.enter.prevent="openProject(item)"
      >
        <v-avatar size="48" rounded="sm" class="agent-market__icon">
          <v-img v-if="item.icon" :src="item.icon" cover />
          <v-icon v-else size="26">extension</v-icon>
        </v-avatar>

        <div class="agent-market__body">
          <div class="flex items-center gap-2 min-w-0">
            <strong class="truncate">{{ item.title }}</strong>
            <v-chip size="x-small" variant="tonal" label>{{ providerName }}</v-chip>
          </div>
          <div class="agent-market__description">{{ item.description }}</div>
          <div class="agent-market__meta">
            <span v-if="item.author" class="truncate">{{ item.author }}</span>
            <span v-if="item.downloads !== undefined" class="flex items-center gap-1">
              <v-icon size="13">download</v-icon>
              {{ formatDownloads(item.downloads) }}
            </span>
          </div>
        </div>

        <v-btn
          v-if="canInstall(item)"
          data-testid="agent-market-install"
          size="small"
          :variant="isInstalled(item) ? 'tonal' : 'flat'"
          :color="isInstalled(item) ? undefined : 'primary'"
          :prepend-icon="isInstalled(item) ? 'check' : 'download'"
          :loading="installing.has(projectKey(item))"
          :disabled="isInstalled(item) || installing.has(projectKey(item))"
          @click.stop="installProject(item)"
        >
          {{ isInstalled(item) ? t('agent.marketInstalled') : t('agent.marketInstall') }}
        </v-btn>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { requestAgentConfirmation } from '@/composables/agent/confirm'
import { openRouteFromAgent } from '@/composables/agent/routeReturn'
import { useCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { useModrinthInstaller } from '@/composables/modrinthInstaller'
import { useNotifier } from '@/composables/notifier'
import { useProjectInstall } from '@/composables/projectInstall'
import { useService } from '@/composables/service'
import { injection } from '@/util/inject'
import type { ProjectEntry, ProjectFile } from '@/util/search'
import type { AgentMarketProject, AgentMarketProjectListPresentation } from '@xmcl/runtime-api'
import { InstanceModsServiceKey, InstanceResourcePacksServiceKey, InstanceShaderPacksServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{
  presentation: AgentMarketProjectListPresentation
}>()
const emit = defineEmits<{
  (event: 'navigate'): void
}>()

const { t } = useI18n()
const router = useRouter()
const { notify } = useNotifier()
const { name, path, runtime } = injection(kInstance)
const { mods } = injection(kInstanceModsContext)
const resourcePacks = injection(kInstanceResourcePacks)
const shaders = injection(kInstanceShaderPacks)
const modService = useService(InstanceModsServiceKey)
const resourcePackService = useService(InstanceResourcePacksServiceKey)
const shaderPackService = useService(InstanceShaderPacksServiceKey)
const installedByAction = ref(new Set<string>())
const installing = ref(new Set<string>())

const loader = computed(() => runtime.value.forge
  ? 'forge'
  : runtime.value.fabricLoader
    ? 'fabric'
    : runtime.value.neoForged
      ? 'neoforge'
      : runtime.value.quiltLoader
        ? 'quilt'
        : undefined)

function installedFiles(item: AgentMarketProject) {
  const files = item.projectType === 'resourcepack'
    ? resourcePacks.files.value
    : item.projectType === 'shader'
      ? shaders.shaderPacks.value
      : mods.value
  return files.filter(file => item.provider === 'modrinth'
    ? file.modrinth?.projectId === item.id
    : file.curseforge?.projectId === Number(item.id))
}

const uninstallMods = (files: ProjectFile[], instancePath?: string) => {
  void modService.uninstall({
    path: instancePath ?? path.value,
    files: files.map(file => file.path),
  })
}
const uninstallResourcePacks = (files: ProjectFile[], instancePath?: string) => {
  void resourcePackService.uninstall({
    path: instancePath ?? path.value,
    files: files.map(file => file.path),
  })
}
const uninstallShaderPacks = (files: ProjectFile[], instancePath?: string) => {
  void shaderPackService.uninstall({
    path: instancePath ?? path.value,
    files: files.map(file => file.path),
  })
}

const modrinthModInstaller = useModrinthInstaller(path, runtime, mods, modService.installFromMarket, uninstallMods)
const curseforgeModInstaller = useCurseforgeInstaller(path, runtime, mods, modService.installFromMarket, uninstallMods)
const installMod = useProjectInstall(
  runtime,
  loader,
  curseforgeModInstaller,
  modrinthModInstaller,
  file => { void modService.install({ path: path.value, files: [file.path] }) },
)

const modrinthResourcePackInstaller = useModrinthInstaller(path, runtime, resourcePacks.files, resourcePackService.installFromMarket, uninstallResourcePacks)
const curseforgeResourcePackInstaller = useCurseforgeInstaller(path, runtime, resourcePacks.files, resourcePackService.installFromMarket, uninstallResourcePacks)
const installResourcePack = useProjectInstall(
  runtime,
  ref(undefined),
  curseforgeResourcePackInstaller,
  modrinthResourcePackInstaller,
  file => {
    void resourcePackService.install({ path: path.value, files: [file.path] }).then(resourcePacks.enable)
  },
)

const modrinthShaderInstaller = useModrinthInstaller(path, runtime, shaders.shaderPacks, shaderPackService.installFromMarket, uninstallShaderPacks)
const curseforgeShaderInstaller = useCurseforgeInstaller(path, runtime, shaders.shaderPacks, shaderPackService.installFromMarket, uninstallShaderPacks)
const installShader = useProjectInstall(
  runtime,
  ref(undefined),
  curseforgeShaderInstaller,
  modrinthShaderInstaller,
  file => { void shaderPackService.install({ path: path.value, files: [file.path] }) },
)

const providerName = computed(() => props.presentation.source === 'modrinth' ? 'Modrinth' : 'CurseForge')
const providerIcon = computed(() => props.presentation.source === 'modrinth' ? 'xmcl:modrinth' : 'xmcl:curseforge')

function projectKey(item: AgentMarketProject) {
  return `${item.projectType}:${item.provider}:${item.id}`
}

function canInstall(item: AgentMarketProject) {
  return item.projectType === 'mod' || item.projectType === 'resourcepack' || item.projectType === 'shader'
}

function projectTypeName(item: AgentMarketProject) {
  return t(`agent.marketType.${item.projectType}`)
}

function isInstalled(item: AgentMarketProject) {
  return installedByAction.value.has(projectKey(item)) || installedFiles(item).length > 0
}

function asProjectEntry(item: AgentMarketProject): ProjectEntry {
  return {
    id: projectKey(item),
    icon: item.icon ?? '',
    title: item.title,
    description: item.description,
    author: item.author ?? '',
    downloadCount: item.downloads,
    installed: installedFiles(item),
    modrinth: item.provider === 'modrinth' ? { project_id: item.id } as any : undefined,
    curseforge: item.provider === 'curseforge' ? { id: Number(item.id) } as any : undefined,
  }
}

function openProject(item: AgentMarketProject) {
  const route = item.projectType === 'resourcepack'
    ? '/resourcepacks'
    : item.projectType === 'shader'
      ? '/shaderpacks'
      : item.projectType === 'mod'
        ? '/mods'
        : `/store/modrinth/${item.id}`
  const target = route.startsWith('/store/') ? route : `${route}?id=${item.provider}:${item.id}`
  void openRouteFromAgent(router, target, route).then(() => emit('navigate'))
}

async function installProject(item: AgentMarketProject) {
  const key = projectKey(item)
  if (isInstalled(item) || installing.value.has(key)) return
  const accepted = await requestAgentConfirmation({
    action: 'confirm',
    title: t('agent.marketConfirmTitle', { type: projectTypeName(item) }),
    message: t('agent.marketConfirmMessage', { name: item.title }),
    details: [t('agent.marketConfirmTarget', { instance: name.value || path.value })],
    confirmLabel: t('agent.marketInstall'),
  })
  if (!accepted) return

  installing.value = new Set(installing.value).add(key)
  try {
    const entry = asProjectEntry(item)
    if (item.projectType === 'resourcepack') await installResourcePack(entry)
    else if (item.projectType === 'shader') await installShader(entry)
    else await installMod(entry)
    installedByAction.value = new Set(installedByAction.value).add(key)
  } catch (error) {
    notify({
      level: 'error',
      title: t('agent.marketInstallFailed', { type: projectTypeName(item) }),
      body: error instanceof Error ? error.message : String(error),
    })
  } finally {
    const next = new Set(installing.value)
    next.delete(key)
    installing.value = next
  }
}

function formatDownloads(value: number) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
</script>

<style scoped>
.agent-market {
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-primary), 0.22);
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.72);
}
.agent-market__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 38px;
  padding: 7px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background: rgba(var(--v-theme-primary), 0.08);
  font-size: 12px;
}
.agent-market__items {
  display: flex;
  flex-direction: column;
}
.agent-market__item {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-height: 72px;
  padding: 8px 10px;
  cursor: pointer;
  outline: none;
}
.agent-market__item + .agent-market__item {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.09);
}
.agent-market__item:hover,
.agent-market__item:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.055);
}
.agent-market__icon {
  width: 42px !important;
  height: 42px !important;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.agent-market__body {
  min-width: 0;
}
.agent-market__description {
  display: -webkit-box;
  margin-top: 3px;
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), 0.72);
  font-size: 12px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.agent-market__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin-top: 5px;
  color: rgba(var(--v-theme-on-surface), 0.52);
  font-size: 11px;
}
@media (max-width: 620px) {
  .agent-market__item {
    grid-template-columns: 38px minmax(0, 1fr);
  }
  .agent-market__icon {
    width: 38px !important;
    height: 38px !important;
  }
  .agent-market__item > .v-btn {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
