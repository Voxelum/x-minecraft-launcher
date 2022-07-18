<template>
  <v-container
    class="versions-setting h-full pb-0 overflow-y-hidden"
    grid-list-md
  >
    <div class="flex flex-col h-full overflow-auto gap-1 mt-2">
      <v-card-title>
        {{ t("versionSetting.title") }}
      </v-card-title>
      <v-tabs
        v-model="active"
        background-color="transparent"
        class="flex-grow flex flex-col bg-transparent"
        mandatory
        fixed-tabs
        :color="barColor"
        :slider-color="barColor"
      >
        <v-tab>
          <div class="version-tab">
            {{ t("localVersion.title") }}
            <div class="subtitle">
              {{ localVersion ? localVersion.id : '' }}
            </div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Minecraft
            <div class="subtitle">
              {{ data.minecraft }}
            </div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Forge
            <div class="subtitle">
              {{ data.forge || t("versionSetting.unset") }}
            </div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Fabric
            <div class="subtitle">
              {{ data.fabricLoader || t("versionSetting.unset") }}
            </div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Quilt
            <div class="subtitle">
              {{ data.quilt || t("versionSetting.unset") }}
            </div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Optifine
            <div class="subtitle">
              {{ data.optifine || t("versionSetting.unset") }}
            </div>
          </div>
        </v-tab>
      </v-tabs>
      <v-tabs-items
        v-model="active"
        background-color="transparent"
        class="h-full overflow-auto"
        @mousewheel.stop
      >
        <v-tab-item
          class="h-full overflow-auto"
          @mousewheel.stop
        >
          <local-version-view
            :value="localVersion"
            :filter-text="filterText"
            @input="setLocalVersion"
          />
        </v-tab-item>
        <v-tab-item
          class="h-full overflow-auto"
          @mousewheel.stop
        >
          <version-list
            :can-disable="false"
            :refreshing="refreshingMinecraft"
            :refresh-text="t('minecraftVersion.empty')"
            :versions="minecraftVersions"
            :install="installMinecraft"
            @select="setMinecraft"
            @show="showVersionDirectory"
          >
            <template #header>
              <v-checkbox
                v-model="showAlpha"
                :label="t('minecraftVersion.showAlpha')"
              />
            </template>
          </version-list>
        </v-tab-item>
        <v-tab-item
          class="h-full overflow-auto"
          @mousewheel.stop
        >
          <version-list
            :can-disable="true"
            :refreshing="refreshingForge"
            :disable-text="t('forgeVersion.disable')"
            :refresh-text="t('forgeVersion.empty', { version: data.minecraft })"
            :versions="forgeVersions"
            :install="installForge"
            @select="setForge"
            @disable="setForge('')"
            @show="showVersionDirectory"
          >
            <template #header>
              <v-checkbox
                v-model="recommendedOnly"
                :label="t('forgeVersion.showRecommendedAndLatestOnly')"
              />
              <v-spacer />
              <v-checkbox
                v-model="canShowBuggy"
                :label="t('forgeVersion.showBuggy')"
              />
            </template>
          </version-list>
        </v-tab-item>
        <v-tab-item
          class="h-full overflow-auto"
          @mousewheel.stop
        >
          <version-list
            :can-disable="true"
            :refreshing="refreshingFabric"
            :disable-text="t('fabricVersion.disable')"
            :refresh-text="t('fabricVersion.empty', { version: data.minecraft })"
            :versions="fabricVersions"
            :install="installFabric"
            @show="showVersionDirectory"
            @select="setFabric"
            @disable="setFabric('')"
          >
            <template #header>
              <v-checkbox
                v-model="showStableOnly"
                :label="t('fabricVersion.showStableOnly')"
              />
            </template>
          </version-list>
        </v-tab-item>
        <v-tab-item
          class="h-full overflow-auto"
          @mousewheel.stop
        >
          <version-list
            :can-disable="true"
            :refreshing="refreshingQuilt"
            :disable-text="t('quiltVersion.disable')"
            :refresh-text="t('quiltVersion.empty', { version: data.minecraft })"
            :versions="quiltVersions"
            :install="installQuilt"
            @show="showVersionDirectory"
            @select="setQuilt"
            @disable="setQuilt('')"
          >
            <!-- <template #header>
              <v-checkbox
                v-model="showStableOnly"
                :label="t('fabricVersion.showStableOnly')"
              />
            </template> -->
          </version-list>
        </v-tab-item>
        <v-tab-item
          class="h-full overflow-auto"
          @mousewheel.stop
        >
          <version-list
            :can-disable="true"
            :disable-text="t('optifineVersion.disable')"
            :refreshing="refreshingOptifine"
            :refresh-text="t('optifineVersion.empty', { version: data.minecraft })"
            :versions="optifineVersions"
            :install="installOptifine"
            @show="showVersionDirectory"
            @select="setOptifine"
            @disable="setOptifine('')"
          />
        </v-tab-item>
      </v-tabs-items>
    </div>
    <v-fab-transition>
      <v-btn
        v-if="active !== 0"
        large
        absolute

        fab
        class="right-10 bottom-10"
        color="primary"
        :loading="refreshing"
        @dragover.prevent
        @click="refresh"
      >
        <v-icon>refresh</v-icon>
      </v-btn>
    </v-fab-transition>
  </v-container>
