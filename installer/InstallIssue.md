# Interface InstallIssue

## 🏷️ Properties

### assets <Badge type="info" text="optional" />

```ts
assets: { hash: string; name: string; size: number }[]
```
assets that failed to install
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/error.ts#L34" target="_blank" rel="noreferrer">packages/installer/error.ts:34</a>
</p>


### assetsIndex <Badge type="info" text="optional" />

```ts
assetsIndex: AssetIndex
```
bad assets index
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/error.ts#L38" target="_blank" rel="noreferrer">packages/installer/error.ts:38</a>
</p>


### forge <Badge type="info" text="optional" />

```ts
forge: { minecraft: string; version: string }
```
bad forge install
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/error.ts#L23" target="_blank" rel="noreferrer">packages/installer/error.ts:23</a>
</p>


### jar <Badge type="info" text="optional" />

```ts
jar: string
```
bad minecraft jar
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/error.ts#L19" target="_blank" rel="noreferrer">packages/installer/error.ts:19</a>
</p>


### libraries <Badge type="info" text="optional" />

```ts
libraries: ResolvedLibrary[]
```
libraries requires to install
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/error.ts#L30" target="_blank" rel="noreferrer">packages/installer/error.ts:30</a>
</p>


### optifine <Badge type="info" text="optional" />

```ts
optifine: string
```
optifine version that failed to install. e.g. "1.12.2_HD_U_G6_pre1"
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/error.ts#L44" target="_blank" rel="noreferrer">packages/installer/error.ts:44</a>
</p>


### profile <Badge type="info" text="optional" />

```ts
profile: InstallProfile
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/error.ts#L40" target="_blank" rel="noreferrer">packages/installer/error.ts:40</a>
</p>


