<template>
  <v-list
    class="base-settings"
    subheader
  >
    <v-subheader>
      {{ t('version.name', 2) }}
      <div class="flex-grow" />
      <v-btn
        v-if="!isExpanded"
        icon
        @click="showAll = !showAll"
      >
        <v-icon v-if="!showAll">
          unfold_more
        </v-icon>
        <v-icon v-else>
          unfold_less
        </v-icon>
      </v-btn>
    </v-subheader>
    <VersionInputMinecraft
      :value="data.runtime.minecraft"
      @input="onSelectMinecraft"
    />
    <VersionInputNeoForged
      v-if="showNeoForged"
      :value="data.runtime.neoForged"
      :minecraft="data.runtime.minecraft"
      @input="onSelectNeoForged"
    />
    <VersionInputForge
      v-if="showForge"
      :value="data.runtime.forge"
      :minecraft="data.runtime.minecraft"
      @input="onSelectForge"
    />
    <VersionInputFabric
      v-if="showFabric"
      :value="data.runtime.fabricLoader"
      :minecraft="data.runtime.minecraft"
      @input="onSelectFabric"
    />
    <VersionInputQuilt
      v-if="showQuilt"
      :value="data.runtime.quiltLoader"
      :minecraft="data.runtime.minecraft"
      @input="onSelectQuilt"
    />
    <VersionInputOptifine
      v-if="showOptifine"
      :value="data.runtime.optifine"
      :forge="data.runtime.forge || ''"
      :minecraft="data.runtime.minecraft"
      @input="onSelectOptifine"
    />
    <VersionInputLabymod
      v-if="showLabyMod"
      :value="data.runtime.labyMod"
      :minecraft="data.runtime.minecraft"
      @input="onSelectLabyMod"
    />
    <VersionInputLocal
      :value="data.version"
      :versions="versions"
      @input="onSelectLocalVersion"
    />
  </v-list>
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
import { kLocalVersions } from '@/composables/versionLocal'
import { injection } from '@/util/inject'
import { InstanceEditInjectionKey, useInstanceEditVersions } from '../composables/instanceEdit'

const props = defineProps<{
  isExpanded: boolean
}>()

const {
  data,
} = injection(InstanceEditInjectionKey)
const { versions } = injection(kLocalVersions)

const showAll = ref(false)
const showForge = computed(() => props.isExpanded || showAll.value || data.runtime.forge)
const showNeoForged = computed(() => props.isExpanded || showAll.value || data.runtime.neoForged)
const showFabric = computed(() => props.isExpanded || showAll.value || data.runtime.fabricLoader)
const showQuilt = computed(() => props.isExpanded || showAll.value || data.runtime.quiltLoader)
const showOptifine = computed(() => props.isExpanded || showAll.value || data.runtime.optifine)
const showLabyMod = computed(() => props.isExpanded || showAll.value || data.runtime.labyMod)

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

const { t } = useI18n()
</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important
}
.v-btn {
  margin: 0
}
</style>
