# Interface ResolvedVersion

The resolved version for launcher.
It could be a combination of multiple versions as there might be some inheritions.

You can get resolved version of a Minecraft by calling [Version.parse](#Version.parse).
## 🏷️ Properties

### arguments

```ts
arguments: { game: LaunchArgument[]; jvm: LaunchArgument[] }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L28" target="_blank" rel="noreferrer">packages/core/version.ts:28</a>
</p>


### assetIndex <Badge type="info" text="optional" />

```ts
assetIndex: AssetIndex
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L36" target="_blank" rel="noreferrer">packages/core/version.ts:36</a>
</p>


### assets

```ts
assets: string
```
The asset index id of this version. Should be something like ``1.14``, ``1.12``
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L40" target="_blank" rel="noreferrer">packages/core/version.ts:40</a>
</p>


### downloads

```ts
downloads: { client?: Download; server?: Download; [key: string]: Download | undefined }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L41" target="_blank" rel="noreferrer">packages/core/version.ts:41</a>
</p>


### id

```ts
id: string
```
The id of the version, should be identical to the version folder.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L27" target="_blank" rel="noreferrer">packages/core/version.ts:27</a>
</p>


### inheritances

```ts
inheritances: string[]
```
The version inheritances of this whole resolved version.

The first element is this version, and the last element is the root Minecraft version.
The dependencies of ``[a, b, c]`` should be ``a -> b -> c``, where c is a Minecraft version.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L77" target="_blank" rel="noreferrer">packages/core/version.ts:77</a>
</p>


### javaVersion

```ts
javaVersion: JavaVersion
```
Recommended java version
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L62" target="_blank" rel="noreferrer">packages/core/version.ts:62</a>
</p>


### libraries

```ts
libraries: ResolvedLibrary[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L46" target="_blank" rel="noreferrer">packages/core/version.ts:46</a>
</p>


### logging <Badge type="info" text="optional" />

```ts
logging: { [key: string]: { argument: string; file: Download & { id: string }; type: string } }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L52" target="_blank" rel="noreferrer">packages/core/version.ts:52</a>
</p>


### mainClass

```ts
mainClass: string
```
The main class full qualified name
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L35" target="_blank" rel="noreferrer">packages/core/version.ts:35</a>
</p>


### minecraftDirectory

```ts
minecraftDirectory: string
```
The minecraft directory of this version
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L70" target="_blank" rel="noreferrer">packages/core/version.ts:70</a>
</p>


### minecraftVersion

```ts
minecraftVersion: string
```
The minecraft version of this version
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L66" target="_blank" rel="noreferrer">packages/core/version.ts:66</a>
</p>


### minimumLauncherVersion

```ts
minimumLauncherVersion: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L48" target="_blank" rel="noreferrer">packages/core/version.ts:48</a>
</p>


### pathChain

```ts
pathChain: string[]
```
All array of json file paths.

It's the chain of inherits json path. The root json will be the last element of the array.
The first element is the user provided version.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L85" target="_blank" rel="noreferrer">packages/core/version.ts:85</a>
</p>


### releaseTime

```ts
releaseTime: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L49" target="_blank" rel="noreferrer">packages/core/version.ts:49</a>
</p>


### time

```ts
time: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L50" target="_blank" rel="noreferrer">packages/core/version.ts:50</a>
</p>


### type

```ts
type: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L51" target="_blank" rel="noreferrer">packages/core/version.ts:51</a>
</p>


