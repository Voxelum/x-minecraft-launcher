<template>
  <v-dialog
    v-model="isShown"
    width="640"
    :persistent="busy"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <!-- 固定高度三栏结构：标题栏 / 可滚动内容 / 固定操作栏，避免内容过多时把按钮裁掉 -->
    <div class="flex w-full max-h-[85vh] flex-col overflow-hidden">
      <!-- 标题栏：翻译中禁用关闭 -->
      <div class="flex shrink-0 items-center gap-3 px-6 pt-5 pb-3">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style="background-color: rgba(var(--v-theme-primary), 0.12)"
        >
          <v-icon size="22" color="primary">translate</v-icon>
        </div>
        <div class="flex-grow text-base font-bold tracking-tight" style="color: rgba(var(--v-theme-on-surface), 0.9);">
          {{ t('shaderPack.aiTranslateTitle') }}
        </div>
        <v-btn
          icon="close"
          variant="text"
          size="small"
          :disabled="busy"
          @click="close"
        />
      </div>

      <!-- 内容区：只有这一块滚动，子项都不参与压缩 -->
      <div class="flex-1 min-h-0 overflow-y-auto invisible-scroll px-6 pb-2 flex flex-col gap-3">
        <div v-if="context" class="surface-panel shrink-0 p-3 flex items-center gap-3 min-w-0">
          <v-icon size="18" color="primary" class="flex-none">folder_zip</v-icon>
          <div class="flex min-w-0 flex-col">
            <span class="text-sm font-semibold truncate">{{ context.packName }}</span>
            <span class="text-[11px] opacity-60 truncate font-mono">{{ context.fileName }}</span>
          </div>
        </div>

        <div v-if="loading" class="flex shrink-0 justify-center py-8">
          <v-progress-circular indeterminate color="primary" size="32" />
        </div>

        <template v-else>
          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            density="compact"
            rounded="lg"
            class="shrink-0"
          >
            {{ error }}
          </v-alert>
          <v-alert
            v-if="success"
            type="success"
            variant="tonal"
            density="compact"
            rounded="lg"
            class="shrink-0"
          >
            {{ t('shaderPack.aiTranslateSuccess', { path: writtenPath }) }}
          </v-alert>

          <!-- AI 未配置提示 -->
          <v-alert
            v-if="!aiReady"
            type="warning"
            variant="tonal"
            density="compact"
            rounded="lg"
            class="shrink-0"
          >
            <div class="flex items-center justify-between gap-3">
              <span>{{ t('shaderPack.aiNotConfigured') }}</span>
              <v-btn variant="text" size="small" color="warning" @click="openAiSettings">
                {{ t('shaderPack.openAiSettings') }}
              </v-btn>
            </div>
          </v-alert>

          <div v-if="languages.length === 0" class="flex shrink-0 flex-col items-center gap-2 py-8 opacity-70">
            <v-icon size="32">description</v-icon>
            <span class="text-sm">{{ t('shaderPack.noLangFiles') }}</span>
          </div>

          <template v-else>
            <!-- 源语言文件列表 -->
            <div class="flex shrink-0 flex-col gap-1.5">
              <div class="flex items-center gap-1.5 leading-none">
                <v-icon size="14" class="flex-none opacity-70">translate</v-icon>
                <span class="text-[11px] font-semibold opacity-70">{{ t('shaderPack.sourceLanguage') }}</span>
              </div>
              <!-- 语言较多时列表内部滚动，并始终显示滚动条 -->
              <div
                class="shader-lang-list flex max-h-[220px] flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1"
                style="scrollbar-gutter: stable"
                role="radiogroup"
                :aria-label="t('shaderPack.sourceLanguage')"
              >
                <button
                  v-for="item of languages"
                  :key="item.path"
                  type="button"
                  role="radio"
                  :aria-checked="selectedPath === item.path"
                  class="surface-panel flex w-full min-w-0 shrink-0 items-center gap-2.5 px-2.5 py-2 text-left transition-colors"
                  :class="selectedPath === item.path ? 'ring-1 ring-[rgba(var(--v-theme-primary),0.6)]' : 'hover:bg-[rgba(var(--v-theme-on-surface),0.06)]'"
                  :disabled="busy"
                  @click="selectedPath = item.path"
                >
                  <v-icon size="16" color="primary" class="flex-none">description</v-icon>
                  <span class="flex min-w-0 flex-grow flex-col gap-0.5 leading-tight">
                    <span class="text-[13px] font-semibold">{{ item.locale }}</span>
                    <span class="text-[11px] opacity-60 truncate font-mono">{{ item.path }}</span>
                  </span>
                  <v-chip size="x-small" variant="tonal" color="primary" class="flex-none">
                    {{ t('shaderPack.langEntries', { count: item.entries }) }}
                  </v-chip>
                  <v-icon v-if="selectedPath === item.path" size="16" color="primary" class="flex-none">
                    check_circle
                  </v-icon>
                </button>
              </div>
            </div>

            <!-- 目标语言：候选来自启动器支持的语言列表，默认当前启动器语言 -->
            <div class="flex shrink-0 flex-col gap-1.5">
              <div class="flex items-center gap-1.5 leading-none">
                <v-icon size="14" class="flex-none opacity-70">flag</v-icon>
                <span class="text-[11px] font-semibold opacity-70">{{ t('shaderPack.targetLanguage') }}</span>
              </div>
              <!-- 语言较多，菜单固定最大高度并在内部滚动 -->
              <v-menu location="bottom" :close-on-content-click="true">
                <template #activator="{ props: menuProps }">
                  <v-text-field
                    v-bind="menuProps"
                    :model-value="targetOptionText"
                    density="compact"
                    variant="outlined"
                    hide-details
                    readonly
                    :disabled="busy"
                    append-inner-icon="arrow_drop_down"
                  />
                </template>
                <v-list
                  class="shader-lang-target-menu"
                  density="compact"
                  style="max-height: 320px; overflow-y: auto"
                >
                  <v-list-item
                    v-for="item of targetLanguageOptions"
                    :key="item.value"
                    :title="item.text"
                    :active="item.value === targetMcLang"
                    color="primary"
                    @click="targetMcLang = item.value"
                  />
                </v-list>
              </v-menu>
              <div class="flex flex-wrap items-center gap-2 min-w-0">
                <code v-if="targetPath" class="text-[11px] opacity-60 truncate font-mono">{{ targetPath }}</code>
                <span class="text-[11px] opacity-50">{{ t('shaderPack.targetLanguageHint') }}</span>
              </div>
            </div>

            <!-- 翻译方式：仅保留并行分批翻译 -->
            <div class="flex shrink-0 flex-col gap-1.5">
              <div class="flex items-center gap-1.5 leading-none">
                <v-icon size="14" class="flex-none opacity-70">auto_awesome</v-icon>
                <span class="text-[11px] font-semibold opacity-70">{{ t('shaderPack.translationConfig') }}</span>
              </div>
              <span class="text-[11px] opacity-60 leading-snug">{{ t('shaderPack.parallelHint') }}</span>
              <div class="surface-panel flex shrink-0 flex-wrap items-center gap-3 p-2.5">
                <label class="flex items-center gap-2 text-[11px] opacity-80">
                  <span class="whitespace-nowrap">{{ t('shaderPack.parallelCount') }}</span>
                  <v-text-field
                    v-model.number="parallelismModel"
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    density="compact"
                    variant="outlined"
                    hide-details
                    style="width: 80px"
                    :disabled="busy"
                  />
                </label>
                <label class="flex items-center gap-2 text-[11px] opacity-80">
                  <span class="whitespace-nowrap">{{ t('shaderPack.batchSize') }}</span>
                  <v-text-field
                    v-model.number="batchSizeModel"
                    type="number"
                    min="10"
                    max="200"
                    step="10"
                    density="compact"
                    variant="outlined"
                    hide-details
                    style="width: 88px"
                    :disabled="busy"
                  />
                </label>
                <span class="text-[11px] opacity-60 w-full leading-snug">
                  {{ t('shaderPack.batchSizeHint') }}
                </span>
              </div>
            </div>

            <!-- 覆盖 / 无需翻译 / 大文件提示 -->
            <v-alert
              v-if="targetExists && !isSameLanguage"
              type="warning"
              variant="tonal"
              density="compact"
              rounded="lg"
              class="shrink-0"
            >
              {{ t('shaderPack.overwriteLang', { path: targetPath }) }}
            </v-alert>
            <v-alert
              v-if="isSameLanguage"
              type="info"
              variant="tonal"
              density="compact"
              rounded="lg"
              class="shrink-0"
            >
              {{ t('shaderPack.sameLanguageHint', { language: targetLabel }) }}
            </v-alert>
          </template>
        </template>
      </div>

      <!-- 进度条固定在操作栏上方，翻译时始终可见 -->
      <div v-if="busy" class="shrink-0 px-6 pb-2">
        <div class="surface-panel flex flex-col gap-2 p-3">
          <div class="flex justify-between gap-3 text-[11px] opacity-60">
            <span>{{ progressLabel }}</span>
            <span>{{ progressPercent }}%</span>
          </div>
          <v-progress-linear :model-value="progressPercent" color="primary" height="6" rounded />
        </div>
      </div>

      <!-- 固定操作栏 -->
      <div class="flex shrink-0 items-center gap-2 px-6 py-4">
        <!-- 写回阶段已无法取消，禁用取消按钮避免误导 -->
        <v-btn v-if="busy" variant="text" color="error" :disabled="writingBack" @click="cancelTranslation">
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn v-else variant="text" @click="close">
          {{ t('shared.close') }}
        </v-btn>
        <div class="flex-grow" />
        <v-btn
          v-if="!success"
          color="primary"
          variant="flat"
          prepend-icon="translate"
          :loading="busy"
          :disabled="!canTranslate"
          @click="startTranslation"
        >
          {{ t('shaderPack.startTranslate') }}
        </v-btn>
        <v-btn v-else color="primary" variant="flat" @click="close">
          {{ t('shaderPack.finish') }}
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { shaderPackTargetPath, toShaderPackMcLang, InstanceShaderPacksServiceKey, type ShaderPackLangFileInfo } from '@xmcl/runtime-api'
import { useShaderLangTranslateAgent } from '@/composables/agent/shaderLangTranslateAgent'
import { useAgentSettings } from '@/composables/agent/settings'
import { useDialog } from '@/composables/dialog'
import { useService } from '@/composables/service'
import { useSettings } from '@/composables/setting'
import {
  findShaderPackTargetLanguage,
  getShaderPackTargetLanguages,
  isTranslatableShaderValue,
} from '@/util/shaderPackLangClient'

