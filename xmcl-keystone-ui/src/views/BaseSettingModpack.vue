<template>
  <v-list-subheader>
    {{ t("modpack.name", 1) }}
  </v-list-subheader>
  <v-list-item
    :title="t('modpack.author')"
    :subtitle="t('modpack.authorHint')"
  >
    <template #append>
      <v-text-field
        v-model="data.author"
        class="min-w-40"
        hide-details
        :placeholder="gameProfile.name"
        variant="filled"
        density="compact"
        required
      />
    </template>
  </v-list-item>
  <v-list-item :title="t('modpack.modpackVersion')">
    <template #append>
      <v-text-field
        v-model="data.modpackVersion"
        class="min-w-40"
        hide-details
        variant="filled"
        density="compact"
        required
      />
    </template>
  </v-list-item>
    
  <v-list-item :title="t('modpack.description')">
    <template #subtitle>
      <v-text-field
        v-model="data.description"
        variant="filled"
        density="compact"
        hide-details
        :placeholder="t('modpack.descriptionHint')"
      />
    </template>
  </v-list-item>
  <v-list-item
    :title="t('modpack.url')"
    :subtitle="t('modpack.urlHint')"
  >
    <template #append>
      <v-text-field
        v-model="data.url"
        variant="filled"
        class="w-80"
        density="compact"
        hide-details
        :placeholder="t('modpack.urlHint')"
      />
    </template>
  </v-list-item>
  <!-- <v-list-subheader>
      {{ t("modpack.export") }}
    </v-list-subheader> -->
  <div class="grid grid-cols-2 gap-2">
    <SettingItemCheckbox
      v-model="data.emitCurseforge"
      :title="t('modpack.emitCurseforge')"
      prepend-icon="xmcl:curseforge"
    />
    <SettingItemCheckbox
      v-model="data.emitMcbbs"
      :title="t('modpack.emitMcbbs')"
    />
    <SettingItemCheckbox
      v-model="data.emitModrinth"
      :title="t('modpack.emitModrinth')"
      prepend-icon="xmcl:modrinth"
    />
    <SettingItemCheckbox
      v-if="data.emitModrinth"
      v-model="data.emitModrinthStrict"
      :title="t('modpack.emitModrinthStrict')"
      :description="t('modpack.emitModrinthStrictDescription')"
      prepend-icon="xmcl:modrinth"
    />
  </div>
</template>

<script lang="ts" setup>
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { injection } from '@/util/inject'
import { useI18n } from 'vue-i18n'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { kUserContext } from '../composables/user'

const { data } = injection(InstanceEditInjectionKey)

const { gameProfile } = injection(kUserContext)
const { t } = useI18n()
</script>

<style scoped="true">
.flex {
  padding: 6px 8px !important
}

.v-btn {
  margin: 0
}
</style>
