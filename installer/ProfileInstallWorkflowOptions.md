# Interface ProfileInstallWorkflowOptions

## 🏷️ Properties

### batchLauncher <Badge type="info" text="optional" />

```ts
batchLauncher: { classpath?: string; content: string; cwd?: string; encoding?: "utf8" | "base64"; javaArgs?: string[]; path: string }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L64" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:64</a>
</p>


### id

```ts
id: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L58" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:58</a>
</p>


### installOptions

```ts
installOptions: InstallForgeOptions
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L62" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:62</a>
</p>


### java

```ts
java: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L61" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:61</a>
</p>


### minecraft

```ts
minecraft: MinecraftFolder
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L60" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:60</a>
</p>


### postprocessMetadata <Badge type="info" text="optional" />

```ts
postprocessMetadata: Record<string, string | number | boolean>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L65" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:65</a>
</p>


### profile

```ts
profile: InstallProfile
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L59" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:59</a>
</p>


### resolveProcessor <Badge type="info" text="optional" />

```ts
resolveProcessor: (processor: PostProcessor) => Promise<ForgeProcessorResolution>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L66" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:66</a>
</p>


### side <Badge type="info" text="optional" />

```ts
side: "server" | "client"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L63" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:63</a>
</p>


