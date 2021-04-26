<template>
  <v-container
    grid-list
    fill-height
  >
    <v-layout
      row
      wrap
    >
      <v-flex
        d-flex
        xs12
      >
        <v-list
          style="background: transparent"
          two-line
        >
          <v-list-tile
            v-for="p in templates"
            :key="p.path"
            ripple
            @click="onUse(p)"
          >
            <v-list-tile-action>
              <v-checkbox
                :value="value === p"
                readonly
              />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>{{ p.title }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ p.subTitle }},</v-list-tile-sub-title>
            </v-list-tile-content>

            <v-list-tile-action>
              <v-list-tile-action-text>{{ p.action }}</v-list-tile-action-text>
            </v-list-tile-action>
          </v-list-tile>
        </v-list>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { computed, onUnmounted, defineComponent, inject, Data } from '@vue/composition-api'
import { CurseforgeModpackResource, ModpackResource } from '/@shared/entities/resource'
import { InstanceSchema } from '/@shared/entities/instance.schema'
import {
  useI18n,
  useInstanceTemplates,
} from '/@/hooks'
import { useSearch } from '/@/windows/main/hooks'
import { optional, required } from '/@/util/props'
import { ResourceType } from '/@shared/entities/resource.schema'
import { CreateOptionKey } from './creation'

export interface InstanceTemplate {
  type: 'instance'
  title: string
  subTitle: string
  path: string
  action: string
  source: InstanceSchema
}

export interface ModpackTemplate {
  type: 'modpack'
  title: string
  subTitle: string
  path: string
  action: string
  source: CurseforgeModpackResource | ModpackResource
}

export default defineComponent({
  props: {
    value: optional<InstanceTemplate | ModpackTemplate>(Object),
    onActivated: required<(cb: () => void) => void>(Function),
    preset: optional(String),
  },
  emits: ['select'],
  setup(props, context) {
    const { $t } = useI18n()
    const { modpacks, instances } = useInstanceTemplates()
    // TODO: handle this
    // const { toggles } = useSearchToggles()
    // useSearchToggle(toggles.value[toggles.value.length - 1]!)
    const { text } = useSearch()
    const getModpackVersion = (resource: CurseforgeModpackResource | ModpackResource) => {
      if (resource.type === 'curseforge-modpack') {
        const modpack = resource.metadata
        let version = `Minecraft: ${modpack.minecraft.version}`
        if (modpack.minecraft.modLoaders && modpack.minecraft.modLoaders.length > 0) {
          for (const loader of modpack.minecraft.modLoaders) {
            version += ` ${loader.id}`
          }
        }
        return version
      }

      const runtimes = resource.metadata.runtime ?? {}
      let version = `Minecraft: ${runtimes.minecraft}`
      if (runtimes.forge) {
        version += ` Forge ${runtimes.forge}`
      }
      if (runtimes.liteloader) {
        version += ` Liteloader ${runtimes.liteloader}`
      }
      if (runtimes.fabricLoader) {
        version += ` Fabric ${runtimes.fabricLoader}`
      }
      return version
    }
    const getInstanceVersion = (inst: InstanceSchema) => {
      let version = `Minecraft: ${inst.runtime.minecraft}`
      if (inst.runtime.forge) {
        version += ` Forge: ${inst.runtime.forge}`
      }
      if (inst.runtime.fabricLoader) {
        version += ` Fabric: ${inst.runtime.fabricLoader}`
      }
      return version
    }
    const data = inject(CreateOptionKey)
    if (!data) {
      throw new Error('Cannot use without providing CreateOption!')
    }
    const templates = computed(() => [
      ...instances.value.map((instance) => ({
        type: 'instance',
        title: instance.name || `Minecraft ${instance.runtime.minecraft}`,
        subTitle: getInstanceVersion(instance),
        path: instance.path,
        source: instance,
        action: $t(`profile.templateSetting.${instance.server ? 'server' : 'profile'}`),
      }) as InstanceTemplate),
      ...modpacks.value.map((modpack) => ({
        type: 'modpack',
        title: modpack.type === 'curseforge-modpack' ? `${modpack.metadata.name}-${modpack.metadata.version}` : modpack.name,
        subTitle: getModpackVersion(modpack),
        path: modpack.path,
        source: modpack,
        action: $t('profile.templateSetting.modpack'),
      }) as ModpackTemplate),
    ].filter((instance) => {
      const searching = text.value.toLowerCase()
      if (searching.length === 0) {
        return true
      }
      if (instance.title.toLowerCase().indexOf(searching) !== -1) {
        return true
      }
      if (instance.subTitle.toLowerCase().indexOf(searching) !== -1) {
        return true
      }
      return false
    }))
    const onUse = (template: InstanceTemplate | ModpackTemplate) => {
      if (template.type === 'instance') {
        const instance = template.source
        data.name.value = instance.name
        data.runtime.value = { ...instance.runtime }
        data.java.value = instance.java
        data.showLog.value = instance.showLog
        data.hideLauncher.value = instance.hideLauncher
        data.vmOptions.value = [...instance.vmOptions]
        data.mcOptions.value = [...instance.mcOptions]
        data.maxMemory.value = instance.maxMemory
        data.minMemory.value = instance.minMemory
        data.author.value = instance.author
        data.description.value = instance.description
        data.url.value = instance.url
        data.icon.value = instance.icon
        data.server.value = instance.server ? { ...instance.server } : null
      } else {
        const resource = template.source
        if (resource.type === ResourceType.CurseforgeModpack) {
          const metadata = resource.metadata
          data.name.value = `${metadata.name} - ${metadata.version}`
          data.runtime.value.minecraft = metadata.minecraft.version
          if (metadata.minecraft.modLoaders.length > 0) {
            for (const loader of metadata.minecraft.modLoaders) {
              if (loader.id.startsWith('forge-')) {
                data.runtime.value.forge = loader.id.substring('forge-'.length)
              }
            }
          }
          data.author.value = metadata.author
        } else {
          const metadata = resource.metadata
          data.name.value = resource.name
          data.runtime.value.minecraft = metadata.runtime.minecraft
          data.runtime.value.forge = metadata.runtime.forge
          data.runtime.value.fabricLoader = metadata.runtime.fabricLoader
        }
      }
      context.emit('select', template)
    }
    props.onActivated(() => {
      if (props.value) {
        onUse(props.value)
      } else if (props.preset) {
        const preset = templates.value.find(t => t.path === props.preset)
        if (preset) {
          onUse(preset)
        }
      }
    })
    onUnmounted(() => {
      text.value = ''
    })
    return {
      templates,
      onUse,
    }
  },
})
</script>

<style>
.java-select .v-select__selection {
  white-space: nowrap;
  overflow-x: hidden;
  overflow-y: hidden;

  max-width: 240px;
}
.v-stepper__step span {
  margin-right: 12px !important;
}
.v-stepper__step div {
  display: flex !important;
}
</style>
