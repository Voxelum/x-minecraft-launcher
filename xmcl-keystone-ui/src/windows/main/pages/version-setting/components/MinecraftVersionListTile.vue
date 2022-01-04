<template>
  <v-list-tile
    :key="source.id"
    :class="{
      grey: isSelected,
      'darken-1': isSelected,
      'elevation-2': isSelected,
    }"
    ripple
    @click="select(source)"
  >
    <v-list-tile-avatar>
      <v-chip
        :color="source.type === 'release' ? 'primary' : ''"
        label
        dark
      >
        {{ type }}
      </v-chip>
    </v-list-tile-avatar>

    <v-list-tile-title class="flex gap-2 pl-3">
      {{ source.id }}
    </v-list-tile-title>
    <v-list-tile-sub-title v-if="showTime">
      {{
        new Date(source.releaseTime).toLocaleString()
      }}
    </v-list-tile-sub-title>
    <v-list-tile-action class="flex justify-end">
      <v-btn
        icon
        :loading="installing"
        @click.stop="onClick(source)"
      >
        <v-icon>{{ statuses[source.id] === "remote" ? "file_download" : "folder" }}</v-icon>
      </v-btn>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { MinecraftVersion } from '@xmcl/installer'
import { useBusy, useI18n } from '/@/hooks'
import { required, withDefault } from '/@/util/props'
import { Status } from '@xmcl/runtime-api'
import { versionLockOf, write } from '@xmcl/runtime-api/utils'

export default defineComponent({
  components: {},
  props: {
    showTime: withDefault(Boolean, () => true),
    source: required<MinecraftVersion>(Object),
    selected: required(String),
    select: required<(version: MinecraftVersion) => void>(Function),
    install: required<(version: MinecraftVersion) => void>(Function),
    statuses: required<Record<string, Status>>(Object),
  },
  setup(props) {
    const key = write(versionLockOf(props.source.id))
    const installing = useBusy(key)
    const isSelected = computed(() => props.source.id === props.selected)
    const { $t } = useI18n()
    const type = computed(() => props.source.type === 'snapshot' ? $t('minecraft.versions.snapshot') : props.source.type === 'release' ? $t('minecraft.versions.release') : '')
    const onClick = (version: MinecraftVersion) => {
      if (props.statuses[props.source.id] === 'remote') {
        props.install(version)
      }
    }
    return { installing, isSelected, onClick, type }
  },
})
</script>

<style>
</style>
