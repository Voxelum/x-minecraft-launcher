<template>
  <div>
    <div
      class="overflow-hidden break-all"
    >
      {{ t('mod.deletionHint', mods.length) }}
    </div>
    <ol style="margin-top: 5px">
      <li
        v-for="mod in mods"
        :key="mod"
      >
        <span class="overflow-hidden break-all"> {{ mod }} </span>
      </li>
      <li
        v-if="rest > 0"
        class="font-italic overflow-hidden break-all font-bold"
      >
        {{ t('mod.deletionRestHint', { rest }) }}
      </li>
    </ol>
  </div>
</template>

<script lang=ts setup>
import { ModFile } from '@/util/mod'

const props = defineProps<{ items: ModFile[] }>()

const mods = computed(() => props.items.map((i) => `${i.name} v${i.version}`).filter((_, i) => i <= 4))
const rest = computed(() => (props.items.length > 4 ? props.items.length - 4 : 0))
const { t } = useI18n()
</script>
