<template>
  <div style="background: transparent; width: 100%">
    
    <!-- Mod Loader Selection -->
    <div class="text-sm font-bold opacity-70 mb-2 mt-4">{{ t('modrinth.categories.modloader') }}</div>
    <div class="flex flex-wrap gap-3 mb-6">
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
        <VersionInputLocal
          v-else-if="currentTab === 'local'"
          :value="data.version"
          :versions="versions"
          @input="onSelectLocalVersion"
        />
      </div>
    </v-expand-transition>

    <!-- Advanced Settings -->
    <v-expansion-panels variant="accordion" class="mt-6 bg-transparent">
      <v-expansion-panel elevation="0" style="background: transparent">
        <v-expansion-panel-title data-testid="add-instance-advanced" class="px-2 font-bold opacity-70">
          <v-icon start size="small">settings</v-icon> 
          {{ t('setting.advancedSettings') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text class="px-0 pt-4">
          <div class="grid grid-cols-4 gap-4">
            <v-select
              v-model="data.java"
              variant="outlined"
              class="java-select col-span-2"
              item-title="text"
              :label="t('java.location')"
              :placeholder="t('java.allocatedLong')"
              :items="javaItems"
              :menu-props="{ }"
              hide-details
              required
            />
            <v-text-field
              v-model="data.minMemory"
              variant="outlined"
              hide-details
              type="number"
              :label="t('java.minMemory')"
              :placeholder="t('java.allocatedShort')"
              required
            />
            <v-text-field
              v-model="data.maxMemory"
              variant="outlined"
              hide-details
              type="number"
              :label="t('java.maxMemory')"
              :placeholder="t('java.allocatedShort')"
              required
            />
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script lang=ts setup>
import VersionInputFabric from '@/components/VersionInputFabric.vue'
import VersionInputForge from '@/components/VersionInputForge.vue'
import VersionInputLocal from '@/components/VersionInputLocal.vue'
import VersionInputMinecraft from '@/components/VersionInputMinecraft.vue'
import VersionInputNeoForged from '@/components/VersionInputNeoForged.vue'
import VersionInputOptifine from '@/components/VersionInputOptifine.vue'
import { kInstanceCreation } from '../composables/instanceCreation'
import { kJavaContext } from '../composables/java'
import VersionInputLabymod from './VersionInputLabymod.vue'
import VersionInputQuilt from './VersionInputQuilt.vue'

import { useInstanceEditVersions } from '@/composables/instanceEdit'
import { kLocalVersions } from '@/composables/versionLocal'
import { injection } from '@/util/inject'
import { BuiltinImages } from '@/constant'
import { watch, ref, computed } from 'vue'

defineProps({
  valid: {
    type: Boolean,
    required: true,
  },
  showMinecraft: {
    type: Boolean,
    default: true,
  },
})

const { data } = injection(kInstanceCreation)
const { t } = useI18n()
const { versions } = injection(kLocalVersions)

const {
  onSelectMinecraft,
  onSelectNeoForged,
  onSelectForge,
  onSelectFabric,
  onSelectQuilt,
  onSelectOptifine,
  onSelectLabyMod,
  onSelectLocalVersion,
} = useInstanceEditVersions(data, versions)

const { all: javas } = injection(kJavaContext)
const javaItems = computed(() => javas.value.map(java => ({
  text: `Java ${java.majorVersion} (${java.version})`,
  value: java.path,
})))

const loaders = [
  { id: 'vanilla', name: 'Vanilla', icon: BuiltinImages.minecraft },
  { id: 'forge', name: 'Forge', icon: BuiltinImages.forge },
  { id: 'fabric', name: 'Fabric', icon: BuiltinImages.fabric },
  { id: 'quilt', name: 'Quilt', icon: BuiltinImages.quilt },
  { id: 'neoforge', name: 'NeoForged', icon: BuiltinImages.neoForged },
  { id: 'optifine', name: 'OptiFine', icon: BuiltinImages.optifine },
  { id: 'labymod', name: 'LabyMod', icon: BuiltinImages.labyMod },
  { id: 'local', name: t('localVersion.title'), icon: BuiltinImages.minecraft },
]

const currentTab = ref('vanilla')

watch([() => data.runtime, () => data.version], ([rt, version]) => {
  if (version) currentTab.value = 'local'
  else if (rt.labyMod) currentTab.value = 'labymod'
  else if (rt.quiltLoader) currentTab.value = 'quilt'
  else if (rt.fabricLoader) currentTab.value = 'fabric'
  else if (rt.neoForged) currentTab.value = 'neoforge'
  else if (rt.forge) currentTab.value = 'forge'
  else if (rt.optifine) currentTab.value = 'optifine'
  else currentTab.value = 'vanilla'
}, { deep: true, immediate: true })

function selectLoader(loader: string) {
  currentTab.value = loader
  if (loader === 'vanilla') {
    data.runtime.forge = ''
    data.runtime.fabricLoader = ''
    data.runtime.quiltLoader = ''
    data.runtime.neoForged = ''
    data.runtime.labyMod = ''
    data.runtime.optifine = ''
    data.version = ''
  } else if (loader === 'forge') {
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
  } else if (loader === 'local') {
    // Local versions are selected directly via VersionInputLocal, so no initial runtime reset is needed here.
  }
}

</script>

<style>
.java-select .v-select__selection {
  white-space: nowrap;
  overflow-x: hidden;
  overflow-y: hidden;
  max-width: 240px;
}
</style>
