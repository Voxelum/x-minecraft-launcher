<template>
  <v-list
    class="base-settings z-1"
    color="transparent"
  >
    <SettingItem :title="t('modpack.modpackVersion')" :description="t('modpack.modpackVersion')">
      <template #preaction>
        <v-icon>history</v-icon>
      </template>
      <template #action>
        <v-text-field
          v-model="modpackMetadata.modpackVersion"
          hide-details
          :placeholder="modpackMetadata.modpackVersion"
          outlined
          filled
          dense
          required
        >
          <template #append>
            <div>
              <v-icon @click="onIncr(true)">add_circle</v-icon>
              <v-icon @click="onIncr(false)">add</v-icon>
            </div>
          </template>
        </v-text-field>
      </template>
    </SettingItem>
    <SettingItem :title="t('modpack.author', 2)" :description="t('modpack.authorHint')">
      <template #action>
        <v-text-field
          v-model="data.author"
          hide-details
          :placeholder="gameProfile.name"
          outlined
          filled
          dense
          required
        />
      </template>
    </SettingItem>
    <v-list-item style="margin-top: 5px">
      <v-list-item-content>
        <v-list-item-title>
          {{ t("modpack.description") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-text-field
            v-model="data.description"
            class="m-1 mt-2"
            outlined
            filled
            dense
            hide-details
            :placeholder="t('modpack.descriptionHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <SettingItem long-action :title="t('modpack.url')" :description="t('modpack.urlHint')">
      <template #action>
        <v-text-field
          v-model="data.url"
          class="m-1 mt-2"
          outlined
          filled
          dense
          hide-details
          :placeholder="t('modpack.urlHint')"
        />
      </template>
    </SettingItem>

    <v-checkbox
      v-model="modpackMetadata.emitCurseforge"
      :label="t('modpack.emitCurseforge')"
      class="z-10"
      prepend-icon="$vuetify.icons.curseforge"
      hide-details
    />
    <v-checkbox
      v-model="modpackMetadata.emitModrinth"
      :label="t('modpack.emitModrinth')"
      class="z-10"
      hide-details
      prepend-icon="$vuetify.icons.modrinth"
    />

    <v-checkbox
      v-if="modpackMetadata.emitModrinth"
      v-model="modpackMetadata.emitModrinthStrict"
      :label="t('modpack.emitModrinthStrict')"
      class="z-10"
      hide-details
      prepend-icon="$vuetify.icons.modrinth"
    >
      <template #append>
        <v-tooltip
          top
        >
          <template #activator="{ on }">
            <!-- <v-btn
                  text
                  icon
                > -->
            <a
              class="rounded border border-dashed border-green-300 pb-[2px]"
              target="browser"
              href="https://docs.modrinth.com/docs/modpacks/format_definition/#downloads"
              v-on="on"
            >
              <v-icon
                color="primary"
                class="cursor-pointer"
                small
              >
                question_mark
              </v-icon>
            </a>
            <!-- </v-btn> -->
          </template>
          {{ t('modpack.emitModrinthStrictDescription') }}
          <ul class="list-disc">
            <li> cdn.modrinth.com </li>
            <li>github.com</li>
            <li>raw.githubusercontent.com</li>
            <li>gitlab.com</li>
          </ul>
        </v-tooltip>
      </template>
    </v-checkbox>
    <v-checkbox
      v-model="modpackMetadata.emitOffline"
      :label="t('modpack.includeAssets')"
      class="z-10"
      prepend-icon="texture"
      hide-details
    />
  </v-list>
</template>

<script lang="ts" setup>
import { injection } from '@/util/inject'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { kUserContext } from '../composables/user'
import { useInstanceModpackMetadata } from '@/composables/instanceModpackMetadata'
import SettingItem from '@/components/SettingItem.vue'
import { inc } from 'semver'

const { data } = injection(InstanceEditInjectionKey)
const { gameProfile } = injection(kUserContext)
const { t } = useI18n()

const { modpackMetadata } = inject('modpackMetadata', useInstanceModpackMetadata())

const onIncr = (minor: boolean = false) => {
  modpackMetadata.modpackVersion = inc(modpackMetadata.modpackVersion, minor ? 'minor' : 'patch') || modpackMetadata.modpackVersion
}

</script>

<style scoped="true">
.flex {
  padding: 6px 8px !important
}

.v-btn {
  margin: 0
}
</style>

<style>
.base-settings .v-input--checkbox {
  padding-bottom: 1rem !important;
}
</style>
