import { onMounted, onBeforeUnmount } from 'vue'
import { DialogKey, useDialog } from './dialog'
import { getModpackProviderPath, parseModpackUrlInput } from './modpackUrlInput'

export const ImportUrlDialogKey: DialogKey<string | { url?: string }> = 'import-url-dialog'

/**
 * Checks if a string is a recognizable modpack link or file URL
 * (Modrinth, CurseForge, TechnicPack, GitHub, ATLauncher, BBSMC, PlanetMinecraft, direct .mrpack/.zip, etc.)
 */
export function isModpackUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  const input = parseModpackUrlInput(url)
  const trimmed = getModpackProviderPath(url)
  if (input.kind === 'invalid') return false
  if (input.kind === 'protocol') return true

  // Modrinth modpack or project
  if (/^(?:www\.)?modrinth\.com\/(?:modpack|project)\/([a-zA-Z0-9\-_]+)/i.test(trimmed)) return true
  if (/^modrinth:\/\//i.test(trimmed)) return true

  // CurseForge modpack or protocol
  if (/^(?:www\.)?curseforge\.com\/minecraft\/modpacks\/([a-zA-Z0-9\-_]+)/i.test(trimmed)) return true
  if (/^curseforge:\/\//i.test(trimmed)) return true

  // TechnicPack modpack or protocol
  if (/^(?:www\.)?technicpack\.net\/modpack\/([a-zA-Z0-9\-_.]+)/i.test(trimmed)) return true

  // ATLauncher modpack
  if (/^(?:www\.)?atlauncher\.com\/pack\/([a-zA-Z0-9\-_]+)/i.test(trimmed)) return true

  // BBSMC modpack or project
  if (/^(?:www\.)?bbsmc\.net\/(?:modpack|project)\/([a-zA-Z0-9\-_]+)/i.test(trimmed)) return true

  // PlanetMinecraft modpack or project
  if (/^(?:www\.)?planetminecraft\.com\/(?:mod|data-pack|texture-pack|project|mods\/tag\/modpacks)(?:\/|$)/i.test(trimmed)) return true

  // GitHub repository or releases
  if (/^(?:www\.)?github\.com\/([^/\s]+)\/([^/\s?#]+)/i.test(trimmed)) return true

  // Direct .mrpack or .zip file URL
  if (/\.(mrpack|zip)$/i.test(new URL(input.url).pathname)) return true

  return false
}

/**
 * Global paste listener that captures modpack URLs when the user presses Ctrl+V (or pastes)
 * on any page in the launcher (unless typing into an active text field).
 */
export function useModpackUrlPaste() {
  const { show } = useDialog(ImportUrlDialogKey)

  function onPaste(e: ClipboardEvent) {
    const target = e.target as HTMLElement | null
    // If the user is actively focused on an input/textarea/contenteditable, allow normal pasting
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return
    }

    const text = e.clipboardData?.getData('text')?.trim()
    if (text && isModpackUrl(text)) {
      e.preventDefault()
      show({ url: text })
    }
  }

  onMounted(() => {
    window.addEventListener('paste', onPaste)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('paste', onPaste)
  })
}
