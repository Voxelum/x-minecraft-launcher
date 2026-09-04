import { computed } from 'vue'
import { ContextMenuItem } from '@/composables/contextMenu'
import { kInstance } from '@/composables/instance'
import { kInstanceSave } from '@/composables/instanceSave'
import { kInstanceServerInfo } from '@/composables/instanceServerInfo'
import { injection } from '@/util/inject'
import { createSharedComposable, useLocalStorage } from '@vueuse/core'
import { formatServerAddress, parseServerAddress } from '@xmcl/runtime-api'

export enum CardType {
  Mod,
  ResourcePack,
  ShaderPack,
  Save,
  Screenshots,
  Server,
  World,
  Blueprint,
}

export const cardIcon: Record<number, string> = {
  [CardType.Mod]: 'extension',
  [CardType.ResourcePack]: 'palette',
  [CardType.ShaderPack]: 'gradient',
  [CardType.Save]: 'map',
  [CardType.Screenshots]: 'image',
  [CardType.Server]: 'dns',
  [CardType.World]: 'public',
  [CardType.Blueprint]: 'view_in_ar',
}

const LABEL_KEYS: Record<number, string> = {
  [CardType.Mod]: 'mod.name',
  [CardType.ResourcePack]: 'resourcepack.name',
  [CardType.ShaderPack]: 'shaderPack.name',
  [CardType.Save]: 'save.name',
  [CardType.Screenshots]: 'screenshots.gallery',
  [CardType.Server]: 'server.serversListTitle',
  [CardType.World]: 'save.world',
  [CardType.Blueprint]: 'blueprint.name',
}

export function getCardLabel(t: (key: string, ...args: any[]) => string, type: CardType): string {
  return type === CardType.World ? t('save.world', 2) : t(LABEL_KEYS[type] ?? '')
}

export function isType(id: string, type: CardType) {
  const [typeString] = id.split('@')
  return Number(typeString) === type
}

/** Extract the per-instance discriminator from a card id (`type@param`). */
export function getParam(id: string): string | undefined {
  const idx = id.indexOf('@')
  return idx >= 0 ? id.slice(idx + 1) : undefined
}

export interface CardDescriptor {
  id: string
  type: CardType
  label: string
}

export const SINGLETON_TYPES = [
  CardType.Mod,
  CardType.ResourcePack,
  CardType.ShaderPack,
  CardType.Save,
  CardType.Screenshots,
  CardType.Blueprint,
]

export function useAllCards() {
  const { t } = useI18n()
  const { instance } = injection(kInstance)
  const { servers: datServers } = injection(kInstanceServerInfo)
  const { saves } = injection(kInstanceSave)

  const serverCards = computed<CardDescriptor[]>(() => {
    const list: CardDescriptor[] = []
    const seen = new Set<string>()
    const add = (host: string, port: number | undefined, name?: string) => {
      const key = formatServerAddress({ host, port })
      if (!seen.has(key)) {
        seen.add(key)
        list.push({ id: `${CardType.Server}@${key}`, type: CardType.Server, label: name || host })
      }
    }
    if (instance.value?.server?.host) {
      add(instance.value.server.host, instance.value.server.port, instance.value.server.name)
    }
    for (const s of datServers.value) {
      const p = parseServerAddress(s.ip)
      if (p) add(p.host, p.port, s.name)
    }
    return list
  })

  const worldCards = computed<CardDescriptor[]>(() =>
    saves.value.map((s) => ({
      id: `${CardType.World}@${s.name}`,
      type: CardType.World,
      label: s.levelName || s.name,
    })),
  )

  const allCards = computed<CardDescriptor[]>(() => {
    const result: CardDescriptor[] = SINGLETON_TYPES.map((type) => ({
      id: String(type),
      type,
      label: getCardLabel(t, type),
    }))
    result.push(...worldCards.value, ...serverCards.value)
    return result
  })

  return { serverCards, worldCards, allCards }
}

/**
 * Builds compact context menu restore items with hover submenus for Worlds and Servers.
 */
