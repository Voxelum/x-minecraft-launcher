import { isJavaExecutableWithinRuntime } from '@/util/javaState'

const tails = new Map<string, Promise<void>>()
let promptTail = Promise.resolve()
type SharedPrompt = {
  controller: AbortController
  promise: Promise<boolean>
  waiters: number
  settled: boolean
}
type PromptGroup = { participants: number; prompts: Map<string, SharedPrompt> }
const promptGroups = new Map<string, PromptGroup>()
let generation = 0
const replacements = new Map<string, { path: string; generation: number }>()

/** Snapshot the replacement generation when a launch selects its Java. */
export function javaUpdateGeneration() {
  return generation
}

/** Serialize renderer updates and process spawning for the same runtime. */
export function withJavaUpdateLock<T>(runtime: string, operation: () => Promise<T>): Promise<T> {
  const result = (tails.get(runtime) ?? Promise.resolve()).then(operation)
  const tail = result.then(
    () => undefined,
    () => undefined,
  )
  tails.set(runtime, tail)
  void tail.then(() => {
    if (tails.get(runtime) === tail) tails.delete(runtime)
  })
  return result
}

/** Join a runtime's concurrent launches; the returned function releases the membership. */
export function joinJavaPromptGroup(runtime: string) {
  let group = promptGroups.get(runtime)
  if (!group) {
    group = { participants: 0, prompts: new Map() }
    promptGroups.set(runtime, group)
  }
  group.participants++
  return () => {
    if (--group.participants === 0 && promptGroups.get(runtime) === group) {
      promptGroups.delete(runtime)
    }
  }
}

/** Share one update decision while allowing each launch to cancel independently. */
export function withJavaPromptLock(
  runtime: string,
  update: string,
  signal: AbortSignal,
  operation: (signal: AbortSignal) => Promise<boolean>,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false)
  const group = promptGroups.get(runtime)
  if (!group) throw new Error('Java prompt group is not registered')
  let prompt = group.prompts.get(update)
  if (!prompt) {
    const controller = new AbortController()
    const promise = promptTail.then(() => operation(controller.signal))
    promptTail = promise.then(() => undefined, () => undefined)
    prompt = { controller, promise, waiters: 0, settled: false }
    group.prompts.set(update, prompt)
    const entry = prompt
    void promise.then(
      () => { entry.settled = true },
      () => {
        entry.settled = true
        if (group.prompts.get(update) === entry) group.prompts.delete(update)
      },
    )
  }
  const entry = prompt
  entry.waiters++
  return new Promise<boolean>((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener('abort', onAbort)
      entry.waiters--
      // One cancelled launch must not dismiss a prompt still needed by another.
      if (entry.waiters === 0 && !entry.settled) {
        if (group.prompts.get(update) === entry) group.prompts.delete(update)
        entry.controller.abort()
      }
    }
    const onAbort = () => {
      finish()
      resolve(false)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    entry.promise.then(
      value => {
        if (signal.aborted) return
        finish()
        resolve(value)
      },
      error => {
        if (signal.aborted) return
        finish()
        reject(error)
      },
    )
  })
}

/** Record a completed replacement for launches holding an older Java path. */
export function rememberJavaReplacement(runtimePath: string, javaPath: string) {
  replacements.set(runtimePath, { path: javaPath, generation: ++generation })
}

/** Follow replacements published after the supplied generation. */
export function resolveJavaReplacement(javaPath: string, since: number) {
  // Follow successive updates, but stop if a malformed chain loops.
  const seen = new Set<string>()
  while (!seen.has(javaPath)) {
    seen.add(javaPath)
    const replacement = [...replacements]
      .reverse()
      .find(
        ([runtime, replacement]) =>
          replacement.generation > since && isJavaExecutableWithinRuntime(javaPath, runtime),
      )?.[1]
    if (!replacement || replacement.path === javaPath) break
    javaPath = replacement.path
  }
  return javaPath
}
