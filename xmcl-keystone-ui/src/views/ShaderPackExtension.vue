<template>
  <div
    class="flex flex-grow-0 flex-1 mt-4 flex-row items-center justify-center pl-4 pr-6"
    :class="{
      'mb-4': !compact,
      'mb-2': compact,
    }"
  >
    <div
      class="flex flex-row items-center gap-1 flex-grow-0 justify-center"
    >
      <AvatarItem
        responsive
        :avatar="'image://builtin/minecraft'"
        title="Minecraft"
        :text="`${version.minecraft}`"
      />
      <v-divider vertical />
      <AvatarItem
        v-if="version.forge"
        responsive
        :avatar="'image://builtin/forge'"
        title="Forge"
        :text="`${version.forge}`"
      />
      <v-divider
        v-if="version.forge"
        vertical
      />
      <AvatarItem
        v-if="version.fabricLoader"
        responsive
        :avatar="'image://builtin/fabric'"
        title="Fabric"
        :text="`${version.fabricLoader}`"
      />
      <v-divider
        v-if="version.fabricLoader"
        vertical
      />
      <AvatarItem
        v-if="version.quiltLoader"
        responsive
        :avatar="'image://builtin/quilt'"
        title="Quilt"
        :text="`${version.quiltLoader}`"
      />
      <v-divider
        v-if="version.quiltLoader"
        vertical
      />
      <AvatarItem
        v-if="shaderMod"
        responsive
        :avatar="shaderMod.icon"
        :title="shaderMod.name"
        :text="shaderMod.version"
      />
    </div>
    <div class="flex-grow" />
    <div
      class="flex items-center overflow-x-auto invisible-scroll pr-3 h-full max-w-[40%]"
    >
      <FilterCombobox
        :placeholder="t('mod.filter')"
      />
    </div>
  </div>
</template>

<script lang=ts setup>
import AvatarItem from '@/components/AvatarItem.vue'
import FilterCombobox from '@/components/FilterCombobox.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kCompact } from '@/composables/scrollTop'
import { injection } from '@/util/inject'
import { FabricModMetadata } from '@xmcl/mod-parser'

const { runtime: version } = injection(kInstance)
const { mods } = injection(kInstanceModsContext)
const shaderMod = computed(() => {
  if (version.value.optifine) {
    return {
      id: 'optifine',
      name: 'Optifine',
      version: version.value.optifine,
      icon: 'image://builtin/optifine',
    }
  }
  const shader = mods.value.find(m => {
    const forge = m.resource.metadata.forge
    const fabric = m.resource.metadata.fabric
    if (forge) {
      // optifine in forge
      return forge.modid === 'optifine'
    } else if (fabric) {
      if (fabric instanceof Array) {
        // optifine fabric or iris
        if (fabric.some(f => f.id === 'optifabric' || f.id === 'iris')) return true
      } else {
        if (fabric.id === 'optifabric' || fabric.id === 'iris') return true
      }
    }
    return false
  })

  const normalzieFabricResource = (fabric: FabricModMetadata | FabricModMetadata[], icon?: string) => {
    if (fabric instanceof Array) {
      return fabric.map(f => ({
        id: f.id,
        name: f.name,
        version: f.version,
        icon,
      }))[0]
    } else {
      return {
        id: fabric.id,
        name: fabric.name,
        version: fabric.version,
        icon,
      }
    }
  }
  return shader?.resource.metadata.forge
    ? {
      id: shader.resource.metadata.forge.modid,
      name: shader.resource.metadata.forge.name,
      version: shader.resource.metadata.forge.version,
      icon: shader.icon,
    }
    : shader?.resource.metadata.fabric ? normalzieFabricResource(shader.resource.metadata.fabric, shader.icon) : undefined
})
const { t } = useI18n()
const compact = injection(kCompact)
</script>
