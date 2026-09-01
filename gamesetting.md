# Gamesetting Module

[![npm version](https://img.shields.io/npm/v/@xmcl/gamesetting.svg)](https://www.npmjs.com/package/@xmcl/gamesetting)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/gamesetting.svg)](https://npmjs.com/@xmcl/gamesetting)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/gamesetting)](https://packagephobia.now.sh/result?p=@xmcl/gamesetting)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Provide function to parse Minecraft game settings

## Usage

### Parse GameSetting (options.txt)

Serialize/Deserialize the minecraft game setting string.

```ts
import { GameSetting } from '@xmcl/gamesetting'
const settingString;
const setting: GameSetting = GameSetting.parse(settingString);
const string: string = GameSetting.stringify(setting);
```

## 🏳️ Enums

<div class="definition-grid enum"><a href="gamesetting/AmbientOcclusion">AmbientOcclusion</a><a href="gamesetting/Difficulty">Difficulty</a><a href="gamesetting/KeyCode">KeyCode</a><a href="gamesetting/Particles">Particles</a></div>

## 🏭 Functions

### decodeUnicodeEscapes

```ts
decodeUnicodeEscapes(s: string): string
```
Decode unicode escape sequences
#### Parameters

- **s**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L469" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:469</a>
</p>


### encodeUnicodeEscapes

```ts
encodeUnicodeEscapes(s: string): string
```
Encode non-ASCII characters to unicode escape sequences
#### Parameters

- **s**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L476" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:476</a>
</p>


### getDefaultFrame

```ts
getDefaultFrame(): { advancedItemTooltips: boolean; anaglyph3d: boolean; ao: AmbientOcclusion; attackIndicator: number; autoJump: boolean; bobView: boolean; chatColors: boolean; chatHeightFocused: number; chatHeightUnfocused: number; chatLinks: boolean; chatLinksPrompt: boolean; chatOpacity: number; chatScale: number; chatVisibility: number; chatWidth: number; difficulty: Difficulty; enableVsync: boolean; enableWeakAttacks: boolean; entityShadows: boolean; fancyGraphics: boolean | undefined; fboEnable: boolean; forceUnicodeFont: boolean; fov: number; fullscreen: boolean; gamma: number; guiScale: number; heldItemTooltips: boolean; hideServerAddress: boolean; incompatibleResourcePacks: string[]; invertYMouse: boolean; key_key.advancements: KeyCode; key_key.attack: KeyCode; key_key.back: KeyCode; key_key.chat: KeyCode; key_key.command: KeyCode; key_key.drop: KeyCode; key_key.forward: KeyCode; key_key.fullscreen: KeyCode; key_key.hotbar.1: KeyCode; key_key.hotbar.2: KeyCode; key_key.hotbar.3: KeyCode; key_key.hotbar.4: KeyCode; key_key.hotbar.5: KeyCode; key_key.hotbar.6: KeyCode; key_key.hotbar.7: KeyCode; key_key.hotbar.8: KeyCode; key_key.hotbar.9: KeyCode; key_key.inventory: KeyCode; key_key.jump: KeyCode; key_key.left: KeyCode; key_key.loadToolbarActivator: KeyCode; key_key.pickItem: KeyCode; key_key.playerlist: KeyCode; key_key.right: KeyCode; key_key.saveToolbarActivator: KeyCode; key_key.screenshot: KeyCode; key_key.smoothCamera: KeyCode; key_key.sneak: KeyCode; key_key.spectatorOutlines: KeyCode; key_key.sprint: KeyCode; key_key.swapHands: KeyCode; key_key.togglePerspective: KeyCode; key_key.use: KeyCode; lang: string; lastServer: string; mainHand: string; maxFps: number; mipmapLevels: MipmapLevel; modelPart_cape: boolean; modelPart_hat: boolean; modelPart_jacket: boolean; modelPart_left_pants_leg: boolean; modelPart_left_sleeve: boolean; modelPart_right_pants_leg: boolean; modelPart_right_sleeve: boolean; mouseSensitivity: number; narrator: number; overrideHeight: number; overrideWidth: number; particles: Particles; pauseOnLostFocus: boolean; realmsNotifications: boolean; reducedDebugInfo: boolean; renderClouds: RenderCloud; renderDistance: RenderDistance; resourcePacks: string[]; saturation: number; showSubtitles: boolean; snooperEnabled: boolean; soundCategory_ambient: KeyCode; soundCategory_block: KeyCode; soundCategory_hostile: KeyCode; soundCategory_master: KeyCode; soundCategory_music: KeyCode; soundCategory_neutral: KeyCode; soundCategory_player: KeyCode; soundCategory_record: KeyCode; soundCategory_voice: KeyCode; soundCategory_weather: KeyCode; touchscreen: boolean; tutorialStep: string; useNativeTransport: boolean; useVbo: boolean; version: number }
```
Get the default values in options.txt.
#### Return Type

- `{ advancedItemTooltips: boolean; anaglyph3d: boolean; ao: AmbientOcclusion; attackIndicator: number; autoJump: boolean; bobView: boolean; chatColors: boolean; chatHeightFocused: number; chatHeightUnfocused: number; chatLinks: boolean; chatLinksPrompt: boolean; chatOpacity: number; chatScale: number; chatVisibility: number; chatWidth: number; difficulty: Difficulty; enableVsync: boolean; enableWeakAttacks: boolean; entityShadows: boolean; fancyGraphics: boolean | undefined; fboEnable: boolean; forceUnicodeFont: boolean; fov: number; fullscreen: boolean; gamma: number; guiScale: number; heldItemTooltips: boolean; hideServerAddress: boolean; incompatibleResourcePacks: string[]; invertYMouse: boolean; key_key.advancements: KeyCode; key_key.attack: KeyCode; key_key.back: KeyCode; key_key.chat: KeyCode; key_key.command: KeyCode; key_key.drop: KeyCode; key_key.forward: KeyCode; key_key.fullscreen: KeyCode; key_key.hotbar.1: KeyCode; key_key.hotbar.2: KeyCode; key_key.hotbar.3: KeyCode; key_key.hotbar.4: KeyCode; key_key.hotbar.5: KeyCode; key_key.hotbar.6: KeyCode; key_key.hotbar.7: KeyCode; key_key.hotbar.8: KeyCode; key_key.hotbar.9: KeyCode; key_key.inventory: KeyCode; key_key.jump: KeyCode; key_key.left: KeyCode; key_key.loadToolbarActivator: KeyCode; key_key.pickItem: KeyCode; key_key.playerlist: KeyCode; key_key.right: KeyCode; key_key.saveToolbarActivator: KeyCode; key_key.screenshot: KeyCode; key_key.smoothCamera: KeyCode; key_key.sneak: KeyCode; key_key.spectatorOutlines: KeyCode; key_key.sprint: KeyCode; key_key.swapHands: KeyCode; key_key.togglePerspective: KeyCode; key_key.use: KeyCode; lang: string; lastServer: string; mainHand: string; maxFps: number; mipmapLevels: MipmapLevel; modelPart_cape: boolean; modelPart_hat: boolean; modelPart_jacket: boolean; modelPart_left_pants_leg: boolean; modelPart_left_sleeve: boolean; modelPart_right_pants_leg: boolean; modelPart_right_sleeve: boolean; mouseSensitivity: number; narrator: number; overrideHeight: number; overrideWidth: number; particles: Particles; pauseOnLostFocus: boolean; realmsNotifications: boolean; reducedDebugInfo: boolean; renderClouds: RenderCloud; renderDistance: RenderDistance; resourcePacks: string[]; saturation: number; showSubtitles: boolean; snooperEnabled: boolean; soundCategory_ambient: KeyCode; soundCategory_block: KeyCode; soundCategory_hostile: KeyCode; soundCategory_master: KeyCode; soundCategory_music: KeyCode; soundCategory_neutral: KeyCode; soundCategory_player: KeyCode; soundCategory_record: KeyCode; soundCategory_voice: KeyCode; soundCategory_weather: KeyCode; touchscreen: boolean; tutorialStep: string; useNativeTransport: boolean; useVbo: boolean; version: number }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L309" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:309</a>
</p>


### parse

```ts
parse(str: string, strict: boolean): { advancedItemTooltips: boolean; anaglyph3d: boolean; ao: AmbientOcclusion; attackIndicator: number; autoJump: boolean; bobView: boolean; chatColors: boolean; chatHeightFocused: number; chatHeightUnfocused: number; chatLinks: boolean; chatLinksPrompt: boolean; chatOpacity: number; chatScale: number; chatVisibility: number; chatWidth: number; difficulty: Difficulty; enableVsync: boolean; enableWeakAttacks: boolean; entityShadows: boolean; fancyGraphics: boolean | undefined; fboEnable: boolean; forceUnicodeFont: boolean; fov: number; fullscreen: boolean; gamma: number; guiScale: number; heldItemTooltips: boolean; hideServerAddress: boolean; incompatibleResourcePacks: string[]; invertYMouse: boolean; key_key.advancements: KeyCode; key_key.attack: KeyCode; key_key.back: KeyCode; key_key.chat: KeyCode; key_key.command: KeyCode; key_key.drop: KeyCode; key_key.forward: KeyCode; key_key.fullscreen: KeyCode; key_key.hotbar.1: KeyCode; key_key.hotbar.2: KeyCode; key_key.hotbar.3: KeyCode; key_key.hotbar.4: KeyCode; key_key.hotbar.5: KeyCode; key_key.hotbar.6: KeyCode; key_key.hotbar.7: KeyCode; key_key.hotbar.8: KeyCode; key_key.hotbar.9: KeyCode; key_key.inventory: KeyCode; key_key.jump: KeyCode; key_key.left: KeyCode; key_key.loadToolbarActivator: KeyCode; key_key.pickItem: KeyCode; key_key.playerlist: KeyCode; key_key.right: KeyCode; key_key.saveToolbarActivator: KeyCode; key_key.screenshot: KeyCode; key_key.smoothCamera: KeyCode; key_key.sneak: KeyCode; key_key.spectatorOutlines: KeyCode; key_key.sprint: KeyCode; key_key.swapHands: KeyCode; key_key.togglePerspective: KeyCode; key_key.use: KeyCode; lang: string; lastServer: string; mainHand: string; maxFps: number; mipmapLevels: MipmapLevel; modelPart_cape: boolean; modelPart_hat: boolean; modelPart_jacket: boolean; modelPart_left_pants_leg: boolean; modelPart_left_sleeve: boolean; modelPart_right_pants_leg: boolean; modelPart_right_sleeve: boolean; mouseSensitivity: number; narrator: number; overrideHeight: number; overrideWidth: number; particles: Particles; pauseOnLostFocus: boolean; realmsNotifications: boolean; reducedDebugInfo: boolean; renderClouds: RenderCloud; renderDistance: RenderDistance; resourcePacks: string[]; saturation: number; showSubtitles: boolean; snooperEnabled: boolean; soundCategory_ambient: KeyCode; soundCategory_block: KeyCode; soundCategory_hostile: KeyCode; soundCategory_master: KeyCode; soundCategory_music: KeyCode; soundCategory_neutral: KeyCode; soundCategory_player: KeyCode; soundCategory_record: KeyCode; soundCategory_voice: KeyCode; soundCategory_weather: KeyCode; touchscreen: boolean; tutorialStep: string; useNativeTransport: boolean; useVbo: boolean; version: number } | Partial<{ advancedItemTooltips: boolean; anaglyph3d: boolean; ao: AmbientOcclusion; attackIndicator: number; autoJump: boolean; bobView: boolean; chatColors: boolean; chatHeightFocused: number; chatHeightUnfocused: number; chatLinks: boolean; chatLinksPrompt: boolean; chatOpacity: number; chatScale: number; chatVisibility: number; chatWidth: number; difficulty: Difficulty; enableVsync: boolean; enableWeakAttacks: boolean; entityShadows: boolean; fancyGraphics: boolean | undefined; fboEnable: boolean; forceUnicodeFont: boolean; fov: number; fullscreen: boolean; gamma: number; guiScale: number; heldItemTooltips: boolean; hideServerAddress: boolean; incompatibleResourcePacks: string[]; invertYMouse: boolean; key_key.advancements: KeyCode; key_key.attack: KeyCode; key_key.back: KeyCode; key_key.chat: KeyCode; key_key.command: KeyCode; key_key.drop: KeyCode; key_key.forward: KeyCode; key_key.fullscreen: KeyCode; key_key.hotbar.1: KeyCode; key_key.hotbar.2: KeyCode; key_key.hotbar.3: KeyCode; key_key.hotbar.4: KeyCode; key_key.hotbar.5: KeyCode; key_key.hotbar.6: KeyCode; key_key.hotbar.7: KeyCode; key_key.hotbar.8: KeyCode; key_key.hotbar.9: KeyCode; key_key.inventory: KeyCode; key_key.jump: KeyCode; key_key.left: KeyCode; key_key.loadToolbarActivator: KeyCode; key_key.pickItem: KeyCode; key_key.playerlist: KeyCode; key_key.right: KeyCode; key_key.saveToolbarActivator: KeyCode; key_key.screenshot: KeyCode; key_key.smoothCamera: KeyCode; key_key.sneak: KeyCode; key_key.spectatorOutlines: KeyCode; key_key.sprint: KeyCode; key_key.swapHands: KeyCode; key_key.togglePerspective: KeyCode; key_key.use: KeyCode; lang: string; lastServer: string; mainHand: string; maxFps: number; mipmapLevels: MipmapLevel; modelPart_cape: boolean; modelPart_hat: boolean; modelPart_jacket: boolean; modelPart_left_pants_leg: boolean; modelPart_left_sleeve: boolean; modelPart_right_pants_leg: boolean; modelPart_right_sleeve: boolean; mouseSensitivity: number; narrator: number; overrideHeight: number; overrideWidth: number; particles: Particles; pauseOnLostFocus: boolean; realmsNotifications: boolean; reducedDebugInfo: boolean; renderClouds: RenderCloud; renderDistance: RenderDistance; resourcePacks: string[]; saturation: number; showSubtitles: boolean; snooperEnabled: boolean; soundCategory_ambient: KeyCode; soundCategory_block: KeyCode; soundCategory_hostile: KeyCode; soundCategory_master: KeyCode; soundCategory_music: KeyCode; soundCategory_neutral: KeyCode; soundCategory_player: KeyCode; soundCategory_record: KeyCode; soundCategory_voice: KeyCode; soundCategory_weather: KeyCode; touchscreen: boolean; tutorialStep: string; useNativeTransport: boolean; useVbo: boolean; version: number }>
```
Parse raw game setting options.txt content
#### Parameters

- **str**: `string`
the options.txt content
- **strict**: `boolean`
strictly follow the current version of options format (outdate version might cause problem. If your options.txt is new one with new fields, don't turn on this)
#### Return Type

- `{ advancedItemTooltips: boolean; anaglyph3d: boolean; ao: AmbientOcclusion; attackIndicator: number; autoJump: boolean; bobView: boolean; chatColors: boolean; chatHeightFocused: number; chatHeightUnfocused: number; chatLinks: boolean; chatLinksPrompt: boolean; chatOpacity: number; chatScale: number; chatVisibility: number; chatWidth: number; difficulty: Difficulty; enableVsync: boolean; enableWeakAttacks: boolean; entityShadows: boolean; fancyGraphics: boolean | undefined; fboEnable: boolean; forceUnicodeFont: boolean; fov: number; fullscreen: boolean; gamma: number; guiScale: number; heldItemTooltips: boolean; hideServerAddress: boolean; incompatibleResourcePacks: string[]; invertYMouse: boolean; key_key.advancements: KeyCode; key_key.attack: KeyCode; key_key.back: KeyCode; key_key.chat: KeyCode; key_key.command: KeyCode; key_key.drop: KeyCode; key_key.forward: KeyCode; key_key.fullscreen: KeyCode; key_key.hotbar.1: KeyCode; key_key.hotbar.2: KeyCode; key_key.hotbar.3: KeyCode; key_key.hotbar.4: KeyCode; key_key.hotbar.5: KeyCode; key_key.hotbar.6: KeyCode; key_key.hotbar.7: KeyCode; key_key.hotbar.8: KeyCode; key_key.hotbar.9: KeyCode; key_key.inventory: KeyCode; key_key.jump: KeyCode; key_key.left: KeyCode; key_key.loadToolbarActivator: KeyCode; key_key.pickItem: KeyCode; key_key.playerlist: KeyCode; key_key.right: KeyCode; key_key.saveToolbarActivator: KeyCode; key_key.screenshot: KeyCode; key_key.smoothCamera: KeyCode; key_key.sneak: KeyCode; key_key.spectatorOutlines: KeyCode; key_key.sprint: KeyCode; key_key.swapHands: KeyCode; key_key.togglePerspective: KeyCode; key_key.use: KeyCode; lang: string; lastServer: string; mainHand: string; maxFps: number; mipmapLevels: MipmapLevel; modelPart_cape: boolean; modelPart_hat: boolean; modelPart_jacket: boolean; modelPart_left_pants_leg: boolean; modelPart_left_sleeve: boolean; modelPart_right_pants_leg: boolean; modelPart_right_sleeve: boolean; mouseSensitivity: number; narrator: number; overrideHeight: number; overrideWidth: number; particles: Particles; pauseOnLostFocus: boolean; realmsNotifications: boolean; reducedDebugInfo: boolean; renderClouds: RenderCloud; renderDistance: RenderDistance; resourcePacks: string[]; saturation: number; showSubtitles: boolean; snooperEnabled: boolean; soundCategory_ambient: KeyCode; soundCategory_block: KeyCode; soundCategory_hostile: KeyCode; soundCategory_master: KeyCode; soundCategory_music: KeyCode; soundCategory_neutral: KeyCode; soundCategory_player: KeyCode; soundCategory_record: KeyCode; soundCategory_voice: KeyCode; soundCategory_weather: KeyCode; touchscreen: boolean; tutorialStep: string; useNativeTransport: boolean; useVbo: boolean; version: number } | Partial<{ advancedItemTooltips: boolean; anaglyph3d: boolean; ao: AmbientOcclusion; attackIndicator: number; autoJump: boolean; bobView: boolean; chatColors: boolean; chatHeightFocused: number; chatHeightUnfocused: number; chatLinks: boolean; chatLinksPrompt: boolean; chatOpacity: number; chatScale: number; chatVisibility: number; chatWidth: number; difficulty: Difficulty; enableVsync: boolean; enableWeakAttacks: boolean; entityShadows: boolean; fancyGraphics: boolean | undefined; fboEnable: boolean; forceUnicodeFont: boolean; fov: number; fullscreen: boolean; gamma: number; guiScale: number; heldItemTooltips: boolean; hideServerAddress: boolean; incompatibleResourcePacks: string[]; invertYMouse: boolean; key_key.advancements: KeyCode; key_key.attack: KeyCode; key_key.back: KeyCode; key_key.chat: KeyCode; key_key.command: KeyCode; key_key.drop: KeyCode; key_key.forward: KeyCode; key_key.fullscreen: KeyCode; key_key.hotbar.1: KeyCode; key_key.hotbar.2: KeyCode; key_key.hotbar.3: KeyCode; key_key.hotbar.4: KeyCode; key_key.hotbar.5: KeyCode; key_key.hotbar.6: KeyCode; key_key.hotbar.7: KeyCode; key_key.hotbar.8: KeyCode; key_key.hotbar.9: KeyCode; key_key.inventory: KeyCode; key_key.jump: KeyCode; key_key.left: KeyCode; key_key.loadToolbarActivator: KeyCode; key_key.pickItem: KeyCode; key_key.playerlist: KeyCode; key_key.right: KeyCode; key_key.saveToolbarActivator: KeyCode; key_key.screenshot: KeyCode; key_key.smoothCamera: KeyCode; key_key.sneak: KeyCode; key_key.spectatorOutlines: KeyCode; key_key.sprint: KeyCode; key_key.swapHands: KeyCode; key_key.togglePerspective: KeyCode; key_key.use: KeyCode; lang: string; lastServer: string; mainHand: string; maxFps: number; mipmapLevels: MipmapLevel; modelPart_cape: boolean; modelPart_hat: boolean; modelPart_jacket: boolean; modelPart_left_pants_leg: boolean; modelPart_left_sleeve: boolean; modelPart_right_pants_leg: boolean; modelPart_right_sleeve: boolean; mouseSensitivity: number; narrator: number; overrideHeight: number; overrideWidth: number; particles: Particles; pauseOnLostFocus: boolean; realmsNotifications: boolean; reducedDebugInfo: boolean; renderClouds: RenderCloud; renderDistance: RenderDistance; resourcePacks: string[]; saturation: number; showSubtitles: boolean; snooperEnabled: boolean; soundCategory_ambient: KeyCode; soundCategory_block: KeyCode; soundCategory_hostile: KeyCode; soundCategory_master: KeyCode; soundCategory_music: KeyCode; soundCategory_neutral: KeyCode; soundCategory_player: KeyCode; soundCategory_record: KeyCode; soundCategory_voice: KeyCode; soundCategory_weather: KeyCode; touchscreen: boolean; tutorialStep: string; useNativeTransport: boolean; useVbo: boolean; version: number }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L378" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:378</a>
</p>


### stringify

```ts
stringify(setting: any, original: string, eol: string= '\n'): string
```
Generate text format game setting for options.txt file.
#### Parameters

- **setting**: `any`
The game setting object
- **original**: `string`

- **eol**: `string`
The end of line character, default is ``\n``
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L487" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:487</a>
</p>



## 🏷️ Variables

### Graphics <Badge type="tip" text="const" />

```ts
Graphics: Readonly<{ Fancy: true; Fast: false }> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L61" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:61</a>
</p>


### RenderClouds <Badge type="tip" text="const" />

```ts
RenderClouds: Readonly<{ Fancy: true; Fast: "fast"; Off: false }> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L63" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:63</a>
</p>


### RenderDistances <Badge type="tip" text="const" />

```ts
RenderDistances: Readonly<{ Extreme: 32; Far: 16; Normal: 8; Short: 4; Tiny: 2 }> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L60" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:60</a>
</p>



## ⏩ Type Aliases

### Frame

```ts
Frame: Partial<FullFrame>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L304" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:304</a>
</p>


### FullFrame

```ts
FullFrame: typeof DEFAULT_FRAME
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L303" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:303</a>
</p>


### GameSetting

```ts
GameSetting: ReturnType<typeof getDefaultFrame>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L522" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:522</a>
</p>


### Graphic

```ts
Graphic: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L62" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:62</a>
</p>


### HotKeys

```ts
HotKeys: "attack" | "use" | "forward" | "left" | "back" | "right" | "jump" | "sneak" | "sprint" | "drop" | "inventory" | "chat" | "playerlist" | "pickItem" | "command" | "screenshot" | "togglePerspective" | "smoothCamera" | "fullscreen" | "spectatorOutlines" | "swapHands" | "saveToolbarActivator" | "loadToolbarActivator" | "advancements" | "hotbar.1" | "hotbar.2" | "hotbar.3" | "hotbar.4" | "hotbar.5" | "hotbar.6" | "hotbar.7" | "hotbar.8" | "hotbar.9"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L337" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:337</a>
</p>


### MipmapLevel

```ts
MipmapLevel: 0 | 1 | 2 | 3 | 4
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L27" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:27</a>
</p>


### ModelPart

```ts
ModelPart: "cape" | "jacket" | "left_sleeve" | "right_sleeve" | "left_pants_leg" | "right_pants_leg" | "hat"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L316" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:316</a>
</p>


### RenderCloud

```ts
RenderCloud: true | false | "fast"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L64" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:64</a>
</p>


### RenderDistance

```ts
RenderDistance: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L28" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:28</a>
</p>


### SoundCategories

```ts
SoundCategories: "master" | "music" | "record" | "weather" | "block" | "hostile" | "neutral" | "player" | "ambient" | "voice"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/gamesetting/index.ts#L325" target="_blank" rel="noreferrer">packages/gamesetting/index.ts:325</a>
</p>



