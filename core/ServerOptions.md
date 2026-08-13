# Interface ServerOptions

This is the case you provide the server jar execution path.
## 🏷️ Properties

### classPath <Badge type="info" text="optional" />

```ts
classPath: string[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L536" target="_blank" rel="noreferrer">packages/core/launch.ts:536</a>
</p>


### extraExecOption <Badge type="info" text="optional" />

```ts
extraExecOption: SpawnOptions
```
*Inherited from: `BaseServerOptions.extraExecOption`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L513" target="_blank" rel="noreferrer">packages/core/launch.ts:513</a>
</p>


### extraJVMArgs <Badge type="info" text="optional" />

```ts
extraJVMArgs: string[]
```
*Inherited from: `BaseServerOptions.extraJVMArgs`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L511" target="_blank" rel="noreferrer">packages/core/launch.ts:511</a>
</p>


### extraMCArgs <Badge type="info" text="optional" />

```ts
extraMCArgs: string[]
```
*Inherited from: `BaseServerOptions.extraMCArgs`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L512" target="_blank" rel="noreferrer">packages/core/launch.ts:512</a>
</p>


### javaPath

```ts
javaPath: string
```
Java executable.
*Inherited from: `BaseServerOptions.javaPath`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L504" target="_blank" rel="noreferrer">packages/core/launch.ts:504</a>
</p>


### mainClass <Badge type="info" text="optional" />

```ts
mainClass: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L534" target="_blank" rel="noreferrer">packages/core/launch.ts:534</a>
</p>


### maxMemory <Badge type="info" text="optional" />

```ts
maxMemory: number
```
*Inherited from: `BaseServerOptions.maxMemory`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L510" target="_blank" rel="noreferrer">packages/core/launch.ts:510</a>
</p>


### minMemory <Badge type="info" text="optional" />

```ts
minMemory: number
```
*Inherited from: `BaseServerOptions.minMemory`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L509" target="_blank" rel="noreferrer">packages/core/launch.ts:509</a>
</p>


### nogui <Badge type="info" text="optional" />

```ts
nogui: boolean
```
No gui for the server launch
*Inherited from: `BaseServerOptions.nogui`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L508" target="_blank" rel="noreferrer">packages/core/launch.ts:508</a>
</p>


### prependCommand <Badge type="info" text="optional" />

```ts
prependCommand: string | string[]
```
*Inherited from: `BaseServerOptions.prependCommand`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L515" target="_blank" rel="noreferrer">packages/core/launch.ts:515</a>
</p>


### serverExectuableJarPath <Badge type="info" text="optional" />

```ts
serverExectuableJarPath: string
```
The minecraft server exectuable jar file.

This is the case like you are launching forge server.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L532" target="_blank" rel="noreferrer">packages/core/launch.ts:532</a>
</p>


### spawn <Badge type="info" text="optional" />

```ts
spawn: (command: string, args?: readonly string[], options?: SpawnOptions) => ChildProcess
```
The spawn process function. Used for spawn the java process at the end. By default, it will be the spawn function from "child_process" module. You can use this option to change the 3rd party spawn like [cross-spawn](https://www.npmjs.com/package/cross-spawn)
*Inherited from: `BaseServerOptions.spawn`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L520" target="_blank" rel="noreferrer">packages/core/launch.ts:520</a>
</p>


