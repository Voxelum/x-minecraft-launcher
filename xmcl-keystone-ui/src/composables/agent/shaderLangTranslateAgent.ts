import { ShaderPackLangEntry } from '@xmcl/runtime-api'
import {
  SHADER_LANG_MAX_PARALLELISM,
  SHADER_LANG_SUBMIT_TOOL,
  ShaderLangBatch,
  applyShaderLangTranslations,
  buildShaderLangPrompt,
  createShaderLangBatches,
  prepareShaderLangEntries,
  readShaderLangTranslations,
} from '@/util/shaderPackLangClient'
import { ref } from 'vue'
import { useLocalAgent } from './local'
import { createAgentTools } from './toolSupport'

export interface ShaderLangTranslateOptions {
  /** 用于隔离会话历史的稳定键，通常是光影包路径 */
  scopeKey: string
  entries: ShaderPackLangEntry[]
  sourceLocale: string
  targetLocale: string
  /** 并行 worker 数，1–5 */
  parallelism: number
  /** 每批条数上限，实际还会受字符量上限约束 */
  batchSize: number
  onProgress?: (done: number, total: number) => void
}

export interface ShaderLangTranslateResult {
  /** 与输入顺序、键完全一致的条目 */
  entries: ShaderPackLangEntry[]
  /** 实际送去翻译的条目数 */
  translated: number
  /** 无需翻译而原样保留的条目数 */
  skipped: number
}

interface ShaderLangWorker {
  local: ReturnType<typeof useLocalAgent>
  /** 工具调用闭包捕获的结果 */
  slot: { captured?: ShaderPackLangEntry[] }
  /** 已加载的会话 scope，避免每批重复 load */
  loadedScope: string
}

function createCancelledError() {
  const error = new Error('Translation cancelled')
  error.name = 'ShaderLangTranslationCancelled'
  return error
}

/**
 * 光影语言文件 AI 翻译会话池。
 *
 * 固定创建 5 个独立会话（每个会话有自己的 scope 与工具结果），
 * 每次任务只启用其中 `min(并行数, 批次数, 5)` 个 worker。
 * 结果只通过 `submit_translated_lang` 工具获取，不解析自由文本。
 */
