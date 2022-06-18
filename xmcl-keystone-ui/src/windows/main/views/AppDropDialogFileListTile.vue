
<template>
  <v-list-item
    class="universal-drop-tile"
    color="error"
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
    <v-list-item-action class="flex flex-row gap-4 justify-end items-center">
      <v-chip
        v-if="'date' in value"
        label
      >
        {{ t('existed') }} {{ typeName }}
      </v-chip>
      <v-chip
        v-else
        label
        outlined
        color="white"
      >
        {{ typeName }}
      </v-chip>
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
          color="error"
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

<script lang=ts setup>
import { useI18n } from '/@/composables'
import { FilePreview } from '/@/composables/dropService'

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
  'modrinth-modpack': '$vuetify.icons.modrinth',
}

const props = defineProps<{ value: FilePreview }>()
const emit = defineEmits(['enable', 'remove'])

const { tc, t } = useI18n()
const disabled = computed(() => props.value.type === 'unknown' ||
      props.value.status !== 'idle')
const enabled = computed({
  get() { return props.value.enabled },
  set(v) { emit('enable', v) },
})

const icon = computed(() => iconMap[props.value.type] ?? 'device_unknown')
const tryEnable = () => {
  if (!disabled.value) {
    emit('enable')
  }
}
const typeName = computed(() => {
  switch (props.value.type) {
    case 'forge': return 'Forge Mod'
    case 'fabric': return 'Fabric Mod'
    case 'resourcepack': return tc('resourcepack.name', 0)
    case 'mcbbs-modpack':
    case 'modpack': return tc('modpack.name', 0)
    case 'save': return tc('save.name', 0)
    case 'curseforge-modpack': return tc('modpack.name', 0)
    case 'modrinth-modpack': return t('modrinth.projectType.modpack')
    case 'shaderpack': return t('shaderPack.name')
    case 'unknown':
      return t('universalDrop.unknownResource')
    default:
      return props.value.type
  }
})
</script>

<style>
.universal-drop-tile .v-input__slot {
  background: transparent;
  box-shadow: unset;
}
</style>
