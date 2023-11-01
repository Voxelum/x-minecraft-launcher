<template>
  <v-tabs
    :value="tab"
    class="mt-3"
    centered
    background-color="transparent"
    @change="$emit('update:tab', $event)"
  >
    <v-tab>
      <v-icon left>
        all_inclusive
      </v-icon>
      {{ t('modSearchType.all') }}
      <div
        class="v-badge__badge primary static ml-1 w-[unset]"
      >
        {{ local + modrinth + curseforge }}
      </div>
    </v-tab>
    <v-tab
      v-if="local >= 0"
      :disabled="local === 0"
    >
      <v-icon left>
        storage
      </v-icon>
      {{ t('modSearchType.local') }}
      <div
        class="v-badge__badge primary static ml-1 w-[unset]"
      >
        {{ local }}
      </div>
    </v-tab>
    <v-tab :disabled="curseforge === 0">
      <v-icon
        :size="28"
        left
      >
        $vuetify.icons.curseforge
      </v-icon>
      Curseforge
      <div
        class="v-badge__badge primary static ml-1 w-[unset]"
      >
        {{ curseforge }}
      </div>
    </v-tab>
    <v-tab :disabled="modrinth === 0">
      <v-icon left>
        $vuetify.icons.modrinth
      </v-icon>
      Modrinth
      <div
        class="v-badge__badge primary static ml-1 w-[unset]"
      >
        {{ modrinth }}
      </div>
    </v-tab>
  </v-tabs>
</template>
<script lang="ts" setup>
defineProps<{
  tab: number
  local: number
  modrinth: number
  curseforge: number
}>()
defineEmits<{
  (event: 'update:tab', tab: number): void
}>()
const { t } = useI18n()
</script>
