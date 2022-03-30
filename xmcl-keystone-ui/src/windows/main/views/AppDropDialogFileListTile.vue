
<template>
  <v-list-item
    class="universal-drop-tile"
    color="red"
    @click="tryEnable"
  >
    <v-list-item-avatar>
      <v-icon :size="30">
        {{ icon }}
      </v-icon>
    </v-list-item-avatar>
    <v-list-item-content style="">
      <v-list-item-title :style="{ 'text-decoration': disabled ? 'line-through' : 'none' }">
        {{ value.name }}
      </v-list-item-title>
      <v-list-item-subtitle>
        {{ (value.size / 1024 / 1024).toFixed(2) }} MB
      </v-list-item-subtitle>
    </v-list-item-content>
    <!-- <v-list-item-content style="flex-grow: 1">
      <v-text-field
        v-if="value.type === 'modpack'"
        :label="$t('profile.name')"
        :placeholder="value.name"
        hide-details
        solo
        style="margin-left: 20px; max-width: 100px; background: transparent;"
        @click.stop
      />
    </v-list-item-content> -->
    <v-list-item-action class="flex flex-row gap-4 justify-end items-center">
      <v-chip
        v-if="'date' in value"
        label
      >
        {{ $t('existed') }} {{ typeName }}
      </v-chip>
      <v-chip
        v-else
        label
        outlined
        color="white"
      >
        {{ typeName }}
      </v-chip>
      <!-- </v-list-item-action>

    <v-list-item-action> -->
      <v-checkbox
        v-model="enabled"
        style="justify-content: flex-end"
        :disabled="disabled"
        hide-details
      />

      <v-btn
        v-if="value.status === 'idle'"
        icon
      >
        <v-icon
          color="red"
          @click="$emit('remove')"
        >
          close
        </v-icon>
      </v-btn>
      <v-progress-circular
        v-else-if="value.status === 'loading'"
        indeterminate
      />
      <v-btn
        v-else-if="value.status === 'saved'"
        readonly
        icon
      >
        <v-icon
          color="green"
        >
          check
        </v-icon>
      </v-btn>

      <v-icon v-else>
        error_outline
      </v-icon>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang=ts>
import { required } from '/@/util/props'
import { useI18n } from '/@/composables'
import { FilePreview } from './AppDropDialog.vue'

const iconMap: Record<string, string> = {
  forge: '$vuetify.icons.package',
  fabric: '$vuetify.icons.fabric',
  unknown: 'question_mark',
  resourcepack: '$vuetify.icons.zip',
  shaderpack: '$vuetify.icons.zip',
  'curseforge-modpack': '$vuetify.icons.curseforge',
  modpack: '$vuetify.icons.package',
  'mcbbs-modpack': '$vuetify.icons.package',
  save: '$vuetify.icons.zip',
}

export default defineComponent({
  props: {
    value: required<FilePreview>(Object),
  },
  emits: ['enable', 'remove'],
  setup(props, context) {
    const { $tc, $t } = useI18n()
    const disabled = computed(() => props.value.type === 'unknown' ||
      props.value.status !== 'idle')
    const enabled = computed({
      get() { return props.value.enabled },
      set(v) { context.emit('enable', v) },
    })

    const icon = computed(() => iconMap[props.value.type] ?? 'device_unknown')
    const tryEnable = () => {
      if (!disabled.value) {
        context.emit('enable')
      }
    }
    const typeName = computed(() => {
      switch (props.value.type) {
        case 'forge': return 'Forge Mod'
        case 'fabric': return 'Fabric Mod'
        case 'resourcepack': return $tc('resourcepack.name', 0)
        case 'mcbbs-modpack':
        case 'modpack': return $tc('profile.modpack.name', 0)
        case 'save': return $t('curseforge.worlds.name')
        case 'curseforge-modpack': return $t('curseforge.modpacks.name')
        case 'shaderpack': return $t('shaderpack.name')
        case 'unknown':
        default:
          return $t('unknownResource')
      }
    })
    return { disabled, tryEnable, icon, typeName, enabled }
  },
})
</script>

<style>
.universal-drop-tile .v-input__slot {
  background: transparent;
  box-shadow: unset;
}
</style>
