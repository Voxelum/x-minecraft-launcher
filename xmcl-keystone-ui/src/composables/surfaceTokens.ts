import { InjectionKey, Ref, ref, watchEffect } from 'vue'

/**
 * Shared design tokens for overlay surfaces (dialogs, menus, popovers).
 *
 * The tokens are reactive. When any value changes, a watcher pushes the
 * matching CSS custom property onto `<html>` so every global rule in
 * `src/assets/common.css` (`--surface-*`) re-renders without a reload.
 *
 * Today the tokens are initialized from the DEFAULT_* constants below.
 * Wiring them up to user-facing settings later means passing initial
 * values into `useSurfaceTokens()` and writing back to the settings
 * store from a watcher.
 */

// ── Defaults ──────────────────────────────────────────────────────────

/** Border radius (px). Matches Vuetify's `rounded="xl"`. */
export const DEFAULT_SURFACE_RADIUS = 16

/** Vuetify `rounded` prop value equivalent to `DEFAULT_SURFACE_RADIUS`. */
export const DEFAULT_SURFACE_RADIUS_PROP = 'xl' as const

export const DEFAULT_SURFACE_BORDER = '1px solid rgba(var(--v-theme-on-surface), 0.10)'
export const DEFAULT_SURFACE_SHADOW = '0 12px 40px -8px rgba(0, 0, 0, 0.35)'

/** Frosted-glass background shared by dialogs, menus and popovers. */
export const DEFAULT_SURFACE_BG = 'rgba(var(--v-theme-surface), 0.82)'
export const DEFAULT_SURFACE_BLUR = 48

/** Menu-only: inner padding and list-item radius. */
export const DEFAULT_SURFACE_MENU_PADDING = 6
export const DEFAULT_SURFACE_MENU_ITEM_RADIUS = 10

// Cards — three intentional tiers. Apply via the `.surface-card`,
// `.surface-card-subsection`, `.surface-card-item` utility classes
// (defined in common.css) so existing components that deliberately
// pick a different radius keep working.
export const DEFAULT_CARD_RADIUS = 16            // tier 1: HomeCard, SettingCard
export const DEFAULT_CARD_SUBSECTION_RADIUS = 12 // tier 2: nested sections
export const DEFAULT_CARD_ITEM_RADIUS = 10       // tier 3: list / compact tiles

/** Vuetify `elevation` prop value for subsection cards (SettingCard etc.). */
export const DEFAULT_CARD_SUBSECTION_ELEVATION = 0

/** Subsection card bg — forced solid surface so it reads identically
 * across Vuetify components and plain divs. */
export const DEFAULT_CARD_SUBSECTION_BG = 'rgb(var(--v-theme-surface))'
/** Subsection card border — matches Vuetify's default `border` prop
 * (FilterCard's reference look). */
export const DEFAULT_CARD_SUBSECTION_BORDER = '1px solid rgba(var(--v-border-color), var(--v-border-opacity))'

// Row card — list rows (Me instance, Friends rows). Same border-swap
// interaction as `.surface-card-clickable` but with the small item
// radius and no lift / shadow (rows pack too tightly for that).
export const DEFAULT_CARD_ROW_BG = 'rgb(var(--v-theme-surface))'
export const DEFAULT_CARD_ROW_BORDER = '1px solid rgba(var(--v-theme-on-surface), 0.08)'
export const DEFAULT_CARD_ROW_BORDER_HOVER = '1px solid rgba(var(--v-theme-primary), 0.45)'
/** Scale applied while the row is being pressed (1 = none). */
export const DEFAULT_CARD_ROW_ACTIVE_SCALE = 0.98
export const DEFAULT_CARD_ROW_TRANSITION = 'border-color 0.2s ease, background-color 0.15s ease, transform 0.1s ease'

/** Default card background — `transparent` lets Vuetify's surface color show through. */
export const DEFAULT_CARD_BG = 'transparent'
/** Default card border — most cards in the codebase have none. */
export const DEFAULT_CARD_BORDER = 'none'

// Info / frosted panels — the recurring "rounded-2xl border border-white/10
// bg-white/5" pattern used inside dialogs (Feedback / Export / Friends).
export const DEFAULT_PANEL_RADIUS = 24
export const DEFAULT_PANEL_BG = 'rgba(var(--v-theme-on-surface), 0.04)'
export const DEFAULT_PANEL_BORDER = '1px solid rgba(var(--v-theme-on-surface), 0.10)'

// Prominent cards — Store detail / market tile / large feature cards.
// Same radius as panels (24px) but no built-in bg/border so the host
// surface (often Vuetify's default) shows through.
export const DEFAULT_CARD_PROMINENT_RADIUS = 24