export function useShaderLangTranslateAgent() {
  // 所有 worker 共享同一个包级 scope 前缀，worker 之间用 `#index` 区分
  const scopeValue = ref('')
  let active: AbortController | undefined

  const workers: ShaderLangWorker[] = Array.from({ length: SHADER_LANG_MAX_PARALLELISM }, (_, index) => {
    const slot: { captured?: ShaderPackLangEntry[] } = {}
    const local = useLocalAgent({
      agentId: 'shader-lang',
      getScope: () => `${scopeValue.value}#${index}`,
      // 模型侧统一用英文指令，避免提示词随界面语言漂移
      getLocale: () => 'en',
      createTools: async () => createAgentTools([
        {
          name: SHADER_LANG_SUBMIT_TOOL,
          label: 'Submit translated lang entries',
          description: 'Submit the translated entries of this batch. Call this exactly once, as the last step.',
          parameters: {
            type: 'object',
            properties: {
              entries: {
                type: 'array',
                description: 'Every input entry of this batch, translated, with the key unchanged.',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string', description: 'The original key, unchanged.' },
                    value: { type: 'string', description: 'The translated value. Keep ⟦XMCLn⟧ tokens untouched.' },
                  },
                  required: ['key', 'value'],
                },
              },
            },
            required: ['entries'],
          },
          execute: (args: { entries?: { key?: unknown; value?: unknown }[] }) => {
            // 只记录原始数据，校验交给 readShaderLangTranslations
            slot.captured = Array.isArray(args?.entries)
              ? args.entries.map(entry => ({ key: String(entry?.key ?? ''), value: String(entry?.value ?? '') }))
              : undefined
            return 'Translations recorded.'
          },
        },
      ]),
      getSessionContext: () => ({
        shaderLangContext: [
          `Shader pack: ${scopeValue.value}`,
          `Parallel worker: ${index + 1}/${SHADER_LANG_MAX_PARALLELISM}`,
          'You translate Minecraft shader pack .lang values. Only the provided tool result is used by the launcher.',
        ].join('\n'),
      }),
    })
    return { local, slot, loadedScope: '' }
  })

  /**
   * 翻译单批；失败时重试一次，两次都失败则抛出最后一次错误。
   */
  async function translateBatch(
    workerIndex: number,
    worker: ShaderLangWorker,
    options: ShaderLangTranslateOptions,
    batch: ShaderLangBatch,
    signal: AbortSignal,
  ): Promise<ShaderPackLangEntry[]> {
    const scope = `${options.scopeKey}#${workerIndex}`
    if (worker.loadedScope !== scope) {
      scopeValue.value = options.scopeKey
      await worker.local.load(scope)
      worker.loadedScope = scope
    }

    const prompt = buildShaderLangPrompt({
      sourceLocale: options.sourceLocale,
      targetLocale: options.targetLocale,
      batch,
    })

    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted) throw createCancelledError()
      // 每批重置上下文，避免上一批的术语影响到这一批
      await worker.local.reset()
      if (signal.aborted) throw createCancelledError()
      worker.slot.captured = undefined
      await worker.local.send(prompt, signal)
      if (signal.aborted) throw createCancelledError()
      if (worker.local.runError.value) {
        lastError = new Error(worker.local.runError.value)
        continue
      }
      if (!worker.slot.captured) {
        lastError = new Error('The AI did not submit any translation')
        continue
      }
      try {
        return readShaderLangTranslations(worker.slot.captured, batch.entries)
      } catch (e) {
        lastError = e
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Translation batch failed')
  }

  /**
   * 并行翻译全部条目。
   */
  async function translateAll(options: ShaderLangTranslateOptions): Promise<ShaderLangTranslateResult> {
    if (active) throw new Error('A shader translation is still running')
    const controller = new AbortController()
    active = controller
    try {
      return await runTranslation(options, controller.signal)
    } finally {
      active = undefined
    }
  }

  async function runTranslation(options: ShaderLangTranslateOptions, signal: AbortSignal): Promise<ShaderLangTranslateResult> {
    const prepared = prepareShaderLangEntries(options.entries)
    if (prepared.items.length === 0) {
      return { entries: options.entries, translated: 0, skipped: prepared.skipped }
    }

    const batches = createShaderLangBatches(prepared.items, options.batchSize)
    const workerCount = Math.max(1, Math.min(options.parallelism, batches.length, SHADER_LANG_MAX_PARALLELISM))
    const total = prepared.items.length
    const translations = new Map<string, string>()
    let done = 0
    let nextBatch = 0
    let failure: unknown

    // JS 单线程保证 `nextBatch++` 不会重复分配同一批
    const runWorker = async (workerIndex: number) => {
      const worker = workers[workerIndex]
      while (!signal.aborted && !failure) {
        const cursor = nextBatch++
        if (cursor >= batches.length) return
        const batch = batches[cursor]
        try {
          const result = await translateBatch(workerIndex, worker, options, batch, signal)
          if (signal.aborted) return
          for (const entry of result) translations.set(entry.key, entry.value)
          done += batch.entries.length
          options.onProgress?.(done, total)
        } catch (e) {
          failure = e
          return
        }
      }
    }

    await Promise.all(Array.from({ length: workerCount }, (_, index) => runWorker(index)))
    if (signal.aborted) throw createCancelledError()
    if (failure) throw failure
    if (translations.size !== prepared.items.length) {
      throw new Error('The AI returned an incomplete translation')
    }

    return {
      entries: applyShaderLangTranslations(options.entries, translations),
      translated: prepared.items.length,
      skipped: prepared.skipped,
    }
  }

  /** 取消所有 worker 的请求；不写回任何内容 */
  function abort() {
    active?.abort()
    for (const worker of workers) worker.local.abort()
  }

  return {
    available: workers[0].local.available,
    translateAll,
    abort,
  }
}