interface ShaderPackLangTranslateContext {
  /** 实例根目录 */
  instancePath: string
  /** shaderpacks/ 下的 zip 文件名（纯文件名） */
  fileName: string
  /** 界面展示用的光影包名称 */
  packName: string
}

const { t, locale } = useI18n()
const router = useRouter()
const { isShown, parameter, hide } = useDialog<ShaderPackLangTranslateContext>('shaderpack-lang-translate')
const context = computed(() => parameter.value)
const { listLangFiles, readLangFile, writeTranslatedLangFile } = useService(InstanceShaderPacksServiceKey)
const { locales: supportedLocales } = useSettings()
const settings = useAgentSettings()
const translator = useShaderLangTranslateAgent()

const loading = ref(false)
const busy = ref(false)
/** 是否处于「翻译完成后写回 zip」阶段，用于展示阶段提示 */
const writingBack = ref(false)
const languages = ref<ShaderPackLangFileInfo[]>([])
const selectedPath = ref('')
const error = ref('')
const success = ref('')
const writtenPath = ref('')
const progressDone = ref(0)
const progressTotal = ref(0)
const progressAll = ref(0)
const progressSkipped = ref(0)
const abortController = ref<AbortController>()

// 设置持久化：目标语言、并行数与每批条数
const targetMcLang = useLocalStorage('shaderLangTargetLocale', '')
const parallelism = useLocalStorage('shaderLangParallelism', 3)
const batchSize = useLocalStorage('shaderLangBatchSize', 60)

