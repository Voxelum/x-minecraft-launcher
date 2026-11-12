<script setup lang="ts">
import { useDialog } from '@/composables/dialog'
import {
  autoGroupConfig,
  AutoGroupStrategy,
  performAutoGroup,
  performUngroupAll,
} from '@/composables/instanceAutoGroup'
import { kInstances } from '@/composables/instances'
import { injection } from '@/util/inject'
import { computed, ref, watch } from 'vue'

const { isShown } = useDialog('auto-group-instances')
const { instances, allInstances, groupsSet } = injection(kInstances)
const { t } = useI18n()

const strategies = computed(() => [
  {
    id: 'modloader' as const,
    title: t('instanceAutoGroup.byModloader'),
    subtitle: t('instanceAutoGroup.byModloaderDescription'),
    icon: 'build',
    examples: ['Forge', 'Fabric', 'NeoForge', 'Quilt', 'Vanilla', 'Bedrock'],
  },
  {
    id: 'version' as const,
    title: t('instanceAutoGroup.byVersion'),
    subtitle: t('instanceAutoGroup.byVersionDescription'),
    icon: 'xmcl:minecraft',
    examples: ['1.21.x', '1.20.x', '1.19.x', '1.18.x', '...'],
  },
  {
    id: 'source' as const,
    title: t('instanceAutoGroup.bySource'),
    subtitle: t('instanceAutoGroup.bySourceDescription'),
    icon: 'category',
    examples: ['Modrinth', 'CurseForge', 'FTB', 'Servers', 'Custom', 'Bedrock'],
  },
])

const selectedStrategy = ref<AutoGroupStrategy>(
  autoGroupConfig.value.strategy === 'version' || autoGroupConfig.value.strategy === 'source'
    ? autoGroupConfig.value.strategy
    : 'modloader'
)

watch(isShown, (shown) => {
  if (shown) {
    if (autoGroupConfig.value.strategy === 'version' || autoGroupConfig.value.strategy === 'source' || autoGroupConfig.value.strategy === 'modloader') {
      selectedStrategy.value = autoGroupConfig.value.strategy
    } else {
      selectedStrategy.value = 'modloader'
      autoGroupConfig.value.strategy = 'modloader'
    }
  }
})
function getTargetList() {
  const all = allInstances.value || []
  if (all.length > 0) return all
  return instances.value || []
}

function onSelectStrategy(stratId: AutoGroupStrategy) {
  selectedStrategy.value = stratId
  autoGroupConfig.value.strategy = stratId
}
// ТИПУ ТУТ ПОМИЛКА...АЛЕ ЇЇ НЕМАЄ ЯКЩО ЩО :3
function onGroupNow(strategy?: AutoGroupStrategy | unknown) {
  const validStrategy: AutoGroupStrategy = (typeof strategy === 'string' && strategies.value.some(s => s.id === strategy))
    ? (strategy as AutoGroupStrategy)
    : selectedStrategy.value
  selectedStrategy.value = validStrategy
  autoGroupConfig.value.strategy = validStrategy

  const list = getTargetList()
  if (list && list.length > 0) {
    performAutoGroup(list, validStrategy, groupsSet)
  }
  isShown.value = false
}

function onUngroupNow() {
  const list = getTargetList()
  if (list && list.length > 0) {
    performUngroupAll(list, groupsSet)
  }
  isShown.value = false
}
</script>