// Interactive (clickable) card behaviour. The `.surface-card-clickable`
// utility ships shape (radius), surface (solid bg), border and hover
// motion — paired with the StoreExploreCardModern reference (lift +
// shadow + primary-tinted border). Override per-callsite via inner
// UnoCSS atomics if a specific tile needs to deviate.
export const DEFAULT_CARD_CLICKABLE_RADIUS = 24
export const DEFAULT_CARD_CLICKABLE_BG = 'rgb(var(--v-theme-surface))'
export const DEFAULT_CARD_CLICKABLE_BORDER = '1px solid rgba(var(--v-theme-on-surface), 0.06)'
export const DEFAULT_CARD_CLICKABLE_BORDER_HOVER = '1px solid rgba(var(--v-theme-primary), 0.35)'
export const DEFAULT_CARD_CLICKABLE_SHADOW_HOVER = '0 12px 24px -8px rgba(0, 0, 0, 0.25), 0 4px 12px -4px rgba(0, 0, 0, 0.15)'
/** Hover lift in px (negative = upward). */
export const DEFAULT_CARD_CLICKABLE_LIFT = -4
/** Scale applied while the card is being pressed (1 = none). */
export const DEFAULT_CARD_CLICKABLE_ACTIVE_SCALE = 0.98
export const DEFAULT_CARD_CLICKABLE_TRANSITION = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)'


// ── Composable ────────────────────────────────────────────────────────

export interface SurfaceTokensInit {
  radius?: number
  border?: string
  shadow?: string
  bg?: string
  blur?: number
  menuPadding?: number
  menuItemRadius?: number
  cardRadius?: number
  cardSubsectionRadius?: number
  cardItemRadius?: number
  cardSubsectionElevation?: number
  cardSubsectionBg?: string
  cardSubsectionBorder?: string
  cardRowBorder?: string
  cardRowBorderHover?: string
  cardRowBg?: string
  cardRowActiveScale?: number
  cardRowTransition?: string
  cardBg?: string
  cardBorder?: string
  panelRadius?: number
  panelBg?: string
  panelBorder?: string
  cardProminentRadius?: number
  cardClickableRadius?: number
  cardClickableBg?: string
  cardClickableBorder?: string
  cardClickableBorderHover?: string
  cardClickableShadowHover?: string
  cardClickableLift?: number
  cardClickableActiveScale?: number
  cardClickableTransition?: string
}

export interface SurfaceTokens {
  radius: Ref<number>
  border: Ref<string>
  shadow: Ref<string>
  bg: Ref<string>
  blur: Ref<number>
  menuPadding: Ref<number>
  menuItemRadius: Ref<number>
  cardRadius: Ref<number>
  cardSubsectionRadius: Ref<number>
  cardItemRadius: Ref<number>
  cardSubsectionElevation: Ref<number>
  cardSubsectionBg: Ref<string>
  cardSubsectionBorder: Ref<string>
  cardRowBorder: Ref<string>
  cardRowBorderHover: Ref<string>
  cardRowBg: Ref<string>
  cardRowActiveScale: Ref<number>
  cardRowTransition: Ref<string>
  cardBg: Ref<string>
  cardBorder: Ref<string>
  panelRadius: Ref<number>
  panelBg: Ref<string>
  panelBorder: Ref<string>
  cardProminentRadius: Ref<number>
  cardClickableRadius: Ref<number>
  cardClickableBg: Ref<string>
  cardClickableBorder: Ref<string>
  cardClickableBorderHover: Ref<string>
  cardClickableShadowHover: Ref<string>
  cardClickableLift: Ref<number>
  cardClickableActiveScale: Ref<number>
  cardClickableTransition: Ref<string>
  /** Reset every token to its DEFAULT_* value. */
  reset: () => void
}

export const kSurfaceTokens: InjectionKey<SurfaceTokens> = Symbol('SurfaceTokens')