/** 可选目标语言：来自启动器支持的语言列表（assets/locales.json） */
const targetLanguages = computed(() => getShaderPackTargetLanguages(supportedLocales.value))
const targetLanguageOptions = computed(() => targetLanguages.value.map(item => ({
  text: `${item.label} (${item.mcLang})`,
  value: item.mcLang,
})))
const targetInfo = computed(() => findShaderPackTargetLanguage(targetLanguages.value, targetMcLang.value))
const targetLabel = computed(() => targetInfo.value?.label ?? targetMcLang.value)
/** 当前目标语言在下拉框里的展示文本，如 `简体中文 (zh_cn)` */
const targetOptionText = computed(() => targetLanguageOptions.value
  .find(item => item.value === targetMcLang.value)?.text ?? targetMcLang.value)

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const num = Math.floor(Number(value))
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, num))
}

const parallelismModel = computed({
  get: () => parallelism.value,
  set: (value) => { parallelism.value = clamp(value, 1, 5, 3) },
})
const batchSizeModel = computed({
  get: () => batchSize.value,
  set: (value) => { batchSize.value = clamp(value, 10, 200, 60) },
})

const aiReady = computed(() => settings.configured.value)
const selectedInfo = computed(() => languages.value.find(item => item.path === selectedPath.value))
/** 目标文件路径：由共享工具按目标语言实时计算，切换目标语言无需重新请求服务 */
const targetPath = computed(() => selectedInfo.value
  ? shaderPackTargetPath(selectedInfo.value.path, targetMcLang.value, languages.value.map(item => item.path))
  : '')
