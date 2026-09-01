# Interface InstallProfile

## 🏷️ Properties

### data <Badge type="info" text="optional" />

```ts
data: { [key: string]: { client: string; server: string } }
```
The processor shared variables. The key is the name of variable to replace.

The value of client/server is the value of the variable.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L67" target="_blank" rel="noreferrer">packages/installer/profile.ts:67</a>
</p>


### json

```ts
json: string
```
The version json path
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L53" target="_blank" rel="noreferrer">packages/installer/profile.ts:53</a>
</p>


### libraries

```ts
libraries: NormalLibrary[]
```
The required install profile libraries
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L75" target="_blank" rel="noreferrer">packages/installer/profile.ts:75</a>
</p>


### minecraft

```ts
minecraft: string
```
The minecraft version
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L61" target="_blank" rel="noreferrer">packages/installer/profile.ts:61</a>
</p>


### path

```ts
path: string
```
The maven artifact name: ``<org>:<artifact-id>:<version>``
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L57" target="_blank" rel="noreferrer">packages/installer/profile.ts:57</a>
</p>


### processors <Badge type="info" text="optional" />

```ts
processors: PostProcessor[]
```
The post processor. Which require java to run.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L71" target="_blank" rel="noreferrer">packages/installer/profile.ts:71</a>
</p>


### profile

```ts
profile: string
```
The type of this installation, like "forge"
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L45" target="_blank" rel="noreferrer">packages/installer/profile.ts:45</a>
</p>


### spec <Badge type="info" text="optional" />

```ts
spec: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L41" target="_blank" rel="noreferrer">packages/installer/profile.ts:41</a>
</p>


### version

```ts
version: string
```
The version of this installation
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L49" target="_blank" rel="noreferrer">packages/installer/profile.ts:49</a>
</p>


### versionInfo <Badge type="info" text="optional" />

```ts
versionInfo: Version
```
Legacy format
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L79" target="_blank" rel="noreferrer">packages/installer/profile.ts:79</a>
</p>