export function buildRestoreMenuItems(
  t: (key: string, ...args: any[]) => string,
  hiddenCards: CardDescriptor[],
  restoreCard: (id: string) => void,
): ContextMenuItem[] {
  const groups: Record<number, CardDescriptor[]> = {}
  const items: ContextMenuItem[] = []

  for (const c of hiddenCards) {
    if (c.type === CardType.World || c.type === CardType.Server) {
      (groups[c.type] ??= []).push(c)
    } else {
      items.push({
        text: c.label,
        icon: cardIcon[c.type] ?? 'visibility',
        section: 'restore',
        onClick: () => restoreCard(c.id),
      })
    }
  }

  for (const type of [CardType.World, CardType.Server] as const) {
    const list = groups[type]
    if (list?.length) {
      items.push({
        text: getCardLabel(t, type),
        icon: cardIcon[type],
        section: 'restore',
        onClick: () => {},
        children: list.map((c) => ({
          text: c.label,
          icon: cardIcon[type],
          onClick: () => restoreCard(c.id),
        })),
      })
    }
  }

  return items
}

export interface FocusCardMeta {
  hidden?: boolean
}

export const useHomeFocusCards = createSharedComposable(() => {
  const { t } = useI18n()
  const { allCards, serverCards, worldCards } = useAllCards()

  const STORE_KEY = 'homeFocusCardsState'
  const ORDER_KEY = 'homeFocusCardsOrder'
  const cardState = useLocalStorage<Record<string, FocusCardMeta>>(STORE_KEY, {}, { deep: false, writeDefaults: false })
  const cardOrder = useLocalStorage<string[]>(ORDER_KEY, [], { deep: false, writeDefaults: false })

  function saveCardState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(cardState.value))
  }

  const DEFAULT_HIDDEN_TYPES = new Set<CardType>([CardType.World, CardType.Server])

  function isHidden(card: CardDescriptor | string | CardType): boolean {
    const id = typeof card === 'object' ? card.id : String(card)
    const type = typeof card === 'object' ? card.type : Number(id.split('@')[0])
    const meta = cardState.value[id]
    return DEFAULT_HIDDEN_TYPES.has(type) ? meta?.hidden !== false : !!meta?.hidden
  }

  function setHidden(id: string, hidden: boolean) {
    cardState.value = { ...cardState.value, [id]: { ...cardState.value[id], hidden } }
    saveCardState()
  }

  function reorderCards(fromId: string, toId: string, currentIds: string[]) {
    if (fromId === toId) return
    const ids = [...currentIds]
    const fromIdx = ids.indexOf(fromId)
    const toIdx = ids.indexOf(toId)
    if (fromIdx === -1 || toIdx === -1) return
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, fromId)
    cardOrder.value = ids
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids))
  }

  function moveToTop(id: string, currentIds: string[]) {
    const ids = currentIds.filter((x) => x !== id)
    ids.unshift(id)
    cardOrder.value = ids
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids))
  }

  const hiddenCards = computed(() => allCards.value.filter((c) => isHidden(c)))
  const getRestoreMenuItems = () => buildRestoreMenuItems(t, hiddenCards.value, (id) => setHidden(id, false))

  function getCardMenu(id?: string, currentIds?: string[]): ContextMenuItem[] {
    if (!id) return getRestoreMenuItems()
    const items: ContextMenuItem[] = [
      { text: t('instance.hideCard'), icon: 'visibility_off', section: 'card', onClick: () => setHidden(id, true) },
    ]
    if (currentIds && currentIds[0] !== id) {
      items.unshift({
        text: t('instance.moveToTop'),
        icon: 'vertical_align_top',
        section: 'card',
        onClick: () => moveToTop(id, currentIds),
      })
    }
    items.push(...getRestoreMenuItems())
    return items
  }

  return {
    allCards,
    serverCards,
    worldCards,
    cardOrder,
    reorderCards,
    moveToTop,
    isHidden,
    hideCard: (id: string) => setHidden(id, true),
    restoreCard: (id: string) => setHidden(id, false),
    hiddenCards,
    getRestoreMenuItems,
    getCardMenu,
    getBackgroundMenu: getRestoreMenuItems,
  }
})
