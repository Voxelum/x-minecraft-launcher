<template>
  <v-list-item
    :key="source.id"
    :class="{
      grey: isSelected,
      'en-1': isSelected,
      'elevation-2': isSelected,
    }"
    ripple
    @click="select(source)"
  >
    <div class="w-20">
      <v-chip
        :color="source.type === 'release' ? 'primary' : ''"
        label
      >
        {{ type }}
      </v-chip>
    </div>

    <v-list-item-title
      style="flex: 1 1 30%"
      class="!flex-grow-0"
    >
      {{ source.id }}
    </v-list-item-title>
    <v-list-item-subtitle
      v-if="showTime"
      class="flex-grow flex"
    >
      {{
        new Date(source.releaseTime).toLocaleString()
      }}
    </v-list-item-subtitle>
    <v-list-item-action class="flex justify-end">
      <v-btn
        icon
        :loading="installing"
        @click.stop="onClick(source)"
      >
        <v-icon>{{ statuses[source.id] === "remote" ? "file_download" : "folder" }}</v-icon>
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { MinecraftVersion } from '@xmcl/installer'
import { Status, versionLockOf, write } from '@xmcl/runtime-api'
import { useBusy, useI18n } from '/@/composables'
import { required, withDefault } from '/@/util/props'

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
