<template>
  <SettingCard :title="t('version.name', 2)" icon="layers">
    <template #header-action>
      <v-btn
        :disabled="!versionHeader || isModified"
        size="small"
        variant="text"
        @click="onFix"
      >
        <v-icon start>build</v-icon>
        {{ t('version.checkIntegrity') }}
      </v-btn>
    </template>

    <ModloaderSelector
      :data="data"
      :versions="versions"
      :local-placeholder="versionHeader ? versionHeader.id : undefined"
    />

    <SimpleDialog
      v-model="reinstallDialogModel"
      :width="390"
      :title="t('localVersion.reinstallTitle', { version: reinstallDialog.target.value })"
      :confirm-icon="'build'"
      :color="'orange en-1'"
      :confirm="t('shared.yes')"
      @cancel="reinstallDialog.cancel"
      @confirm="reinstallDialog.confirm"
    >
      {{ t('localVersion.reinstallDescription') }}
    </SimpleDialog>
  </SettingCard>
</template>

<script lang="ts" setup>
import ModloaderSelector from '@/components/ModloaderSelector.vue'
import SettingCard from '@/components/SettingCard.vue'
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useService } from '@/composables'
import { useSimpleDialog } from '@/composables/dialog'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kLocalVersions } from '@/composables/versionLocal'
import { injection } from '@/util/inject'
import { InstallServiceKey } from '@xmcl/runtime-api'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'

const { data, isModified } = injection(InstanceEditInjectionKey)
const { versions } = injection(kLocalVersions)

const { versionHeader } = injection(kInstanceVersion)
function onFix() {
  if (versionHeader.value) {
    reinstallDialog.show(versionHeader.value.id)
  }
}

const { reinstall } = useService(InstallServiceKey)
const reinstallDialog = useSimpleDialog<string>((v) => {
  if (!v) return
  reinstall({
    version: v,
    side: 'client',
  })
})
const reinstallDialogModel = reinstallDialog.model

const { t } = useI18n()
</script>
