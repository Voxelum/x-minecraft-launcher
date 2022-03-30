<template>
  <div class="template-content w-full">
    <v-list
      style="background: transparent"
      class="p-0"
      two-line
    >
      <v-list-item class="mb-2">
        <div class="flex gap-3 w-full">
          <v-select
            v-model="selectedVersionFilterOption"
            class="max-w-40"
            hide-details
            label="Minecraft"
            :items="versionFilterOptions"
            clearable
          />
          <v-spacer />
          <v-text-field
            ref="searchTextRef"
            v-model="filterText"
            hide-details
            filled
            append-icon="filter_list"
            :label="$t('filter')"
          />
        </div>
      </v-list-item>
      <v-divider />
      <v-list-item
        v-for="p in templates"
        :key="p.path"
        ripple
        @click="onUse(p)"
      >
        <v-list-item-action>
          <v-checkbox
            :value="value === p"
            readonly
          />
        </v-list-item-action>
        <v-list-item-content>
          <v-list-item-title>{{ p.title }}</v-list-item-title>
          <v-list-item-subtitle>{{ p.subTitle }}</v-list-item-subtitle>
        </v-list-item-content>

        <v-list-item-action>
          <v-list-item-action-text>{{ p.action }}</v-list-item-action-text>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </div>
</template>

<script lang=ts>
import { Ref } from '@vue/composition-api'
import { useI18n } from '/@/composables'
import { optional, required } from '/@/util/props'
import { InstanceSchema, CurseforgeModpackResource, isCurseforgeModpackResource, ModpackResource, ResourceType, McbbsModpackResource } from '@xmcl/runtime-api'
import { useInstanceTemplates } from '../composables/instance'
import { CreateOptionKey } from '../composables/instanceCreation'
import { injection } from '/@/util/inject'
import { useSearchToggles } from '../composables/useSearch'

type ModpackDomainResource = CurseforgeModpackResource | ModpackResource | McbbsModpackResource

export interface InstanceTemplate {
  type: 'instance'
  title: string
  subTitle: string
  path: string
  action: string
  source: InstanceSchema
  minecraft: string
}

export interface ModpackTemplate {
  type: 'modpack'
  title: string
  subTitle: string
  path: string
  action: string
  source: ModpackDomainResource
  minecraft: string
}

export default defineComponent({
  props: {
    value: optional<InstanceTemplate | ModpackTemplate>(Object),
    onActivated: required<(cb: () => void) => void>(Function),
    onDeactivated: required<(cb: () => void) => void>(Function),
    preset: optional(String),
  },
  emits: ['select'],
  setup(props, context) {
    const { $t, $tc } = useI18n()
    const { modpacks, instances } = useInstanceTemplates()

    const filterText = ref('')
    const versionFilterOptions = computed(() => allTemplates.value.map(v => v.minecraft).filter((v): v is string => !!v))
    const selectedVersionFilterOption = ref('')
    const { toggles } = useSearchToggles()
    // useSearchToggle(toggles.value[toggles.value.length - 1]!)
    const getModpackVersion = (resource: ModpackDomainResource) => {
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

      if (resource.type === 'mcbbs-modpack') {
        const modpack = resource.metadata
        let version = `Minecraft: ${modpack.addons.find(a => a.id === 'game')?.version}`
        const forge = modpack.addons.find(a => a.id === 'forge')
        if (forge) {
          version += ` Forge ${forge.version}`
        }
        const fabric = modpack.addons.find(a => a.id === 'fabric')
        if (fabric) {
          version += ` Fabric ${fabric.version}`
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
        version += `, Forge: ${inst.runtime.forge}`
      }
      if (inst.runtime.fabricLoader) {
        version += `, Fabric: ${inst.runtime.fabricLoader}`
      }
      return version
    }
    const data = injection(CreateOptionKey)
    const allTemplates = computed(() => {
      const all = [] as Array<InstanceTemplate | ModpackTemplate>
      all.push(...instances.value.map((instance) => ({
        type: 'instance',
        title: instance.name || `Minecraft ${instance.runtime.minecraft}`,
        subTitle: getInstanceVersion(instance),
        path: instance.path,
        source: instance,
        action: $t(`profile.templateSetting.${instance.server ? 'server' : 'profile'}`),
        minecraft: instance.runtime.minecraft,
      }) as InstanceTemplate))
      all.push(...modpacks.value.map((modpack) => ({
        type: 'modpack',
        title: modpack.type === 'curseforge-modpack' ? `${modpack.metadata.name}-${modpack.metadata.version}` : modpack.name,
        subTitle: getModpackVersion(modpack),
        path: modpack.path,
        source: modpack,
        action: $t('profile.templateSetting.modpack'),
        minecraft: isCurseforgeModpackResource(modpack) ? modpack.metadata.minecraft.version : modpack.metadata.runtime?.minecraft,
      }) as ModpackTemplate))
      return all
    })
    const templates = computed(() => allTemplates.value.filter((instance) => {
      if (selectedVersionFilterOption.value) {
        if (instance.minecraft !== selectedVersionFilterOption.value) return false
      }
      const searching = (filterText.value ?? '').toLowerCase()
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
              if (loader.id.startsWith('fabric-')) {
                data.runtime.value.fabricLoader = loader.id.substring('fabric-'.length)
              }
            }
          }
          data.author.value = metadata.author
        } else if (resource.type === ResourceType.McbbsModpack) {
          const metadata = resource.metadata
          data.name.value = `${metadata.name} - ${metadata.version}`
          const mcVersion = metadata.addons.find(a => a.id === 'game')?.version ?? ''
          const forgeVersion = metadata.addons.find(a => a.id === 'forge')?.version ?? ''
          const fabricVersion = metadata.addons.find(a => a.id === 'fabric')?.version ?? ''
          if (mcVersion) {
            data.runtime.value.minecraft = mcVersion
          }
          if (forgeVersion) {
            data.runtime.value.forge = forgeVersion
          }
          if (fabricVersion) {
            data.runtime.value.fabricLoader = fabricVersion
          }
          data.author.value = metadata.author
          if (metadata.launchInfo) {
            if (metadata.launchInfo.javaArgument) {
              data.vmOptions.value = metadata.launchInfo.javaArgument
            }
            if (metadata.launchInfo.launchArgument) {
              data.mcOptions.value = metadata.launchInfo.launchArgument
            }
            if (metadata.launchInfo.minMemory) {
              data.minMemory.value = metadata.launchInfo.minMemory
            }
          }
          data.description.value = metadata.description
          data.version.value = metadata.version
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
    const searchTextRef: Ref<null | HTMLElement> = ref(null)
    if (props.preset) {
      const preset = templates.value.find(t => t.path === props.preset)
      if (preset) {
        onUse(preset)
      }
    }
    watch([computed(() => props.preset), templates], () => {
      if (props.preset) {
        const preset = templates.value.find(t => t.path === props.preset)
        if (preset) {
          onUse(preset)
        }
      }
    })
    props.onActivated(() => {
      if (props.value) {
        onUse(props.value)
      }
      toggles.unshift(() => {
        if (searchTextRef.value) {
          searchTextRef.value.focus()
        }
        return true
      })
    })
    props.onDeactivated(() => {
      toggles.shift()
    })
    onUnmounted(() => {
      filterText.value = ''
    })
    return {
      templates,
      onUse,
      searchTextRef,
      filterText,
      versionFilterOptions,
      selectedVersionFilterOption,
    }
  },
})
</script>

<style >
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

.template-content
  .theme--.v-text-field
  > .v-input__control
  > .v-input__slot:before {
  border: none;
}
</style>