const targetExists = computed(() => !!targetPath.value
  && languages.value.some(item => item.path.toLowerCase() === targetPath.value.toLowerCase()))
/** 源语言与目标语言相同则无需翻译 */
const isSameLanguage = computed(() => !!selectedInfo.value
  && selectedInfo.value.locale.toLowerCase() === targetMcLang.value.toLowerCase())
const canTranslate = computed(() => !!selectedInfo.value && !!targetMcLang.value && !isSameLanguage.value && aiReady.value && !busy.value)
const progressPercent = computed(() => progressTotal.value > 0
  ? Math.round((progressDone.value / progressTotal.value) * 100)
  : 0)
const progressLabel = computed(() => {
  // 翻译完成后还有一个写回阶段，单独提示，避免停留在 100% 让人以为卡住
  if (writingBack.value) return t('shaderPack.writingBack')
  if (!progressTotal.value) return t('shaderPack.preparing')
  if (progressSkipped.value > 0) {
    return t('shaderPack.translatingProgressWithSkipped', {
      done: progressDone.value,
      total: progressTotal.value,
      all: progressAll.value,
      skipped: progressSkipped.value,
    })
  }
  return t('shaderPack.translatingProgress', { done: progressDone.value, total: progressTotal.value })
})

/**
 * 选定默认目标语言：优先本地记忆，其次当前启动器语言，最后兜底第一个可用语言。
 */
function resolveDefaultTarget() {
  const candidates = [targetMcLang.value, toShaderPackMcLang(locale.value)]
  for (const candidate of candidates) {
    const found = findShaderPackTargetLanguage(targetLanguages.value, candidate)
    if (found) return found.mcLang
  }
  return targetLanguages.value[0]?.mcLang ?? ''
}

function resetState() {
  languages.value = []
  selectedPath.value = ''
  error.value = ''
  success.value = ''
  writtenPath.value = ''
  progressDone.value = 0
  progressTotal.value = 0
  progressAll.value = 0
  progressSkipped.value = 0
  loading.value = false
  busy.value = false
  writingBack.value = false
}

/**
 * 打开弹窗时列出 zip 内的语言文件，并给出默认选择与默认翻译方式。
 */
