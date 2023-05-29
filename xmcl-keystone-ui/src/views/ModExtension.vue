<template>
  <div
    class="flex flex-grow-0 flex-1 flex-row items-center justify-center mt-4"
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
        v-if="version.optifine"
        responsive
        :avatar="'image://builtin/optifine'"
        title="Optifine"
        :text="`${version.optifine}`"
      />
      <v-divider
        v-if="version.optifine"
        vertical
      />
      <AvatarItem
        responsive
        icon="folder_zip"
        :title="t('mod.name', { count: 2 })"
        :text="t('mod.enabled', { count: modCount })"
      />
      <v-divider
        v-if="noModLoader"
        vertical
      />
      <AvatarItem
        v-if="noModLoader"
        v-ripple
        class="cursor-pointer select-none"
        responsive
        icon="dangerous"
        title="Modloader"
        :text="t('mod.noModLoaderHint')"
        @click="router.push('/base-setting')"
      />
    </div>
    <div class="flex-grow" />
    <div
      class="flex items-center overflow-x-auto invisible-scroll pr-3 h-full "
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

const { enabledModCounts: modCount } = injection(kInstanceModsContext)
const { runtime: version } = injection(kInstance)
const compact = injection(kCompact)
const { t } = useI18n()
const noModLoader = computed(() =>
  !version.value.forge && !version.value.fabricLoader && !version.value.quiltLoader,
)
const router = useRouter()
</script>
