<template>
  <v-list-item
    :key="source.version"
    :class="{
      grey: isSelected,
      'en-1': isSelected,
      'elevation-2': isSelected,
    }"
    ripple
    @click="select(source)"
  >
    <div class="v-list__tile__avatar min-w-30">
      <v-chip
        v-if="source.type !== 'common'"
        label
        :color="source.type === 'recommended' ? 'green' : ''"
      >
        {{ type }}
      </v-chip>
    </div>

    <v-list-item-title class="pl-3">
      {{ source.version }}
    </v-list-item-title>
    <v-list-item-subtitle>{{ source.date ? new Date(source.date).toLocaleString() : source.date }}</v-list-item-subtitle>

    <v-list-item-action style="justify-content: flex-end;">
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
    </v-list-item-action>
  </v-list-item>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { ForgeVersion } from '@xmcl/installer'
import { Status, versionLockOf, write } from '@xmcl/runtime-api'
import { useBusy, useI18n } from '/@/composables'
import { required } from '/@/util/props'

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
