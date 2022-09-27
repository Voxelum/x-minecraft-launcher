<template>
  <v-card>
    <v-card-title>
      <v-icon left>
        {{ icon }}
      </v-icon>
      Curseforge Modpack
    </v-card-title>
    <v-card-text>
      This instance is created from {{ }} ({})
    </v-card-text>
    <v-card-actions>
      <v-btn
        color="teal accent-4"
        text
        @click="onClick"
      />
    </v-card-actions>
  </v-card>
</template>
<script lang="ts" setup>
import { CurseForgeServiceKey, InstanceData, InstanceModsServiceKey, ModrinthServiceKey } from '@xmcl/runtime-api'
import { useI18n, useRouter, useSemaphore, useService } from '/@/composables'

const props = defineProps<{
  upstream: InstanceData['upstream']
}>()
const { t } = useI18n()
const icon = computed(() => props.upstream?.type === 'modrinth-modpack'
  ? '$vuetify.icons.modrinth'
  : props.upstream?.type === 'curseforge-modpack'
    ? '$vuetify.icons.curseforge'
    : props.upstream?.type === 'ftb-modpack' ? '$vuetify.icons.ftb' : '')

const id = computed(() => props.upstream?.type === 'curseforge-modpack' ? props.upstream.modId : '')

function onClick() {

}
</script>
