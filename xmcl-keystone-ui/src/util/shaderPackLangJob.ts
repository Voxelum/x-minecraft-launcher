import type { ShaderPackLangDocument, ShaderPackLangEntry, ShaderPackLangWriteResult } from '@xmcl/runtime-api'

/** Treat the write IPC as the commit point. Invalidated jobs cannot pass it. */
export async function runShaderPackLangJob(options: {
  isCurrent: () => boolean
  read: () => Promise<ShaderPackLangDocument>
  translate: (missing: ShaderPackLangEntry[]) => Promise<ShaderPackLangEntry[]>
  commit: (translations: ShaderPackLangEntry[]) => Promise<ShaderPackLangWriteResult>
}): Promise<ShaderPackLangWriteResult | undefined> {
  const document = await options.read()
  if (!options.isCurrent()) return
  const existing = new Set(document.targetKeys)
  const missing = document.entries.filter(entry => !existing.has(entry.key))
  if (!missing.length) return { path: document.targetPath, written: 0, bytes: 0 }
  const translations = await options.translate(missing)
  if (!options.isCurrent()) return
  return options.commit(translations)
}