<template>
  <v-dialog
    v-model="isShown"
    width="540"
  >
    <v-card
      theme="dark"
      class="flex flex-col rounded-3xl border border-white/10 bg-[#141416]/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
      elevation="0"
    >
      <div class="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/25 shadow-sm">
            <v-icon size="20" color="primary">sort</v-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-white tracking-wide">
              {{ t('instanceAutoGroup.title') }}
            </h2>
            <p class="text-xs text-white/50 m-0">
              {{ t('instanceAutoGroup.subtitle') }}
            </p>
          </div>
        </div>
        <v-btn
          icon
          size="small"
          variant="text"
          :aria-label="t('shared.close')"
          :title="t('shared.close')"
          class="text-white/50 hover:text-white"
          @click="isShown = false"
        >
          <v-icon size="18">close</v-icon>
        </v-btn>
      </div>

      <v-card-text class="overflow-y-auto max-h-[75vh] px-6 py-5 visible-scroll space-y-5">
        <div
          class="flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer select-none"
          :class="autoGroupConfig.enabled
            ? 'bg-primary/[0.06] border-primary/30 shadow-sm'
            : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'"
          @click="autoGroupConfig.enabled = !autoGroupConfig.enabled"
        >
          <div class="flex items-center gap-3.5 pr-2 min-w-0">
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors"
              :class="autoGroupConfig.enabled ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/5 text-white/60 border-white/10'"
            >
              <v-icon size="22">{{ autoGroupConfig.enabled ? 'check_circle' : 'drive_file_move' }}</v-icon>
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-white">
                {{ t('instanceAutoGroup.autoRouteTitle') }}
              </div>
              <div class="text-xs text-white/50 truncate">
                {{ t('instanceAutoGroup.autoRouteDescription') }}
              </div>
            </div>
          </div>
          <v-switch
            v-model="autoGroupConfig.enabled"
            color="primary"
            density="compact"
            hide-details
            @click.stop
          />
        </div>
        <div>
          <div class="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3 px-1">
            {{ t('instanceAutoGroup.strategySection') }}
          </div>

          <div class="flex flex-col gap-2.5">
            <div
              v-for="strat in strategies"
              :key="strat.id"
              class="p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none"
              :class="selectedStrategy === strat.id
                ? 'bg-primary/[0.12] border-primary ring-2 ring-primary/40 shadow-lg'
                : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20'"
              @click="onSelectStrategy(strat.id)"
            >
              <div class="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all"
                  :class="selectedStrategy === strat.id
                    ? 'bg-primary text-black font-bold border-transparent shadow-md'
                    : 'bg-white/5 text-white/70 border-white/10'"
                >
                  <v-icon size="22">{{ strat.icon }}</v-icon>
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-bold text-white tracking-wide">
                      {{ strat.title }}
                    </span>
                    <span
                      v-if="selectedStrategy === strat.id"
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30"
                    >
                      {{ t('instanceAutoGroup.active') }}
                    </span>
                  </div>

                  <div class="text-xs text-white/60 truncate mt-0.5">
                    {{ strat.subtitle }}
                  </div>

                  <div class="flex flex-wrap gap-1 mt-2">
                    <span
                      v-for="ex in strat.examples"
                      :key="ex"
                      class="px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors"
                      :class="selectedStrategy === strat.id
                        ? 'bg-primary/10 text-white border-primary/25'
                        : 'bg-white/5 text-white/60 border-white/5'"
                    >
                      {{ ex }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="shrink-0 flex items-center gap-2 pl-2">
                <div
                  class="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                  :class="selectedStrategy === strat.id
                    ? 'bg-primary text-black shadow-sm'
                    : 'border-2 border-white/20'"
                >
                  <v-icon v-if="selectedStrategy === strat.id" size="16">check</v-icon>
                </div>
              </div>
            </div>
          </div>
        </div>
      </v-card-text>

      <v-divider class="border-white/5" />
      <div class="flex items-center justify-between px-6 py-4 bg-white/[0.01]">
        <v-btn
          variant="text"
          color="error"
          rounded="xl"
          size="small"
          prepend-icon="layers_clear"
          class="font-medium text-xs"
          @click="onUngroupNow"
        >
          {{ t('instanceAutoGroup.ungroupAll') }}
        </v-btn>

        <div class="flex items-center gap-2.5">
          <v-btn
            variant="text"
            rounded="xl"
            class="text-white/70 hover:text-white"
            @click="isShown = false"
          >
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            rounded="xl"
            prepend-icon="sort"
            class="font-bold px-6 shadow-md"
            @click="() => onGroupNow()"
          >
            {{ t('instanceAutoGroup.sortAllNow') }}
          </v-btn>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>
