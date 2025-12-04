<template>
  <v-list
    class="base-settings"
    subheader
    color="transparent"
  >
    <v-subheader>
      {{ t('version.name', 2) }}
      <div class="flex-grow" />
      <v-btn
        text
        :disabled="!versionHeader || isModified"
        @click="onFix"
      >
        <v-icon left>
          build
        </v-icon>
        {{ t('version.checkIntegrity') }}
      </v-btn>
      <v-btn
        v-if="!isExpanded"
        icon
        @click="showAll = !showAll"
      >
        <v-icon v-if="!showAll">
          add
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
      :placeholder="versionHeader ? versionHeader.id : undefined"
      @input="onSelectLocalVersion"
    />
    <SimpleDialog
      v-model="reinstallDialogModel"
      :width="390"
      :title="t('localVersion.reinstallTitle', { version: reinstallDialog.target.value })"
      :confirm-icon="'build'"
      :color="'orange en-1'"
      :confirm="t('yes')"
      @cancel="reinstallDialog.cancel"
      @confirm="reinstallDialog.confirm"
    >
      {{ t('localVersion.reinstallDescription') }}
    </SimpleDialog>
  </v-list>
</template>

<script lang=ts setup>
import SimpleDialog from '@/components/SimpleDialog.vue'
import VersionInputFabric from '@/components/VersionInputFabric.vue'
import VersionInputForge from '@/components/VersionInputForge.vue'
import VersionInputLabymod from '@/components/VersionInputLabymod.vue'
import VersionInputLocal from '@/components/VersionInputLocal.vue'
import VersionInputMinecraft from '@/components/VersionInputMinecraft.vue'
import VersionInputNeoForged from '@/components/VersionInputNeoForged.vue'
import VersionInputOptifine from '@/components/VersionInputOptifine.vue'
import VersionInputQuilt from '@/components/VersionInputQuilt.vue'
import { useService } from '@/composables'
import { useSimpleDialog } from '@/composables/dialog'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kLocalVersions } from '@/composables/versionLocal'
import { injection } from '@/util/inject'
import { InstallServiceKey } from '@xmcl/runtime-api'
import { InstanceEditInjectionKey, useInstanceEditVersions } from '../composables/instanceEdit'
import { kInstance } from '@/composables/instance'

const props = defineProps<{
  isExpanded: boolean
}>()

const { instance } = injection(kInstance)
const {
  data,
  isModified,
} = injection(InstanceEditInjectionKey)
const { versions } = injection(kLocalVersions)

const showAll = ref(false)
const showForge = computed(() => props.isExpanded || showAll.value || instance.value.runtime.forge)
const showNeoForged = computed(() => props.isExpanded || showAll.value || instance.value.runtime.neoForged)
const showFabric = computed(() => props.isExpanded || showAll.value || instance.value.runtime.fabricLoader)
const showQuilt = computed(() => props.isExpanded || showAll.value || instance.value.runtime.quiltLoader)
const showOptifine = computed(() => props.isExpanded || showAll.value || instance.value.runtime.optifine)
const showLabyMod = computed(() => props.isExpanded || showAll.value || instance.value.runtime.labyMod)

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

const { versionHeader } = injection(kInstanceVersion)
function onFix() {
  if (versionHeader.value) {
    reinstallDialog.show(versionHeader.value.id)
  }
}

const { reinstall } = useService(InstallServiceKey)
const reinstallDialog = useSimpleDialog<string>((v) => {
  if (!v) return
  reinstall(v)
})
const reinstallDialogModel = reinstallDialog.model

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