</template>

<script lang=ts setup>
import { getResolvedVersion, InstallServiceKey, LocalVersionHeader, VersionServiceKey } from '@xmcl/runtime-api'
import { useInstance } from '../composables/instance'
import { useFabricVersionList, useForgeVersionList, useMinecraftVersionList, useOptifineVersionList, useQuiltVersionList } from '../composables/versionList'
import LocalVersionView from './VersionLocalView.vue'
import { useAutoSaveLoad, useI18n, useRouter, useService } from '/@/composables'
import VersionList from '../components/VersionList.vue'

const props = defineProps<{ target?: string }>()
const { replace } = useRouter()

const targetToId: Record<string, number> = {
  minecraft: 1,
  forge: 2,
  fabric: 3,
  quilt: 4,
  optifine: 5,
}
const idToTarget = ['minecraft', 'forge', 'fabric', 'quilt', 'optifine']

const active = computed({
  get() { return props.target ? (targetToId[props.target] ?? 0) : 0 },
  set(v: number) {
    replace({ query: { target: idToTarget[v - 1] ?? undefined } })
  },
})

const filterText = ref('')

const data = reactive({
  minecraft: '',
  forge: '',
  fabricLoader: '',
  yarn: '',
  optifine: '',
  quilt: '',

  id: '',

  // unused
  liteloader: '',
})

const { installMinecraft, installForge, installFabric, installOptifine, installQuilt } = useService(InstallServiceKey)
const { t } = useI18n()

const minecraftVersion = computed(() => data.minecraft)
const { refresh: refreshMinecraft, refreshing: refreshingMinecraft, items: minecraftVersions, showAlpha } = useMinecraftVersionList(computed(() => data.minecraft))
const { refresh: refreshForge, refreshing: refreshingForge, items: forgeVersions, recommendedOnly, canShowBuggy } = useForgeVersionList(minecraftVersion, computed(() => data.forge))
const { refresh: refreshFabric, refreshing: refreshingFabric, items: fabricVersions, showStableOnly } = useFabricVersionList(minecraftVersion, computed(() => data.fabricLoader))
const { refresh: refreshOptifine, refreshing: refreshingOptifine, items: optifineVersions } = useOptifineVersionList(minecraftVersion, computed(() => data.forge), computed(() => data.optifine))
const { refresh: refreshQuilt, refreshing: refreshingQuilt, items: quiltVersions } = useQuiltVersionList(minecraftVersion, computed(() => data.quilt))

const refreshing = computed(() => {
  if (active.value === 1) return refreshingMinecraft.value
  if (active.value === 2) return refreshingForge.value
  if (active.value === 3) return refreshingFabric.value
  if (active.value === 4) return refreshingQuilt.value
  if (active.value === 5) return refreshingOptifine.value
  return false
})

