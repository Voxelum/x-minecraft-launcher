<template>
  <SettingCard :title="t('modpack.name', 1)" icon="folder_zip">
    <SettingItem long-action :title="t('modpack.modpackVersion')" :description="t('modpack.modpackVersion')">
      <template #preaction>
        <v-icon>history</v-icon>
      </template>
      <template #action>
        <v-text-field
          v-model="modpackMetadata.modpackVersion"
          hide-details
          :placeholder="modpackMetadata.modpackVersion"
          variant="outlined"
          density="compact"
          required
        >
          <template #append-inner>
            <v-btn
              v-shared-tooltip="() => 'patch'"
              size="x-small"
              variant="text"
              icon="add"
              @click="onIncr(false)"
            />
            <v-btn
              v-shared-tooltip="() => 'minor'"
              size="x-small"
              variant="text"
              icon="add_circle"
              @click="onIncr(true)"
            />
          </template>
        </v-text-field>
      </template>
    </SettingItem>
    <v-divider class="my-2" />
    <SettingItem long-action :title="t('modpack.author', 2)" :description="t('modpack.authorHint')">
      <template #preaction>
        <v-icon>person</v-icon>
      </template>
      <template #action>
        <v-text-field
          v-model="data.author"
          hide-details
          :placeholder="gameProfile.name"
          variant="outlined"
          density="compact"
          required
        />
      </template>
    </SettingItem>
    <v-divider class="my-2" />
    <SettingItem
      long-action
      :title="t('modpack.description')"
      :description="t('modpack.descriptionHint')"
    >
      <template #preaction>
        <v-icon>notes</v-icon>
      </template>
      <template #action>
        <v-text-field
          v-model="data.description"
          variant="outlined"
          density="compact"
          hide-details
          :placeholder="t('modpack.descriptionHint')"
        />
      </template>
    </SettingItem>
    <v-divider class="my-2" />
    <SettingItem long-action :title="t('modpack.url')" :description="t('modpack.urlHint')">
      <template #preaction>
        <v-icon>link</v-icon>
      </template>
      <template #action>
        <v-text-field
          v-model="data.url"
          variant="outlined"
          density="compact"
          hide-details
          :placeholder="t('modpack.urlHint')"
        />
      </template>
    </SettingItem>
    <div id="modrinth-project-anchor" />
  </SettingCard>
</template>

<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import { useInstanceModpackMetadata } from '@/composables/instanceModpackMetadata'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { inc } from 'semver'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { kUserContext } from '../composables/user'
import { kModpackExport } from '@/composables/modpack'
import { useGamepadAction } from '@/composables/gamepad'

const { data } = injection(InstanceEditInjectionKey)
const { gameProfile } = injection(kUserContext)
const { t } = useI18n()

const { modpackMetadata } = inject('modpackMetadata', useInstanceModpackMetadata())

const onIncr = (minor: boolean = false) => {
  modpackMetadata.modpackVersion =
    inc(modpackMetadata.modpackVersion, minor ? 'minor' : 'patch') || modpackMetadata.modpackVersion
}

// Gamepad X on the modpack tab exports the modpack.
const { exportModpack } = injection(kModpackExport)
useGamepadAction('X', {
  label: () => t('modpack.export'),
  handler: () => exportModpack(),
})
</script>


<style scoped="true">
.flex {
  padding: 6px 8px !important;
}

.v-btn {
  margin: 0;
}
</style>

<style>
.base-settings.modpacks .v-input--checkbox {
  padding-bottom: 1rem !important;
}
</style>