async function loadLanguages() {
  const current = context.value
  if (!current) return
  abortController.value?.abort()
  resetState()
  loading.value = true
  try {
    await settings.ready
    targetMcLang.value = resolveDefaultTarget()
    languages.value = await listLangFiles(current.instancePath, current.fileName, targetMcLang.value)
    // 优先选中第一个与目标语言不同的文件，否则退回第一个
    const first = languages.value.find(item => item.locale.toLowerCase() !== targetMcLang.value.toLowerCase())
      ?? languages.value[0]
    selectedPath.value = first?.path ?? ''
    if (languages.value.length === 0) error.value = t('shaderPack.noLangFiles')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

watch(isShown, (shown) => {
  if (shown) void loadLanguages()
  else {
    abortController.value?.abort()
    abortController.value = undefined
  }
}, { immediate: true })

/**
 * 切换目标语言后，若当前源文件正好是目标语言，则自动换一个可翻译的源文件。
 */
watch(targetMcLang, (value) => {
  if (!value || busy.value) return
  if (selectedInfo.value && selectedInfo.value.locale.toLowerCase() === value.toLowerCase()) {
    const next = languages.value.find(item => item.locale.toLowerCase() !== value.toLowerCase())
    if (next) selectedPath.value = next.path
  }
})

/**
 * 执行一次完整翻译：读取源文件 -> AI 翻译 -> 合并写回 zip。
 */
async function startTranslation() {
  const current = context.value
  const info = selectedInfo.value
  if (!current || !info || !canTranslate.value) return
  error.value = ''
  success.value = ''
  writtenPath.value = ''
  busy.value = true
  progressDone.value = 0
  progressTotal.value = info.entries
  const controller = new AbortController()
  abortController.value = controller
  const target = targetMcLang.value

  try {
    const doc = await readLangFile(current.instancePath, current.fileName, info.path, target)
    // 进度只统计需要翻译的条目，跳过的条目单独展示
    progressAll.value = doc.entries.length
    progressTotal.value = doc.entries.filter(entry => isTranslatableShaderValue(entry.value)).length
    progressSkipped.value = doc.entries.length - progressTotal.value
    const result = await translator.translate({
      sourceLocale: doc.locale,
      targetLocale: target,
      // 目标语言的英文名用于自动生成提示词
      targetLanguageName: targetInfo.value?.promptName,
      entries: doc.entries,
      parallelism: parallelism.value,
      batchSize: batchSize.value,
      signal: controller.signal,
      onProgress: (done, total) => {
        progressDone.value = done
        progressTotal.value = total
      },
    })
    const translations = Object.fromEntries(result.entries.map(entry => [entry.key, entry.value]))
    // 进入写回阶段：进度文字切换为「正在写回光影包…」
    writingBack.value = true
    writtenPath.value = await writeTranslatedLangFile(
      current.instancePath,
      current.fileName,
      doc.path,
      target,
      translations,
    )
    success.value = t('shaderPack.aiTranslateSuccess', { path: writtenPath.value })
    progressDone.value = progressTotal.value
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
    writingBack.value = false
    abortController.value = undefined
  }
}

/**
 * 取消只中止 AI 请求，不写回任何内容。
 */
function cancelTranslation() {
  abortController.value?.abort()
  busy.value = false
}

function close() {
  if (busy.value) return
  hide()
}

function openAiSettings() {
  hide()
  router.push({ path: '/setting', query: { target: 'agent' } })
}
</script>

<style scoped>
/*
 * 源语言列表需要始终可见的滚动条。
 * 外层内容容器使用了 .invisible-scroll，它的后代选择器会把内部滚动条也隐藏，
 * 这里用更高优先级的选择器把列表的滚动条恢复回来。
 */
.shader-lang-list.shader-lang-list::-webkit-scrollbar {
  display: block;
  width: 8px;
}

.shader-lang-list.shader-lang-list::-webkit-scrollbar-track {
  background: transparent;
}

.shader-lang-list.shader-lang-list::-webkit-scrollbar-thumb {
  border-radius: 2px;
  background: rgba(155, 155, 155, 0.5);
}

.shader-lang-list.shader-lang-list::-webkit-scrollbar-thumb:hover {
  background: rgba(155, 155, 155, 0.8);
}

/* 目标语言下拉菜单同样保持滚动条可见 */
.shader-lang-target-menu.shader-lang-target-menu::-webkit-scrollbar {
  display: block;
  width: 8px;
}

.shader-lang-target-menu.shader-lang-target-menu::-webkit-scrollbar-track {
  background: transparent;
}

.shader-lang-target-menu.shader-lang-target-menu::-webkit-scrollbar-thumb {
  border-radius: 2px;
  background: rgba(155, 155, 155, 0.5);
}

.shader-lang-target-menu.shader-lang-target-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(155, 155, 155, 0.8);
}
</style>
