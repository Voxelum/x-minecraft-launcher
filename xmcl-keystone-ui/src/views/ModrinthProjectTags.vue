<template>
  <div class="">
    <v-subheader>
      {{ t('modrinth.technicalInformation') }}
    </v-subheader>
    <div class="grid grid-cols-2 gap-1 gap-y-3 ">
      <div class="item">
        <v-icon class="material-icons-outlined">
          desktop_windows
        </v-icon>
        <div>
          <span>{{ t('modrinth.clientSide') }}</span>
          {{ getEnv(clientSide) }}
        </div>
      </div>
      <div class="item">
        <v-icon class="material-icons-outlined">
          storage
        </v-icon>
        <div>
          <span>{{ t('modrinth.serverSide') }}</span>
          {{ getEnv(serverSide) }}
        </div>
      </div>
      <div class="item">
        <v-icon class="material-icons-outlined">
          description
        </v-icon>
        <div>
          <span>{{ t('modrinth.license') }}</span>
          <a :href="license.url">
            {{ license.name }}
          </a>
        </div>
      </div>
      <div class="item">
        <v-icon class="material-icons-outlined">
          code
        </v-icon>
        <div>
          <span>{{ t('modrinth.projectId') }}</span>
          {{ projectId }}
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { License } from '@xmcl/modrinth/types'

defineProps<{
  downloads: number
  createAt: string
  updateAt: string
  license: License
  serverSide: string
  clientSide: string
  projectId: string
}>()
const { t } = useI18n()
const getEnv = (v: string) => {
  if (v === 'required') return t('modrinth.environments.required')
  if (v === 'optional') return t('modrinth.environments.optional')
  if (v === 'unsupported') return t('modrinth.environments.unsupported')
  return v
}
</script>

<style scoped>
.item {
  @apply flex items-center gap-2;
}

.item .v-icon {
  @apply rounded-full bg-[rgba(0, 0, 0, 0.2)] p-2;
}

.item div {
  @apply flex flex-col;
}

span {
  @apply dark:text-gray-400 text-gray-600;
}
</style>