if (active.value === 1 && minecraftVersions.value.length === 0) {
  refreshMinecraft()
}

watch(active, (current) => {
  if (current === 1 && minecraftVersions.value.length === 0) {
    refreshMinecraft()
  }
})

const { editInstance: edit, runtime, version } = useInstance()
const { state, showVersionDirectory } = useService(VersionServiceKey)
const barColor = computed(() => {
  switch (active.value) {
    case 0: return 'currentColor'
    case 1: return 'primary'
    case 2: return 'brown'
    case 3: return 'orange'
    case 4: return 'purple'
    case 5: return 'cyan'
    default: return 'primary'
  }
})

const localVersion = computed(() => {
  const result = getResolvedVersion(state.local, data, data.id)
  return result
})

function setLocalVersion(v: LocalVersionHeader) {
  data.minecraft = v.minecraft
  data.forge = v.forge
  data.liteloader = v.liteloader
  data.fabricLoader = v.fabric
  data.optifine = v.optifine
  data.quilt = v.quilt
  data.yarn = ''
  data.id = v.id ?? ''
}
function setMinecraft(v: string) {
  if (data.minecraft !== v && v) {
    data.minecraft = v
    data.forge = ''
    data.liteloader = ''
    data.fabricLoader = ''
    data.yarn = ''
    data.quilt = ''
    data.optifine = ''
    data.id = ''
  }
}
function setOptifine(v: string) {
  if (v !== data.optifine) {
    data.optifine = v// `${v.type}_${v.patch}`
    data.liteloader = ''
    data.fabricLoader = ''
    data.id = ''
    data.quilt = ''
  }
}
function setForge(v: string) {
  if (v !== data.forge) {
    data.forge = v
    data.id = ''
    data.liteloader = ''
    data.fabricLoader = ''
    data.quilt = ''
  }
}
function setFabric(version: string) {
  if (version !== data.fabricLoader) {
    data.id = ''
    data.fabricLoader = version
    data.liteloader = ''
    data.optifine = ''
    data.forge = ''
    data.quilt = ''
  }
}

function setQuilt(version: string) {
  if (version !== data.quilt) {
    data.id = ''
    data.fabricLoader = ''
    data.liteloader = ''
    data.optifine = ''
    data.forge = ''
    data.quilt = version
  }
}

function installOptifine_(item: any) {
  return installOptifine({ ...item, forgeVersion: data.forge })
}

function refresh() {
  if (active.value === 1) {
    refreshMinecraft(true)
  } else if (active.value === 2) {
    refreshForge(true)
  } else if (active.value === 3) {
    refreshFabric(true)
  } else if (active.value === 4) {
    refreshQuilt(true)
  } else if (active.value === 5) {
    refreshOptifine(true)
  }
}

function save() {
  if (data.minecraft.length > 0) {
    edit({
      version: data.id,
      runtime: {
        minecraft: data.minecraft,
        forge: data.forge,
        fabricLoader: data.fabricLoader,
        yarn: data.yarn,
        quiltLoader: data.quilt,
        liteloader: data.liteloader,
        optifine: data.optifine,
      },
    })
  }
}
async function load() {
  const { forge, minecraft, liteloader, fabricLoader, yarn, optifine, quiltLoader } = runtime.value
  data.id = version.value
  data.minecraft = minecraft
  data.forge = forge ?? ''
  data.yarn = yarn ?? ''
  data.fabricLoader = fabricLoader ?? ''
  data.quilt = quiltLoader ?? ''
  data.optifine = optifine ?? ''
  data.liteloader = liteloader ?? ''
}

useAutoSaveLoad(save, load)

</script>

<style scoped=true>

.subtitle {
  color: grey;
  font-size: 14px;
  @apply break-words whitespace-nowrap overflow-auto max-w-40;
}
.versi
on-tab {
  max-width: 100px;
  min-width: 100px;
}
</style>

<style>
.versions-setting .v-window__container {
  height: 100%;
}

.versions-setting .v-tabs-items {
  background: transparent !important;
  background-color: transparent !important;
}

</style>
