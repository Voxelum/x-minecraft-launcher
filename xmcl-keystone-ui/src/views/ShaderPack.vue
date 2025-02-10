<template>
  <MarketBase
    :items="all"
    :item-height="itemHeight"
    :plans="{}"
    :error="modrinthError"
    :class="{
      dragover,
    }"
    :loading="loading"
    @load="loadMore"
  >
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on, index }">
      <v-subheader
        v-if="typeof item === 'string'"
        :style="{ height: itemHeight + 'px' }"
        class="flex"
      >
        {{ item === 'enabled' ? t("shaderPack.enabled") : item === 'disabled' ? t("shaderPack.disabled") :
          t('modInstall.search') }}

        <div class="flex-grow" />
        <v-btn
          v-if="index === 0"
          v-shared-tooltip="_ => t('mod.denseView')"
          icon
          @click="denseView = !denseView"
        >
          <v-icon> {{ denseView ? 'reorder' : 'list' }} </v-icon>
        </v-btn>
      </v-subheader>
      <ShaderPackItem
        v-else
        :pack="item"
        :selection-mode="selectionMode"
        :selected="selected"
        :dense="denseView"
        :item-height="itemHeight"
        :has-update="hasUpdate"
        :checked="checked"
        :install="onInstallProject"
        @click="on.click"
      />
    </template>
    <template #content="{ selectedModrinthId, selectedCurseforgeId, selectedItem }">
      <Hint
        v-if="dragover"
        icon="save_alt"
        :text="t('shaderPack.dropHint')"
        class="h-full"
      />
      <MarketProjectDetailModrinth
        v-if="(selectedItem?.modrinth || selectedModrinthId)"
        :modrinth="selectedItem?.modrinth"
        :project-id="selectedModrinthId"
        :installed="selectedItem?.installed || getInstalledModrinth(selectedModrinthId)"
        :game-version="gameVersion"
        :categories="modrinthCategories"
        :all-files="shaderProjectFiles"
        :curseforge="selectedItem?.curseforge?.id || selectedItem?.curseforgeProjectId"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onUninstall([$event])"
        @category="toggleCategory"
      />
      <MarketProjectDetailCurseforge
        v-else-if="(selectedItem?.curseforge || selectedCurseforgeId)"
        :curseforge="selectedItem?.curseforge"
        :curseforge-id="Number(selectedCurseforgeId)"
        :installed="selectedItem?.installed || getInstalledCurseforge(Number(selectedCurseforgeId))"
        :game-version="gameVersion"
        :category="curseforgeCategory"
        :all-files="shaderProjectFiles"
        :modrinth="selectedModrinthId"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onUninstall([$event])"
        @category="curseforgeCategory = $event"
      />
      <ShaderPackDetailResource
        v-else-if="isShaderPackProject(selectedItem)"
        :shader-pack="selectedItem"
        :installed="selectedItem.files || []"
        :runtime="runtime"
        @enable="onEnable"
      />
      <MarketRecommendation
        v-else
        modrinth="shader"
        @modrinth="modrinthCategories.push($event.name)"
      />
    </template>
    <v-dialog
      v-model="model"
      width="600"
    >
      <v-card>
        <v-card-title>
          {{ t('shaderPack.noShaderMod') }}
        </v-card-title>
        <v-card-text>
          {{ t('shaderPack.noShaderModHint') }}
          <div>
            {{ t('shaderPack.noShaderModInstallHint') }}
          </div>
          <v-list nav>
            <v-list-item
              :disabled="shouldDisableIris"
              @click="navigateToMod('iris')"
            >
              <v-list-item-avatar>
                <img :src="BuiltinImages.iris">
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>
                  Iris
                </v-list-item-title>
                <v-list-item-subtitle>
                  <a
                    href="https://modrinth.com/mod/iris"
                    @click.stop
                  >https://modrinth.com/mod/iris</a>
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action class="flex flex-row flex-grow-0 gap-1">
                <AvatarChip
                  :avatar="BuiltinImages.fabric"
                  small
                  text="Fabric"
                />
                <AvatarChip
                  :avatar="BuiltinImages.neoForged"
                  small
                  text="Neoforge"
                />
                <AvatarChip
                  :avatar="BuiltinImages.quilt"
                  small
                  text="Quilt"
                />
              </v-list-item-action>
            </v-list-item>
            <v-list-item
              :disabled="shouldDisableOptifine"
              @click="navigateToMod('optifine')"
            >
              <v-list-item-avatar>
                <img :src="BuiltinImages.optifine">
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>
                  Optifine
                </v-list-item-title>
                <v-list-item-subtitle>
                  <a
                    href="https://optifine.net/home"
                    @click.stop
                  >https://optifine.net/home</a>
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action class="flex flex-row gap-1 flex-grow-0">
                <AvatarChip
                  :avatar="BuiltinImages.forge"
                  small
                  text="Forge"
                />
                <AvatarChip
                  :avatar="BuiltinImages.minecraft"
                  small
                  text="Vanilla"
                />
              </v-list-item-action>
            </v-list-item>
            <v-list-item
              :disabled="shouldDisableOculus"
              @click="navigateToMod('oculus')"
            >
              <v-list-item-avatar>
                <img :src="BuiltinImages.oculus">
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>
                  Oculus
                </v-list-item-title>
                <v-list-item-subtitle>
                  <a
                    href="https://www.curseforge.com/minecraft/mc-mods/oculus"
                    @click.stop
                  >https://www.curseforge.com/minecraft/mc-mods/oculus</a>
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action class="flex flex-row gap-1 flex-grow-0">
                <AvatarChip
                  :avatar="BuiltinImages.forge"
                  small
                  text="Forge"
                />
                <AvatarChip
                  :avatar="BuiltinImages.neoForged"
                  small
                  text="Neoforge"
                />
              </v-list-item-action>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-dialog>
    <!-- <DeleteDialog
      :title="t('shaderPack.deletion') "
      :width="400"
      persistent
      @confirm="onConfirmDeleted"
      @cancel="onCancelDelete"
    >
      <div
        style="overflow: hidden; word-break: break-all;"
      >
        {{ t('shaderPack.deletionHint', { path: deletingPack ? deletingPack.path : '' }) }}
      </div>
    </DeleteDialog> -->
  </MarketBase>
