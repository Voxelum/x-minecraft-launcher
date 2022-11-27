<template>
  <v-tooltip
    :close-delay="0"
    right
  >
    <template #activator="{ on }">
      <v-speed-dial
        open-on-hover
        direction="top"
        transition="slide-y-reverse-transition"
      >
        <template #activator>
          <v-btn
            text
            icon
            to="/base-setting"

            :loading="refreshing"
            v-on="on"
            @click="emit('show', 'normal')"
          >
            <v-icon>
              more_vert
            </v-icon>
          </v-btn>
        </template>
        <v-btn
          text
          icon
          :loading="refreshing"
          to="/mod-setting"
        >
          <v-tooltip
            :close-delay="0"
            right
          >
            <template #activator="{ on: tooltip }">
              <v-icon
                v-on="tooltip"
              >
                extension
              </v-icon>
            </template>
            {{ t('mod.name', 2) }}
          </v-tooltip>
        </v-btn>

        <v-btn
          text
          icon
          :loading="refreshing"
          to="/resource-pack-setting"
          @click="emit('show', 'resourcepacks')"
        >
          <v-tooltip
            :close-delay="0"
            right
          >
            <template #activator="{ on: tooltip }">
              <v-icon
                v-on="tooltip"
              >
                palette
              </v-icon>
            </template>
            {{ t('resourcepack.name', 2) }}
          </v-tooltip>
        </v-btn>

        <v-btn
          text
          icon

          :loading="refreshing"
          to="/shader-pack-setting"
          @click="emit('show', 'shaderpacks')"
        >
          <v-tooltip
            :close-delay="0"
            right
          >
            <template #activator="{ on: tooltip }">
              <v-icon

                v-on="tooltip"
              >
                gradient
              </v-icon>
            </template>
            {{ t('shaderPack.name', 2) }}
          </v-tooltip>
        </v-btn>

        <v-btn
          text
          icon

          :loading="refreshing"
          to="/save"
          @click="emit('show', 'saves')"
        >
          <v-tooltip
            :close-delay="0"
            right
          >
            <template #activator="{ on: tooltip }">
              <v-icon

                v-on="tooltip"
              >
                map
              </v-icon>
            </template>
            {{ t('save.name', 2) }}
          </v-tooltip>
        </v-btn>
      </v-speed-dial>
    </template>
    {{ t('gameSetting.title') }}
  </v-tooltip>
</template>

<script lang=ts setup>
defineProps({
  refreshing: Boolean,
})
const { t } = useI18n()
const emit = defineEmits(['show'])
</script>
