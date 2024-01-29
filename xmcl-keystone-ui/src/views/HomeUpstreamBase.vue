<template>
  <div class="mx-2 grid grid-cols-9  gap-6 pb-4">
    <div
      class="col-span-9 lg:col-span-6"
    >
      <v-subheader class="flex">
        {{ t('modrinthCard.currentVersion') }}
        <div class="flex-grow" />
        <v-switch
          v-model="_only"
          dense
          :label="t('upstream.onlyShowCurrentVersion')"
        />
      </v-subheader>
      <HomeUpstreamVersion
        v-if="currentVersion"
        :version="currentVersion"
        outlined
        no-action
        @changelog="$emit('changelog', currentVersion)"
      />
      <div
        v-for="[date, versions] of Object.entries(items)"
        :key="date"
      >
        <v-subheader class="text-md">
          {{ date }}
        </v-subheader>
        <div class="flex flex-col gap-2">
          <HomeUpstreamVersion
            v-for="v of versions"
            :key="v.id"
            :version="v"
            :updating="updating"
            :duplicating="duplicating"
            :no-action="currentVersion?.id === v.id"
            :downgrade="currentVersion ? isDowngrade(currentVersion.datePublished, v.datePublished) : false"
            @changelog="$emit('changelog', v)"
            @update="$emit('update', v)"
            @duplicate="$emit('duplicate', v)"
          />
        </div>
      </div>
    </div>

    <div
      v-if="header"
      class="lg:(col-span-3 row-start-auto) col-span-9 row-start-1"
    >
      <v-subheader class="px-1">
        {{ header?.type === 'modrinth' ? 'Modrinth' : header?.type === 'curseforge' ? 'Curseforge' : 'FTB' }}
      </v-subheader>
      <HomeUpstreamHeader
        :value="header"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useVModel } from '@vueuse/core'
import HomeUpstreamHeader, { UpstreamHeaderProps } from './HomeUpstreamHeader.vue'
import HomeUpstreamVersion, { ProjectVersionProps } from './HomeUpstreamVersion.vue'

const props = defineProps<{
  duplicating?: boolean
  updating?: boolean
  items: Record<string, ProjectVersionProps[]>
  currentVersion?: ProjectVersionProps
  header?: UpstreamHeaderProps
  onlyCurrentVersion?: boolean
}>()

const emit = defineEmits(['update', 'duplicate', 'changelog', 'update:onlyCurrentVersion'])

const { t } = useI18n()
const _only = useVModel(props, 'onlyCurrentVersion', emit)
const isDowngrade = (current: string, target: string) => {
  const da = new Date(current)
  const db = new Date(target)
  return da > db
}

</script>
