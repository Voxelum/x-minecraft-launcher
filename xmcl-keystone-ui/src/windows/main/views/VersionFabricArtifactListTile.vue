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
    <div class="w-30">
      <v-chip
        v-if="source.stable"
        label
        color="green"
      >
        {{ $t('fabric.version.stable') }}
      </v-chip>
      <v-chip
        v-else
        label
      >
        {{ $t('fabric.version.unstable') }}
      </v-chip>
    </div>

    <v-list-item-title class="pl-3">
      {{ source.version }}
    </v-list-item-title>
    <v-list-item-subtitle>{{ source.maven }}</v-list-item-subtitle>

    <v-list-item-action style="justify-content: flex-end;">
      <v-btn
        :loading="installing"
        icon
        @click="onClick"
      >
        <v-icon>
          {{
            status === "remote" ? "file_download" : "folder"
          }}
        </v-icon>
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { FabricArtifactVersion } from '@xmcl/installer'
import { useBusy } from '/@/composables'
import { required } from '/@/util/props'
import { versionLockOf, write } from '@xmcl/runtime-api'

export default defineComponent({
  props: {
    statuses: required<(version: string) => 'loading' | 'remote'>(Function),
    source: required<FabricArtifactVersion>(Object),
    selected: required<string>(String),
    minecraft: required<string>(String),
    select: required<(version: FabricArtifactVersion) => void>(Function),
    install: required<(version: FabricArtifactVersion) => void>(Function),
  },
  setup(props) {
    const key = write(versionLockOf(`fabric-${props.minecraft}-${props.source.version}`))
    const installing = useBusy(key)
    const isSelected = computed(() => props.selected === props.source.version)
    const status = computed(() => props.statuses(`${props.minecraft}-${props.source.version}`))
    const onClick = () => {
      if (status.value === 'remote') {
        props.install(props.source)
      }
    }
    return {
      status,
      isSelected,
      installing,
      onClick,
    }
  },
})

</script>