</template>

<script lang="ts" setup>
import AvatarChip from '@/components/AvatarChip.vue'
import Hint from '@/components/Hint.vue'
import MarketBase from '@/components/MarketBase.vue'
import MarketProjectDetailCurseforge from '@/components/MarketProjectDetailCurseforge.vue'
import MarketProjectDetailModrinth from '@/components/MarketProjectDetailModrinth.vue'
import MarketRecommendation from '@/components/MarketRecommendation.vue'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { kCurseforgeInstaller, useCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useSimpleDialog } from '@/composables/dialog'
import { useGlobalDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { useInstanceModLoaderDefault } from '@/composables/instanceModLoaderDefault'
import { InstanceShaderFile, kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { kModrinthInstaller, useModrinthInstaller } from '@/composables/modrinthInstaller'
import { usePresence } from '@/composables/presence'
import { useProjectInstall } from '@/composables/projectInstall'
import { kCompact } from '@/composables/scrollTop'
import { useService } from '@/composables/service'
import { ShaderPackProject, kShaderPackSearch } from '@/composables/shaderPackSearch'
import { useToggleCategories } from '@/composables/toggleCategories'
import { BuiltinImages } from '@/constant'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { InstanceShaderPacksServiceKey } from '@xmcl/runtime-api'
import ShaderPackDetailResource from './ShaderPackDetailResource.vue'
import ShaderPackItem from './ShaderPackItem.vue'

const {
  modrinthError,
  loading,

  enabled,
  disabled,
  others,

  keyword,
  curseforgeCategory,
  shaderProjectFiles,
  modrinthCategories,
  loadMore,
  gameVersion,
  effect,
} = injection(kShaderPackSearch)
const { runtime, path } = injection(kInstance)

const { model, show: showInstallShaderWizard } = useSimpleDialog<boolean>(() => {})

const shouldDisableIris = computed(() => !!runtime.value.forge || !!runtime.value.optifine)
const shouldDisableOculus = computed(() => !!runtime.value.fabricLoader || !!runtime.value.optifine || !!runtime.value.quiltLoader)
const shouldDisableOptifine = computed(() => !!runtime.value.fabricLoader || !!runtime.value.neoForged || !!runtime.value.quiltLoader)

effect()

const { shaderPacks } = injection(kInstanceShaderPacks)
const getInstalledModrinth = (projectId: string) => {
  const allPacks = shaderPacks.value
  return allPacks.filter((m) => m.modrinth?.projectId === projectId)
}
const getInstalledCurseforge = (modId: number | undefined) => {
  const allPacks = shaderPacks.value
  return allPacks.filter((m) => m.curseforge?.projectId === modId)
}

const all = computed(() => {
  const result: (string | ProjectEntry)[] = []

  if (enabled.value.length > 0) {
    result.push(
      'enabled' as string,
      ...enabled.value,
    )
  }
  if (disabled.value.length > 0) {
    result.push(
      'disabled' as string,
      ...disabled.value,
    )
  }

  if (others.value.length > 0) {
    result.push(
      'search' as string,
      ...others.value,
    )
  }

  return result
})

const toggleCategory = useToggleCategories(modrinthCategories)

const { t } = useI18n()

const isShaderPackProject = (p: ProjectEntry<ProjectFile> | undefined): p is ShaderPackProject => !!p

const { shaderPack } = injection(kInstanceShaderPacks)

const onUninstall = (files: ProjectFile[]) => {
  shaderPack.value = ''
  uninstall(path.value, files.map(f => f.path))
}
const onEnable = (f: ProjectFile | string) => {
  if (!shaderMod.value && !runtime.value.optifine) {
    showInstallShaderWizard(true)
    return
  }
  shaderPack.value = typeof f === 'string' ? f : (f as InstanceShaderFile).fileName
}

// Reset all filter
onUnmounted(() => {
  keyword.value = ''
  modrinthCategories.value = []
})

// Presence
const { name } = injection(kInstance)
usePresence(computed(() => t('presence.shaderPack', { instance: name.value })))

// Drop
const { dragover } = useGlobalDrop({
  onEnter: () => { },
  onDrop: async (t) => {
    const paths = [] as string[]
    for (const f of t.files) {
      paths.push(f.path)
    }
    const resources = await install(path.value, paths)
    shaderPack.value = basename(resources[0])
  },
  onLeave: () => { },
})

// Page compact
const compact = injection(kCompact)
onMounted(() => {
  compact.value = true
})

const installModloaders = useInstanceModLoaderDefault()
const { shaderMod } = injection(kInstanceShaderPacks)

function installMoadloadersWrapped(...args: Parameters<typeof installModloaders>) {
  if (!shaderMod.value && !runtime.value.optifine) {
    showInstallShaderWizard(true)
    throw new Error('No shader mod installed')
  }
  return installModloaders(...args)
}

const { push } = useRouter()
function navigateToMod(type: string) {
  if (type === 'iris') {
    push('/mods?id=modrinth:YL57xq9U')
  } else if (type === 'oculus') {
    push('/mods?id=curseforge:581495')
  } else if (type === 'optifine') {
    push('/mods?keyword=optifine')
  }
}

const { installFromMarket, install, uninstall } = useService(InstanceShaderPacksServiceKey)
// modrinth installer
const modrinthInstaller = useModrinthInstaller(
  path,
  runtime,
  shaderProjectFiles,
  installFromMarket,
  onUninstall,
  installMoadloadersWrapped,
)
provide(kModrinthInstaller, modrinthInstaller)

// curseforge installer
const curseforgeInstaller = useCurseforgeInstaller(
  path,
  runtime,
  shaderProjectFiles,
  installFromMarket,
  onUninstall,
  installMoadloadersWrapped,
)
provide(kCurseforgeInstaller, curseforgeInstaller)

const onInstallProject = useProjectInstall(
  runtime,
  ref(undefined),
  curseforgeInstaller,
  modrinthInstaller,
  (f) => {
    install(path.value, [f.path])
    onEnable(f)
  },
)

// dense
const denseView = useLocalStorageCacheBool('shader-pack-dense-view', false)
const itemHeight = computed(() => denseView.value ? 48 : 80)
</script>
