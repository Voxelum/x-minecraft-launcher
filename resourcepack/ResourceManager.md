# Class ResourceManager

The resource manager just like Minecraft. Design to be able to use in both nodejs and browser environment.
## 🏭 Constructors

### constructor

```ts
ResourceManager(list: ResourcePackWrapper[]= []): ResourceManager<T>
```
#### Parameters

- **list**: `ResourcePackWrapper[]`
The list order is just like the order in options.txt. The last element is the highest priority one.
The resource will load from the last one to the first one.
#### Return Type

- `ResourceManager<T>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourceManager.ts#L24" target="_blank" rel="noreferrer">packages/resourcepack/resourceManager.ts:24</a>
</p>


## 🏷️ Properties

### list <Badge type="tip" text="public" />

```ts
list: ResourcePackWrapper[] = []
```
The list order is just like the order in options.txt. The last element is the highest priority one.
The resource will load from the last one to the first one.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourceManager.ts#L29" target="_blank" rel="noreferrer">packages/resourcepack/resourceManager.ts:29</a>
</p>


## 🔑 Accessors

### allResourcePacks

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourceManager.ts#L32" target="_blank" rel="noreferrer">packages/resourcepack/resourceManager.ts:32</a>
</p>


## 🔧 Methods

### addResourcePack

```ts
addResourcePack(resourcePack: ResourcePack): Promise<{ domains: string[]; info: Pack; source: ResourcePack }>
```
Add a new resource source as the first priority of the resource list.
#### Parameters

- **resourcePack**: `ResourcePack`
#### Return Type

- `Promise<{ domains: string[]; info: Pack; source: ResourcePack }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourceManager.ts#L39" target="_blank" rel="noreferrer">packages/resourcepack/resourceManager.ts:39</a>
</p>


### clear

```ts
clear(): ResourcePackWrapper[]
```
Clear all resource packs in this manager
#### Return Type

- `ResourcePackWrapper[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourceManager.ts#L61" target="_blank" rel="noreferrer">packages/resourcepack/resourceManager.ts:61</a>
</p>


### get

```ts
get(location: ResourceLocation): Promise<Resource | undefined>
```
Get the resource in that location. This will walk through current resource source list to load the resource.
#### Parameters

- **location**: `ResourceLocation`
The resource location
#### Return Type

- `Promise<Resource | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourceManager.ts#L82" target="_blank" rel="noreferrer">packages/resourcepack/resourceManager.ts:82</a>
</p>


### remove

```ts
remove(index: number): ResourcePackWrapper
```
#### Parameters

- **index**: `number`
#### Return Type

- `ResourcePackWrapper`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourceManager.ts#L54" target="_blank" rel="noreferrer">packages/resourcepack/resourceManager.ts:54</a>
</p>


### swap

```ts
swap(first: number, second: number): void
```
Swap the resource source priority.
#### Parameters

- **first**: `number`
- **second**: `number`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourceManager.ts#L68" target="_blank" rel="noreferrer">packages/resourcepack/resourceManager.ts:68</a>
</p>


