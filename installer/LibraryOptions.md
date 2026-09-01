# Interface LibraryOptions

Change the library host url
## 🏷️ Properties

### checksum <Badge type="info" text="optional" />

```ts
checksum: (file: string, algorithm: string) => Promise<string>
```
Custom checksum function for file validation
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L42" target="_blank" rel="noreferrer">packages/installer/libraries.ts:42</a>
</p>


### diagnose <Badge type="info" text="optional" />

```ts
diagnose: boolean
```
*Inherited from: `WithDiagnose.diagnose`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L143" target="_blank" rel="noreferrer">packages/installer/utils.ts:143</a>
</p>


### libraryHost <Badge type="info" text="optional" />

```ts
libraryHost: LibraryHost
```
A more flexiable way to control library download url.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L30" target="_blank" rel="noreferrer">packages/installer/libraries.ts:30</a>
</p>


### mavenHost <Badge type="info" text="optional" />

```ts
mavenHost: string | string[]
```
The alterative maven host to download library. It will try to use these host from the ``[0]`` to the ``[maven.length - 1]``
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L34" target="_blank" rel="noreferrer">packages/installer/libraries.ts:34</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L46" target="_blank" rel="noreferrer">packages/installer/libraries.ts:46</a>
</p>


### strict <Badge type="info" text="optional" />

```ts
strict: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L44" target="_blank" rel="noreferrer">packages/installer/libraries.ts:44</a>
</p>


### timestamp <Badge type="info" text="optional" />

```ts
timestamp: number
```
Timestamp of the last fully validated installation.
*Inherited from: `WithDiagnose.timestamp`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L145" target="_blank" rel="noreferrer">packages/installer/utils.ts:145</a>
</p>


### tracker <Badge type="info" text="optional" />

```ts
tracker: Tracker<LibrariesTrackerEvents>
```
The tracker to track the install process
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L38" target="_blank" rel="noreferrer">packages/installer/libraries.ts:38</a>
</p>


