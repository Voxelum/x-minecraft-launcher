# Class ModelLoader

The model loader load the resource
## 🏭 Constructors

### constructor

```ts
ModelLoader(loader: ResourceLoader): ModelLoader
```

#### Parameters

- **loader**: `ResourceLoader`
The resource loader
#### Return Type

- `ModelLoader`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/modelLoader.ts#L33" target="_blank" rel="noreferrer">packages/resourcepack/modelLoader.ts:33</a>
</p>


## 🏷️ Properties

### loader <Badge type="tip" text="readonly" />

```ts
loader: ResourceLoader
```
The resource loader
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/modelLoader.ts#L33" target="_blank" rel="noreferrer">packages/resourcepack/modelLoader.ts:33</a>
</p>


### models <Badge type="tip" text="readonly" />

```ts
models: Record<string, Resolved> = {}
```
All the resolved model
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/modelLoader.ts#L28" target="_blank" rel="noreferrer">packages/resourcepack/modelLoader.ts:28</a>
</p>


### textures <Badge type="tip" text="readonly" />

```ts
textures: Record<string, Resource> = {}
```
All required texture raw resources
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/modelLoader.ts#L24" target="_blank" rel="noreferrer">packages/resourcepack/modelLoader.ts:24</a>
</p>


## 🔧 Methods

### loadModel

```ts
loadModel(modelPath: string, folder: string= 'block'): Promise<Resolved>
```
Load a model by search its parent. It will throw an error if the model is not found.
#### Parameters

- **modelPath**: `string`
- **folder**: `string`
#### Return Type

- `Promise<Resolved>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/modelLoader.ts#L38" target="_blank" rel="noreferrer">packages/resourcepack/modelLoader.ts:38</a>
</p>


### findRealTexturePath <Badge type="warning" text="static" />

```ts
findRealTexturePath(model: Resolved, variantKey: string): string | undefined
```
#### Parameters

- **model**: `Resolved`
- **variantKey**: `string`
#### Return Type

- `string | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/modelLoader.ts#L9" target="_blank" rel="noreferrer">packages/resourcepack/modelLoader.ts:9</a>
</p>


