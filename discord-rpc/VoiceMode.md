# Interface VoiceMode

## 🏷️ Properties

### auto_threshold

```ts
auto_threshold: boolean
```
voice activity threshold automatically sets its threshold
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/VoiceSettings.ts#L69" target="_blank" rel="noreferrer">packages/discord-rpc/structures/VoiceSettings.ts:69</a>
</p>


### delay

```ts
delay: number
```
the PTT release delay (in ms) (min: 0, max: 2000)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/VoiceSettings.ts#L81" target="_blank" rel="noreferrer">packages/discord-rpc/structures/VoiceSettings.ts:81</a>
</p>


### shortcut

```ts
shortcut: ShortcutKeyCombo[]
```
shortcut key combos for PTT
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/VoiceSettings.ts#L77" target="_blank" rel="noreferrer">packages/discord-rpc/structures/VoiceSettings.ts:77</a>
</p>


### threshold

```ts
threshold: number
```
threshold for voice activity (in dB) (min: -100, max: 0)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/VoiceSettings.ts#L73" target="_blank" rel="noreferrer">packages/discord-rpc/structures/VoiceSettings.ts:73</a>
</p>


### type

```ts
type: "PUSH_TO_TALK" | "VOICE_ACTIVITY"
```
voice setting mode type (can be ``PUSH_TO_TALK`` or ``VOICE_ACTIVITY``)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/VoiceSettings.ts#L65" target="_blank" rel="noreferrer">packages/discord-rpc/structures/VoiceSettings.ts:65</a>
</p>