export function useSurfaceTokens(init: SurfaceTokensInit = {}): SurfaceTokens {
  const radius = ref(init.radius ?? DEFAULT_SURFACE_RADIUS)
  const border = ref(init.border ?? DEFAULT_SURFACE_BORDER)
  const shadow = ref(init.shadow ?? DEFAULT_SURFACE_SHADOW)
  const bg = ref(init.bg ?? DEFAULT_SURFACE_BG)
  const blur = ref(init.blur ?? DEFAULT_SURFACE_BLUR)
  const menuPadding = ref(init.menuPadding ?? DEFAULT_SURFACE_MENU_PADDING)
  const menuItemRadius = ref(init.menuItemRadius ?? DEFAULT_SURFACE_MENU_ITEM_RADIUS)

  const cardRadius = ref(init.cardRadius ?? DEFAULT_CARD_RADIUS)
  const cardSubsectionRadius = ref(init.cardSubsectionRadius ?? DEFAULT_CARD_SUBSECTION_RADIUS)
  const cardItemRadius = ref(init.cardItemRadius ?? DEFAULT_CARD_ITEM_RADIUS)
  const cardSubsectionElevation = ref(init.cardSubsectionElevation ?? DEFAULT_CARD_SUBSECTION_ELEVATION)
  const cardSubsectionBg = ref(init.cardSubsectionBg ?? DEFAULT_CARD_SUBSECTION_BG)
  const cardSubsectionBorder = ref(init.cardSubsectionBorder ?? DEFAULT_CARD_SUBSECTION_BORDER)
  const cardRowBorder = ref(init.cardRowBorder ?? DEFAULT_CARD_ROW_BORDER)
  const cardRowBorderHover = ref(init.cardRowBorderHover ?? DEFAULT_CARD_ROW_BORDER_HOVER)
  const cardRowBg = ref(init.cardRowBg ?? DEFAULT_CARD_ROW_BG)
  const cardRowActiveScale = ref(init.cardRowActiveScale ?? DEFAULT_CARD_ROW_ACTIVE_SCALE)
  const cardRowTransition = ref(init.cardRowTransition ?? DEFAULT_CARD_ROW_TRANSITION)
  const cardBg = ref(init.cardBg ?? DEFAULT_CARD_BG)
  const cardBorder = ref(init.cardBorder ?? DEFAULT_CARD_BORDER)

  const panelRadius = ref(init.panelRadius ?? DEFAULT_PANEL_RADIUS)
  const panelBg = ref(init.panelBg ?? DEFAULT_PANEL_BG)
  const panelBorder = ref(init.panelBorder ?? DEFAULT_PANEL_BORDER)

  const cardProminentRadius = ref(init.cardProminentRadius ?? DEFAULT_CARD_PROMINENT_RADIUS)
  const cardClickableRadius = ref(init.cardClickableRadius ?? DEFAULT_CARD_CLICKABLE_RADIUS)
  const cardClickableBg = ref(init.cardClickableBg ?? DEFAULT_CARD_CLICKABLE_BG)
  const cardClickableBorder = ref(init.cardClickableBorder ?? DEFAULT_CARD_CLICKABLE_BORDER)
  const cardClickableBorderHover = ref(init.cardClickableBorderHover ?? DEFAULT_CARD_CLICKABLE_BORDER_HOVER)
  const cardClickableShadowHover = ref(init.cardClickableShadowHover ?? DEFAULT_CARD_CLICKABLE_SHADOW_HOVER)
  const cardClickableLift = ref(init.cardClickableLift ?? DEFAULT_CARD_CLICKABLE_LIFT)
  const cardClickableActiveScale = ref(init.cardClickableActiveScale ?? DEFAULT_CARD_CLICKABLE_ACTIVE_SCALE)
  const cardClickableTransition = ref(init.cardClickableTransition ?? DEFAULT_CARD_CLICKABLE_TRANSITION)

  // Push every change to <html> so global CSS rules pick it up.
  watchEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement.style
    root.setProperty('--surface-radius', `${radius.value}px`)
    root.setProperty('--surface-border', border.value)
    root.setProperty('--surface-shadow', shadow.value)
    root.setProperty('--surface-bg', bg.value)
    root.setProperty('--surface-blur', `${blur.value}px`)
    root.setProperty('--surface-menu-padding', `${menuPadding.value}px`)
    root.setProperty('--surface-menu-item-radius', `${menuItemRadius.value}px`)

    root.setProperty('--card-radius', `${cardRadius.value}px`)
    root.setProperty('--card-subsection-radius', `${cardSubsectionRadius.value}px`)
    root.setProperty('--card-item-radius', `${cardItemRadius.value}px`)
    root.setProperty('--card-subsection-elevation', String(cardSubsectionElevation.value))
    root.setProperty('--card-subsection-bg', cardSubsectionBg.value)
    root.setProperty('--card-subsection-border', cardSubsectionBorder.value)
    root.setProperty('--card-row-border', cardRowBorder.value)
    root.setProperty('--card-row-border-hover', cardRowBorderHover.value)
    root.setProperty('--card-row-bg', cardRowBg.value)
    root.setProperty('--card-row-active-scale', String(cardRowActiveScale.value))
    root.setProperty('--card-row-transition', cardRowTransition.value)
    root.setProperty('--card-bg', cardBg.value)
    root.setProperty('--card-border', cardBorder.value)

    root.setProperty('--panel-radius', `${panelRadius.value}px`)
    root.setProperty('--panel-bg', panelBg.value)
    root.setProperty('--panel-border', panelBorder.value)

    root.setProperty('--card-prominent-radius', `${cardProminentRadius.value}px`)
    root.setProperty('--card-clickable-radius', `${cardClickableRadius.value}px`)
    root.setProperty('--card-clickable-bg', cardClickableBg.value)
    root.setProperty('--card-clickable-border', cardClickableBorder.value)
    root.setProperty('--card-clickable-border-hover', cardClickableBorderHover.value)
    root.setProperty('--card-clickable-shadow-hover', cardClickableShadowHover.value)
    root.setProperty('--card-clickable-lift', `${cardClickableLift.value}px`)
    root.setProperty('--card-clickable-active-scale', String(cardClickableActiveScale.value))
    root.setProperty('--card-clickable-transition', cardClickableTransition.value)
  })

  function reset() {
    radius.value = DEFAULT_SURFACE_RADIUS
    border.value = DEFAULT_SURFACE_BORDER
    shadow.value = DEFAULT_SURFACE_SHADOW
    bg.value = DEFAULT_SURFACE_BG
    blur.value = DEFAULT_SURFACE_BLUR
    menuPadding.value = DEFAULT_SURFACE_MENU_PADDING
    menuItemRadius.value = DEFAULT_SURFACE_MENU_ITEM_RADIUS
    cardRadius.value = DEFAULT_CARD_RADIUS
    cardSubsectionRadius.value = DEFAULT_CARD_SUBSECTION_RADIUS
    cardItemRadius.value = DEFAULT_CARD_ITEM_RADIUS
    cardSubsectionElevation.value = DEFAULT_CARD_SUBSECTION_ELEVATION
    cardSubsectionBg.value = DEFAULT_CARD_SUBSECTION_BG
    cardSubsectionBorder.value = DEFAULT_CARD_SUBSECTION_BORDER
    cardRowBorder.value = DEFAULT_CARD_ROW_BORDER
    cardRowBorderHover.value = DEFAULT_CARD_ROW_BORDER_HOVER
    cardRowBg.value = DEFAULT_CARD_ROW_BG
    cardRowActiveScale.value = DEFAULT_CARD_ROW_ACTIVE_SCALE
    cardRowTransition.value = DEFAULT_CARD_ROW_TRANSITION
    cardBg.value = DEFAULT_CARD_BG
    cardBorder.value = DEFAULT_CARD_BORDER
    panelRadius.value = DEFAULT_PANEL_RADIUS
    panelBg.value = DEFAULT_PANEL_BG
    panelBorder.value = DEFAULT_PANEL_BORDER
    cardProminentRadius.value = DEFAULT_CARD_PROMINENT_RADIUS
    cardClickableRadius.value = DEFAULT_CARD_CLICKABLE_RADIUS
    cardClickableBg.value = DEFAULT_CARD_CLICKABLE_BG
    cardClickableBorder.value = DEFAULT_CARD_CLICKABLE_BORDER
    cardClickableBorderHover.value = DEFAULT_CARD_CLICKABLE_BORDER_HOVER
    cardClickableShadowHover.value = DEFAULT_CARD_CLICKABLE_SHADOW_HOVER
    cardClickableLift.value = DEFAULT_CARD_CLICKABLE_LIFT
    cardClickableActiveScale.value = DEFAULT_CARD_CLICKABLE_ACTIVE_SCALE
    cardClickableTransition.value = DEFAULT_CARD_CLICKABLE_TRANSITION
  }

  return {
    radius,
    border,
    shadow,
    bg,
    blur,
    menuPadding,
    menuItemRadius,
    cardRadius,
    cardSubsectionRadius,
    cardItemRadius,
    cardSubsectionElevation,
    cardSubsectionBg,
    cardSubsectionBorder,
    cardRowBorder,
    cardRowBorderHover,
    cardRowBg,
    cardRowActiveScale,
    cardRowTransition,
    cardBg,
    cardBorder,
    panelRadius,
    panelBg,
    panelBorder,
    cardProminentRadius,
    cardClickableRadius,
    cardClickableBg,
    cardClickableBorder,
    cardClickableBorderHover,
    cardClickableShadowHover,
    cardClickableLift,
    cardClickableActiveScale,
    cardClickableTransition,
    reset,
  }
}
