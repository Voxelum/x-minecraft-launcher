# Interface ModernForgeInstallWorkflowOptions

## 🏷️ Properties

### artifactVersion

```ts
artifactVersion: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L36" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:36</a>
</p>


### batchLauncher <Badge type="info" text="optional" />

```ts
batchLauncher: { classpath?: string; content: string; cwd?: string; encoding?: "utf8" | "base64"; javaArgs?: string[]; path: string }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L40" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:40</a>
</p>


### id

```ts
id: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L32" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:32</a>
</p>


### installer

```ts
installer: InstallFile
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L35" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:35</a>
</p>


### installOptions

```ts
installOptions: InstallForgeOptions
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L38" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:38</a>
</p>


### java

```ts
java: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L37" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:37</a>
</p>


### minecraft

```ts
minecraft: MinecraftFolder
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L33" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:33</a>
</p>


### minecraftVersion

```ts
minecraftVersion: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L34" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:34</a>
</p>


### postprocessMetadata <Badge type="info" text="optional" />

```ts
postprocessMetadata: Record<string, string | number | boolean>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L48" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:48</a>
</p>


### resolveProcessor <Badge type="info" text="optional" />

```ts
resolveProcessor: (processor: PostProcessor) => Promise<ForgeProcessorResolution>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L49" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:49</a>
</p>


### side <Badge type="info" text="optional" />

```ts
side: "server" | "client"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L39" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:39</a>
</p>


