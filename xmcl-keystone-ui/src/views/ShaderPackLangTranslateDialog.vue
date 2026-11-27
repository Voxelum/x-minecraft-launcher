<template>
  <v-dialog
    v-model="isShown"
    :width="720"
    :persistent="busy"
    max-height="82vh"
    scrollable
    @keydown.esc="onEsc"
  >
    <v-card class="rounded-xl overflow-hidden" data-testid="shader-lang-translate-dialog">
      <div class="px-5 py-4 border-b bg-[rgba(var(--v-theme-on-surface),0.04)]">
        <div class="flex items-center gap-3">
          <v-icon size="24" color="primary">translate</v-icon>
          <div class="min-w-0 flex-grow">
            <h3 class="text-lg font-semibold truncate">
              {{ t('shaderPack.translate.title') }}
            </h3>
            <div class="text-xs text-medium-emphasis truncate">
              {{ params?.packName }} · {{ params?.fileName }}
            </div>
          </div>
        </div>
      </div>

      <v-card-text class="px-5 py-4">
        <!-- AI 未配置提示 -->
        <v-alert
          v-if="!agent.available.value"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          <div class="text-sm">{{ t('agent.notConfiguredTitle') }}</div>
          <div class="text-xs opacity-80 mb-2">{{ t('agent.notConfiguredHint') }}</div>
          <v-btn size="small" color="primary" variant="flat" @click="openSettings">
            {{ t('agent.openSettings') }}
          </v-btn>
        </v-alert>

        <v-alert type="info" variant="tonal" density="compact" class="mb-4">
          {{ t('shaderPack.translate.disclosure') }}
        </v-alert>
        <v-alert v-if="sharedFolder" type="warning" variant="tonal" density="compact" class="mb-4">
          {{ t('shaderPack.translate.sharedFolder') }}
        </v-alert>

        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
          {{ error }}
        </v-alert>

        <div v-if="status === 'loading'" class="py-8 text-center text-sm text-medium-emphasis">
          <v-progress-circular indeterminate size="28" class="mb-2" />
          <div>{{ t('shaderPack.translate.loading') }}</div>
        </div>

        <template v-else>
          <!-- 源语言文件 -->
          <div class="text-sm font-medium mb-2">{{ t('shaderPack.translate.sourceTitle') }}</div>
          <div v-if="files.length === 0" class="text-sm text-medium-emphasis mb-4">
            {{ t('shaderPack.translate.noLangFiles') }}
          </div>
          <v-list v-else density="compact" class="rounded-lg mb-4 border" :disabled="busy">
            <v-list-item
              v-for="file in files"
              :key="file.path"
              :active="file.path === sourcePath"
              color="primary"
              @click="sourcePath = file.path"
            >
              <template #prepend>
                <v-icon size="18">{{ file.locale.toLowerCase() === toMcLang(targetLocale) ? 'check_circle' : 'subdirectory_arrow_right' }}</v-icon>
              </template>
              <v-list-item-title class="text-sm">
                {{ file.locale }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-xs">
                {{ file.path }} · {{ t('shaderPack.translate.entriesCount', { count: file.entries }) }}
              </v-list-item-subtitle>
              <template #append>
                <v-icon v-if="file.path === sourcePath" size="18" color="primary">check</v-icon>
              </template>
            </v-list-item>
          </v-list>

          <!-- 目标语言 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <v-select
              v-model="targetLocale"
              :items="targetItems"
              :label="t('shaderPack.translate.targetTitle')"
              :disabled="busy"
              density="compact"
              variant="outlined"
              hide-details
            />
            <v-text-field
              :model-value="targetPath"
              :label="t('shaderPack.translate.targetPath')"
              density="compact"
              variant="outlined"
              readonly
              hide-details
            />
          </div>
          <div v-if="targetExists" class="text-xs text-warning mt-2">
            {{ t('shaderPack.translate.targetExists') }}
          </div>
          <div v-else-if="sameLanguage" class="text-xs text-warning mt-2">
            {{ t('shaderPack.translate.sameLanguage') }}
          </div>

          <!-- 并行参数 -->
          <div class="mt-5">
            <div class="flex items-center justify-between">
              <div class="text-sm font-medium">{{ t('shaderPack.translate.parallelism') }}</div>
              <div class="text-sm text-medium-emphasis">{{ parallelism }}</div>
            </div>
            <v-slider
              v-model="parallelism"
              :min="1"
              :max="5"
              :step="1"
              :disabled="busy"
              density="compact"
              hide-details
            />
            <div class="text-xs text-medium-emphasis">{{ t('shaderPack.translate.parallelismHint') }}</div>

            <v-text-field
              v-model.number="batchSize"
              type="number"
              :min="10"
              :max="200"
              :label="t('shaderPack.translate.batchSize')"
              :hint="t('shaderPack.translate.batchSizeHint')"
              persistent-hint
              density="compact"
              variant="outlined"
              :disabled="busy"
              class="mt-3"
            />
          </div>

          <!-- 进度 -->
          <div v-if="status === 'translating' || status === 'writing' || status === 'done'" class="mt-5">
            <v-progress-linear
              :model-value="Math.round(progress * 100)"
              :indeterminate="status === 'writing'"
              color="primary"
              height="6"
              rounded
            />
            <div class="text-xs text-medium-emphasis mt-2">
              <template v-if="status === 'translating'">
                {{ t('shaderPack.translate.progress', { done: progressDone, total: progressTotal, skipped: skipped }) }}
              </template>
              <template v-else-if="status === 'writing'">
                {{ t('shaderPack.translate.writing') }}
              </template>
              <template v-else>
                {{ writtenPath ? t('shaderPack.translate.success', { path: writtenPath, count: translatedCount }) : t('shaderPack.translate.noMissing') }}
              </template>
            </div>
          </div>
        </template>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-5 py-3">
        <v-btn variant="text" :disabled="busy" @click="hide">
          {{ t('shared.close') }}
        </v-btn>
        <v-spacer />
        <v-btn v-if="status === 'loading' || status === 'translating'" variant="text" color="error" @click="onCancel">
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn
          v-else-if="status === 'done'"
          color="primary"
          variant="flat"
          @click="hide"
        >
          {{ t('shaderPack.translate.done') }}
        </v-btn>
        <v-btn
          v-else
          color="primary"
          variant="flat"
          :disabled="!canStart"
          @click="onStart"
        >
          {{ t('shaderPack.translate.start') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { useShaderLangTranslateAgent } from '@/composables/agent/shaderLangTranslateAgent'
import { SHADER_LANG_BATCH_SIZE_KEY, SHADER_LANG_PARALLELISM_KEY, SHADER_LANG_TARGETS, toMcLang } from '@/util/shaderPackLangClient'
import { runShaderPackLangJob } from '@/util/shaderPackLangJob'
import { InstanceShaderPacksServiceKey, ShaderPackLangFileInfo } from '@xmcl/runtime-api'
import { useLocalStorage } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

interface DialogParams {
  instancePath: string
  /** 光影包 zip 的绝对路径 */
  packPath: string
  fileName: string
  packName: string
}

type Status = 'idle' | 'loading' | 'translating' | 'writing' | 'done'

const { isShown, hide, parameter } = useDialog<DialogParams>('shaderpack-lang-translate')
const params = computed(() => parameter.value)
const service = useService(InstanceShaderPacksServiceKey)
const agent = useShaderLangTranslateAgent()
const { t, locale } = useI18n()
const router = useRouter()

const status = ref<Status>('idle')
const error = ref('')
const files = ref<ShaderPackLangFileInfo[]>([])
const sourcePath = ref('')
const targetLocale = useLocalStorage('shaderLangTargetLocale', toMcLang(locale.value))
const parallelism = useLocalStorage(SHADER_LANG_PARALLELISM_KEY, 3)
const batchSize = useLocalStorage(SHADER_LANG_BATCH_SIZE_KEY, 60)
const progress = ref(0)
const progressDone = ref(0)
const progressTotal = ref(0)
const translatedCount = ref(0)
const skipped = ref(0)
const writtenPath = ref('')
const sharedFolder = ref(false)
const activeTranslation = ref(false)

const busy = computed(() => status.value === 'loading' || status.value === 'translating' || status.value === 'writing')
const sourceFile = computed(() => files.value.find(file => file.path === sourcePath.value))
const targetPath = computed(() => sourceFile.value?.targetPath ?? '')
const targetExists = computed(() => !!sourceFile.value?.targetExists)
const sameLanguage = computed(() => !!sourceFile.value && toMcLang(sourceFile.value.locale) === toMcLang(targetLocale.value))
let translationVersion = 0
const canStart = computed(() => !busy.value && !activeTranslation.value && !sharedFolder.value && !!sourceFile.value && !sameLanguage.value && agent.available.value)

const targetItems = computed(() => {
  const items = SHADER_LANG_TARGETS.map(item => ({ title: item.label, value: item.value }))
  // 界面语言不在内置列表时，追加当前语言，避免默认值没有对应选项
  const current = toMcLang(locale.value)
  if (!items.some(item => item.value === current)) {
    items.unshift({ title: current, value: current })
  }
  return items
})

/**
 * IPC 错误在不同阶段形态不同，统一提取可读文本，避免界面显示 [object Object]。
 */
function extractError(e: unknown): string {
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  const value = e as { message?: unknown; error?: unknown }
  if (typeof value?.message === 'string') return value.message
  if (typeof value?.error === 'string') return value.error
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

/** 扫描 zip 内语言文件；targetLocale 变化时重新计算目标路径 */
let loadVersion = 0
async function loadFiles() {
  const pack = params.value
  if (!pack) return
  files.value = []
  sharedFolder.value = false
  // 版本号用于丢弃过期结果：目标语言快速切换时只保留最后一次请求
  const version = ++loadVersion
  const requestedLocale = targetLocale.value
  status.value = 'loading'
  error.value = ''
  try {
    const shared = await service.isLinked(pack.instancePath)
    if (version !== loadVersion) return
    sharedFolder.value = shared
    if (shared) return
    const info = await service.listShaderPackLangFiles(pack.packPath, requestedLocale)
    if (version !== loadVersion) return
    files.value = info
    // 优先选中第一个非目标语言文件，否则退回第一个
    if (!info.some(file => file.path === sourcePath.value)) {
      const first = info.find(file => toMcLang(file.locale) !== toMcLang(requestedLocale)) ?? info[0]
      sourcePath.value = first?.path ?? ''
    }
  } catch (e) {
    if (version === loadVersion) error.value = extractError(e)
  } finally {
    if (version === loadVersion) status.value = 'idle'
  }
  // 请求期间目标语言又被改过，用最新语言再扫一次，避免目标路径显示成旧值
  if (version === loadVersion && requestedLocale !== targetLocale.value) {
    void loadFiles()
  }
}

// immediate：弹窗组件是懒加载的，首次打开时组件挂载完成时 isShown 已经为 true，
// 普通 watch 不会触发，必须立即执行一次扫描，否则要等用户改目标语言才加载出文件列表。
watch(isShown, (shown) => {
  if (!shown) {
    invalidate()
    return
  }
  status.value = 'idle'
  files.value = []
  sourcePath.value = ''
  progress.value = 0
  progressDone.value = 0
  progressTotal.value = 0
  writtenPath.value = ''
  translatedCount.value = 0
  skipped.value = 0
  targetLocale.value = toMcLang(locale.value)
  void loadFiles()
}, { immediate: true, flush: 'sync' })

// 目标语言变化会改变目标路径与覆盖状态；翻译/写回过程中不允许重扫
watch(targetLocale, () => {
  if (isShown.value && status.value !== 'translating' && status.value !== 'writing') void loadFiles()
})

function openSettings() {
  hide()
  void router.push({ path: '/setting', query: { target: 'agent' } })
}

function onEsc() {
  if (status.value === 'loading' || status.value === 'translating') onCancel()
  else if (!busy.value) hide()
}

function invalidate() {
  ++loadVersion
  ++translationVersion
  if (status.value === 'translating') agent.abort()
}

onBeforeUnmount(invalidate)

function onCancel() {
  invalidate()
  progress.value = 0
  status.value = 'idle'
}

async function onStart() {
  const info = sourceFile.value
  const pack = params.value
  if (!info || !pack || !canStart.value) return
  const version = ++translationVersion
  const target = targetLocale.value
  const current = () => version === translationVersion && isShown.value && params.value === pack
  activeTranslation.value = true
  skipped.value = 0
  error.value = ''
  writtenPath.value = ''
  status.value = 'translating'
  progress.value = 0
  progressDone.value = 0
  progressTotal.value = 0

  try {
    const written = await runShaderPackLangJob({
      isCurrent: current,
      read: () => service.readShaderPackLangFile(pack.packPath, info.path, target),
      translate: async (missing) => {
        const result = await agent.translateAll({
          scopeKey: `${pack.instancePath}::${pack.fileName}`,
          entries: missing,
          sourceLocale: info.locale,
          targetLocale: target,
          parallelism: Number(parallelism.value) || 3,
          batchSize: Number(batchSize.value) || 60,
          onProgress: (done, total) => {
            if (!current()) return
            progressDone.value = done
            progressTotal.value = total
            progress.value = total === 0 ? 0 : Math.min(1, done / total)
          },
        })
        if (current()) skipped.value = result.skipped
        return result.entries
      },
      commit: (translations) => {
        status.value = 'writing'
        progress.value = 1
        return service.writeShaderPackLangFile({
          instancePath: pack.instancePath,
          packPath: pack.packPath,
          sourcePath: info.path,
          targetLocale: target,
          translations,
        })
      },
    })
    if (!written || !current()) return
    writtenPath.value = written.fileName ?? ''
    translatedCount.value = written.written
    status.value = 'done'
  } catch (e) {
    if (!current()) return
    if (e instanceof Error && e.name === 'ShaderLangTranslationCancelled') {
      status.value = 'idle'
      progress.value = 0
      return
    }
    error.value = extractError(e)
    status.value = 'idle'
  } finally {
    activeTranslation.value = false
  }
}
</script>
