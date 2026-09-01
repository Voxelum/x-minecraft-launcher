# Interface InstallLabyModAddonOptions

## 🏷️ Properties

### checksum <Badge type="info" text="optional" />

```ts
checksum: (file: string, algorithm: string) => Promise<string>
```
Custom checksum function for file validation
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L46" target="_blank" rel="noreferrer">packages/installer/labymod.ts:46</a>
</p>


### environment <Badge type="info" text="optional" />

```ts
environment: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L33" target="_blank" rel="noreferrer">packages/installer/labymod.ts:33</a>
</p>


### fetch <Badge type="info" text="optional" />

```ts
fetch: (url: string, init?: RequestInit) => Promise<Response>
```
*Inherited from: `FetchOptions.fetch`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.browser.ts#L45" target="_blank" rel="noreferrer">packages/installer/utils.browser.ts:45</a>
</p>


### installDependencies <Badge type="info" text="optional" />

```ts
installDependencies: boolean
```
Whether to install addon dependencies automatically
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L38" target="_blank" rel="noreferrer">packages/installer/labymod.ts:38</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
*Inherited from: `FetchOptions.signal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.browser.ts#L46" target="_blank" rel="noreferrer">packages/installer/utils.browser.ts:46</a>
</p>


### tracker <Badge type="info" text="optional" />

```ts
tracker: Tracker<LabyModTrackerEvents>
```
The tracker to track the install process
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L42" target="_blank" rel="noreferrer">packages/installer/labymod.ts:42</a>
</p>


