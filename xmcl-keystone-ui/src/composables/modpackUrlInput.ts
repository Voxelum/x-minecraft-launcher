export function parseModpackUrlInput(value: string | null): {
  url: string
  kind: 'http' | 'protocol' | 'invalid'
} {
  const url = value?.trim() ?? ''
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { url, kind: 'invalid' }
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return { url: parsed.href, kind: 'http' }
  }
  if (['curseforge:', 'modrinth:', 'technic:', 'xmcl:'].includes(parsed.protocol)) {
    return { url: parsed.href, kind: 'protocol' }
  }
  return { url, kind: 'invalid' }
}

/** Match providers against their actual host/path, never a query or fragment. */
export function getModpackProviderPath(value: string): string {
  const input = parseModpackUrlInput(value)
  if (input.kind === 'invalid') return ''
  const url = new URL(input.url)
  return input.kind === 'http' ? `${url.hostname}${url.pathname}` : input.url
}

/** Route inputs left over after provider-specific resolution. */
export async function routeModpackUrlInput(
  input: ReturnType<typeof parseModpackUrlInput>,
  importArchive: (url: string) => Promise<void>,
  handleProtocol: (url: string) => Promise<boolean>,
): Promise<boolean> {
  if (input.kind === 'http') {
    // HTTP handlers fetch arbitrary content, but do not import it. Archive
    // ownership cannot depend on a suffix: download/redirect URLs may lack one.
    await importArchive(input.url)
    return true
  }
  if (input.kind === 'protocol') return handleProtocol(input.url)
  return false
}
