<template>
  <div>
    <!-- Mod Loader Selection -->
    <div class="text-sm font-bold opacity-70 mb-2 mt-4">{{ t('modrinth.categories.modloader') }}</div>
    <div class="flex flex-wrap gap-3 mb-6 items-center justify-center">
      <v-card
        v-for="loader in loaders" :key="loader.id"
        :variant="currentTab === loader.id ? 'outlined' : 'tonal'"
        :color="currentTab === loader.id ? 'primary' : undefined"
        class="flex-1 min-w-[80px] max-w-[120px] flex flex-col items-center justify-center py-4 cursor-pointer hover:bg-white/5 transition-colors border-2"
        :style="{ borderColor: currentTab === loader.id ? 'rgba(var(--v-theme-primary), 1)' : 'transparent' }"
        @click="selectLoader(loader.id)"
      >
        <img :src="loader.icon" width="36" height="36" class="mb-2 transition-transform hover:scale-110" />
        <span class="text-xs font-semibold">{{ loader.name }}</span>
      </v-card>
    </div>

    <!-- Versions -->
    <VersionInputMinecraft
      v-if="showMinecraft"
      data-testid="version-input-minecraft"
      class="mb-4"
      :value="data.runtime.minecraft"
      :versions="versions"
      @input="onSelectMinecraft"
    />
    <v-expand-transition>
      <div v-if="currentTab !== 'vanilla'">
        <VersionInputNeoForged
          v-if="currentTab === 'neoforge'"
          data-testid="version-input-neoforge"
          :value="data.runtime.neoForged"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          @input="onSelectNeoForged"
        />
        <VersionInputForge
          v-else-if="currentTab === 'forge'"
          data-testid="version-input-forge"
          :value="data.runtime.forge"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          @input="onSelectForge"
        />
        <VersionInputFabric
          v-else-if="currentTab === 'fabric'"
          data-testid="version-input-fabric"
          :value="data.runtime.fabricLoader"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          @input="onSelectFabric"
        />
        <VersionInputQuilt
          v-else-if="currentTab === 'quilt'"
          data-testid="version-input-quilt"
          :value="data.runtime.quiltLoader"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          @input="onSelectQuilt"
        />
        <VersionInputOptifine
          v-else-if="currentTab === 'optifine'"
          :value="data.runtime.optifine"
          :forge="data.runtime.forge || ''"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          @input="onSelectOptifine"
        />
        <VersionInputLabymod
          v-else-if="currentTab === 'labymod'"
          :value="data.runtime.labyMod"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          @input="onSelectLabyMod"
        />
      </div>
    </v-expand-transition>

    <VersionInputLocal
      v-if="showLocal"
      class="mt-4"
      :value="data.version"
      :versions="versions"
      :placeholder="localPlaceholder"
      @input="onSelectLocalVersion"
    />
  </div>
</template>

<script lang=ts setup>
import VersionInputFabric from '@/components/VersionInputFabric.vue'
import VersionInputForge from '@/components/VersionInputForge.vue'
import VersionInputLabymod from '@/components/VersionInputLabymod.vue'
import VersionInputLocal from '@/components/VersionInputLocal.vue'
import VersionInputMinecraft from '@/components/VersionInputMinecraft.vue'
import VersionInputNeoForged from '@/components/VersionInputNeoForged.vue'
import VersionInputOptifine from '@/components/VersionInputOptifine.vue'
import VersionInputQuilt from '@/components/VersionInputQuilt.vue'
import { useInstanceEditVersions } from '@/composables/instanceEdit'
import { BuiltinImages } from '@/constant'
import { VersionHeader } from '@xmcl/runtime-api'
import type { InstanceData } from '@xmcl/instance'
import { ref, toRef, watch } from 'vue'

const props = withDefaults(defineProps<{
  data: Pick<InstanceData, 'runtime' | 'version'>
  versions: VersionHeader[]
  showMinecraft?: boolean
  showLocal?: boolean
  localPlaceholder?: string
}>(), {
  showMinecraft: true,
  showLocal: true,
  localPlaceholder: undefined,
})

const { t } = useI18n()

const versions = toRef(props, 'versions')

const {
  onSelectMinecraft,
  onSelectNeoForged,
  onSelectForge,
  onSelectFabric,
  onSelectQuilt,
  onSelectOptifine,
  onSelectLabyMod,
  onSelectLocalVersion,
} = useInstanceEditVersions(props.data, versions)

const loaders = [
  { id: 'forge', name: 'Forge', icon: BuiltinImages.forge },
  { id: 'fabric', name: 'Fabric', icon: BuiltinImages.fabric },
  { id: 'quilt', name: 'Quilt', icon: BuiltinImages.quilt },
  { id: 'neoforge', name: 'NeoForged', icon: BuiltinImages.neoForged },
  { id: 'optifine', name: 'OptiFine', icon: BuiltinImages.optifine },
  { id: 'labymod', name: 'LabyMod', icon: BuiltinImages.labyMod },
]

const currentTab = ref('vanilla')

watch([() => props.data.runtime, () => props.data.version], ([rt, version]) => {
  if (rt.labyMod) currentTab.value = 'labymod'
  else if (rt.quiltLoader) currentTab.value = 'quilt'
  else if (rt.fabricLoader) currentTab.value = 'fabric'
  else if (rt.neoForged) currentTab.value = 'neoforge'
  else if (rt.forge) currentTab.value = 'forge'
  else if (rt.optifine) currentTab.value = 'optifine'
  else if (version) currentTab.value = 'local'
  else currentTab.value = 'vanilla'
}, { deep: true, immediate: true })

function resetToVanilla() {
  currentTab.value = 'vanilla'
  props.data.runtime.forge = ''
  props.data.runtime.fabricLoader = ''
  props.data.runtime.quiltLoader = ''
  props.data.runtime.neoForged = ''
  props.data.runtime.labyMod = ''
  props.data.runtime.optifine = ''
  props.data.version = ''
}

function selectLoader(loader: string) {
  // Toggle off when clicking the already-selected loader, reverting to vanilla.
  if (currentTab.value === loader) {
    resetToVanilla()
    return
  }
  currentTab.value = loader
  if (loader === 'forge') {
    onSelectForge('')
  } else if (loader === 'fabric') {
    onSelectFabric('')
  } else if (loader === 'quilt') {
    onSelectQuilt('')
  } else if (loader === 'neoforge') {
    onSelectNeoForged('')
  } else if (loader === 'optifine') {
    onSelectOptifine('')
  } else if (loader === 'labymod') {
    onSelectLabyMod('')
  }
}
</script>
