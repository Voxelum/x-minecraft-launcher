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
  </SettingCard>

  <SettingCard :title="t('modpack.export')" icon="ios_share">
    <SettingItem
      :title="t('modpack.emitCurseforge')"
      class="cursor-pointer"
      @click="modpackMetadata.emitCurseforge = !modpackMetadata.emitCurseforge"
    >
      <template #preaction>
        <v-icon>xmcl:curseforge</v-icon>
      </template>
      <template #action>
        <v-switch
          v-model="modpackMetadata.emitCurseforge"
          color="primary"
          hide-details
          inset
          density="compact"
          @click.stop
        />
      </template>
    </SettingItem>
    <v-divider class="my-2" />
    <SettingItem
      :title="t('modpack.emitModrinth')"
      class="cursor-pointer"
      @click="modpackMetadata.emitModrinth = !modpackMetadata.emitModrinth"
    >
      <template #preaction>
        <v-icon>xmcl:modrinth</v-icon>
      </template>
      <template #action>
        <v-switch
          v-model="modpackMetadata.emitModrinth"
          color="primary"
          hide-details
          inset
          density="compact"
          @click.stop
        />
      </template>
    </SettingItem>
    <template v-if="modpackMetadata.emitModrinth">
      <v-divider class="my-2" />
      <SettingItem
        :title="t('modpack.emitModrinthStrict')"
        class="cursor-pointer"
        @click="modpackMetadata.emitModrinthStrict = !modpackMetadata.emitModrinthStrict"
      >
        <template #preaction>
          <v-icon class="opacity-60">verified</v-icon>
        </template>
        <template #subtitle>
          <div class="flex items-center gap-2 flex-wrap">
            <span>{{ t('modpack.emitModrinthStrictDescription') }}</span>
            <a
              class="inline-flex items-center rounded border border-dashed border-green-300 px-1 text-xs"
              target="browser"
              href="https://docs.modrinth.com/docs/modpacks/format_definition/#downloads"
              @click.stop
            >
              docs.modrinth.com
            </a>
          </div>
        </template>
        <template #action>
          <v-switch
            v-model="modpackMetadata.emitModrinthStrict"
            color="primary"
            hide-details
            inset
            density="compact"
            @click.stop
          />
        </template>
      </SettingItem>
    </template>
    <v-divider class="my-2" />
    <SettingItem
      :title="t('modpack.includeAssets')"
      class="cursor-pointer"
      @click="modpackMetadata.emitOffline = !modpackMetadata.emitOffline"
    >
      <template #preaction>
        <v-icon>texture</v-icon>
      </template>
      <template #action>
        <v-switch
          v-model="modpackMetadata.emitOffline"
          color="primary"
          hide-details
          inset
          density="compact"
          @click.stop
        />
      </template>
    </SettingItem>
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
