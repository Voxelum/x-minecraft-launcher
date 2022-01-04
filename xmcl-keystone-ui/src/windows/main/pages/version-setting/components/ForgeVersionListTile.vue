<template>
  <v-list-tile
    :key="source.version"
    :class="{
      grey: isSelected,
      'darken-1': isSelected,
      'elevation-2': isSelected,
    }"
    ripple
    @click="select(source)"
  >
    <div class="v-list__tile__avatar w-100">
      <v-chip
        v-if="source.type !== 'common'"
        label
        :color="source.type === 'recommended' ? 'green' : ''"
      >
        {{ type }}
      </v-chip>
    </div>

    <v-list-tile-title class="pl-3">
      {{ source.version }}
    </v-list-tile-title>
    <v-list-tile-sub-title>{{ source.date ? new Date(source.date).toLocaleString() : source.date }}</v-list-tile-sub-title>

    <v-list-tile-action style="justify-content: flex-end;">
      <v-btn
        :loading="installing"
        icon
        @click="onClick"
      >
        <v-icon>
          {{
            statuses[source.version] === "remote" ? "file_download" : "folder"
          }}
        </v-icon>
      </v-btn>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { required } from '/@/util/props'
import { Status } from '@xmcl/runtime-api'
import { computed, defineComponent } from '@vue/composition-api'
import { ForgeVersion } from '@xmcl/installer'
import { useBusy, useI18n } from '/@/hooks'
import { versionLockOf, write } from '@xmcl/runtime-api/utils'

export default defineComponent({
  props: {
    source: required<ForgeVersion & { status: Status; date: string }>(Object),
    statuses: required<Record<string, Status>>(Object),
    select: required<(version: { version: string }) => void>(Function),
    install: required<(version: { version: string }) => void>(Function),
    selected: required(String),
  },
  setup(props) {
    const key = write(versionLockOf(`forge-${props.source.mcversion}-${props.source.version}`))
    const installing = useBusy(key)
    const isSelected = computed(() => props.selected === props.source.version)
    const { $t } = useI18n()
    const type = computed(() => props.source.type === 'recommended' ? $t('forge.versions.recommended') : props.source.type === 'latest' ? $t('forge.versions.latest') : '')
    const onClick = () => {
      if (props.statuses[props.source.version] === 'remote') {
        props.install(props.source)
      }
    }
    return {
      type,
      isSelected,
      installing,
      onClick,
    }
  },
})
</script>
