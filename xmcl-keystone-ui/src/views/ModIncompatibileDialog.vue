<script lang="ts" setup>
import { getCompatibleIcon } from '@/composables/compatibleIcon'
import { useDialog } from '@/composables/dialog'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { useModCompatibleTooltip } from '@/composables/modCompatibleTooltip'
import { injection } from '@/util/inject'
import { CompatibleDetail } from '@/util/modCompatible'

const { isShown } = useDialog('mod-incompatible')
const { compatibility } = injection(kInstanceModsContext)
const { getTooltip } = useModCompatibleTooltip()
const items = computed(() => {
  const items = [] as (string | CompatibleDetail)[]

  for (const [modId, mods] of Object.entries(compatibility.value)) {
    items.push(modId)
    let found = false
    for (const m of mods) {
      if (m.compatible !== true) {
        found = true
        items.push(m)
      }
    }
    if (!found) {
      items.pop()
    }
  }

  return items
})

const { t } = useI18n()

</script>

<template>
  <v-dialog
    v-model="isShown"
    width="800"
  >
    <v-card class="overflow-auto max-h-[90vh] visible-scroll flex-col flex">
      <v-card-title>{{ t('mod.incompatibleHint') }}</v-card-title>
      <v-card-text class=" overflow-auto max-h-full">
        <div>
          {{ t('mod.incompatibleHintDescription') }}
        </div>
        <v-list
          dense
          nav
          class="overflow-auto"
        >
          <template v-for="(item, i) of items">
            <v-subheader
              v-if="typeof item === 'string'"
              :key="item + i"
            >
              {{ item }}
            </v-subheader>
            <v-list-item
              v-else
              :key="item.modId + i"
              small
            >
              <v-list-item-avatar>
                <!-- <img :src="modsIconsMap[item.modId]"> -->
                {{ getCompatibleIcon(item) }}
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title class="flex gap-2 items-center">
                  {{ item.modId }}
                  <v-chip
                    v-if="item.optional"
                    small
                    label
                    outlined
                    color="yellow darken-2"
                    class="mb-1"
                  >
                    {{ t('optional') }}
                  </v-chip>
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ getTooltip(item) }}
                </v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </template>
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
