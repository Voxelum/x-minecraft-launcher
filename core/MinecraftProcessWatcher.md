# Interface MinecraftProcessWatcher

The Minecraft process watcher. You can inspect Minecraft launch state by this.

Generally, there are several cases after you call ``launch`` and get ``ChildProcess`` object

1. child process fire an error, no real process start.
2. child process started, but game crash (code is not 0).
3. cihld process started, game normally exit (code is 0).
## 🔧 Methods

### on

```ts
on(event: "error", listener: (error: any) => void): this
```
Fire when the process DOESN'T start at all, like "java not found".

The minecraft-kill or minecraft-exit will NOT fire after this fired.
#### Parameters

- **event**: `"error"`
- **listener**: `(error: any) => void`
#### Return Type

- `this`

```ts
on(event: "minecraft-exit", listener: (event: { code: number; crashReport: string; crashReportLocation: string; signal: string }) => void): this
```
Fire after Minecraft process exit.
#### Parameters

- **event**: `"minecraft-exit"`
- **listener**: `(event: { code: number; crashReport: string; crashReportLocation: string; signal: string }) => void`
#### Return Type

- `this`

```ts
on(event: "minecraft-window-ready", listener: () => void): this
```
Fire around the time when Minecraft window appeared in screen.

Since the Minecraft window will take time to init, this event fire when it capture some keywords from stdout.
#### Parameters

- **event**: `"minecraft-window-ready"`
- **listener**: `() => void`
#### Return Type

- `this`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L561" target="_blank" rel="noreferrer">packages/core/launch.ts:561</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L565" target="_blank" rel="noreferrer">packages/core/launch.ts:565</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L591" target="_blank" rel="noreferrer">packages/core/launch.ts:591</a>
</p>


