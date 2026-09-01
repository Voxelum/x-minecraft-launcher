# Namespace Version

## 🤝 Interfaces

<div class="definition-grid interface"><a href="core/Version/Version.Artifact">Artifact</a><a href="core/Version/Version.AssetIndex">AssetIndex</a><a href="core/Version/Version.Download">Download</a><a href="core/Version/Version.LegacyLibrary">LegacyLibrary</a><a href="core/Version/Version.LoggingFile">LoggingFile</a><a href="core/Version/Version.NativeLibrary">NativeLibrary</a><a href="core/Version/Version.NormalLibrary">NormalLibrary</a><a href="core/Version/Version.PlatformSpecificLibrary">PlatformSpecificLibrary</a><a href="core/Version/Version.Rule">Rule</a></div>

## 🏭 Functions

### checkAllowed

```ts
checkAllowed(rules: Rule[], platform: Platform= ..., features: string[]= []): boolean
```
Check if all the rules in ``Rule[]`` are acceptable in certain OS ``platform`` and features.
#### Parameters

- **rules**: `Rule[]`
The rules usually comes from ``Library`` or ``LaunchArgument``
- **platform**: `Platform`
The platform, leave it absent will use the ``currentPlatform``
- **features**: `string[]`
The features, used by game launch argument ``arguments.game``
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L358" target="_blank" rel="noreferrer">packages/core/version.ts:358</a>
</p>


### inherits

```ts
inherits(id: string, parent: Version, version: Version): Version
```
Simply extends the version (actaully mixin)

The result version will have the union of two version's libs. If one lib in two versions has different version, it will take the extra version one.
It will also mixin the launchArgument if it could.

This function can be used for mixin forge and liteloader version.

This function will throw an Error if two version have different assets. It doesn't care about the detail version though.
#### Parameters

- **id**: `string`
The new version id
- **parent**: `Version`
The parent version will be inherited
- **version**: `Version`
The version info which will overlap some parent information
#### Return Type

- `Version`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L606" target="_blank" rel="noreferrer">packages/core/version.ts:606</a>
</p>


### mixinArgumentString

```ts
mixinArgumentString(hi: string, lo: string): string
```
Mixin the string arguments
#### Parameters

- **hi**: `string`
Higher priority argument
- **lo**: `string`
Lower priority argument
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L650" target="_blank" rel="noreferrer">packages/core/version.ts:650</a>
</p>


### normalizeVersionJson

```ts
normalizeVersionJson(versionString: string, root: string, platform: Platform= ...): PartialResolvedVersion
```
Normalize a single version json.

This function will force legacy version format into new format.
It will convert ``minecraftArguments`` into ``arguments.game`` and generate a default ``arguments.jvm``

This will pre-process the libraries according to the rules fields and current platform.
Non-matched libraries will be filtered out.

This will also pre-process the jvm arguments according to the platform (os) info it provided.
#### Parameters

- **versionString**: `string`
The version json string
- **root**: `string`
The root of the version
- **platform**: `Platform`
#### Return Type

- `PartialResolvedVersion`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L869" target="_blank" rel="noreferrer">packages/core/version.ts:869</a>
</p>


### parse

```ts
parse(minecraftPath: MinecraftLocation, version: string, platofrm: Platform= ...): Promise<ResolvedVersion>
```
Recursively parse the version JSON.

This function requires that the id in version.json is identical to the directory name of that version.

e.g. .minecraft/&lt;version-a&gt;/&lt;version-a.json&gt; and in &lt;version-a.json&gt;:
````
{ "id": "<version-a>", ... }
````
The function might throw multiple parsing errors. You can handle them with type by this:
````ts
try {
  await Version.parse(mcPath, version);
} catch (e) {
  let err = e as VersionParseError;
  switch (err.error) {
    case "BadVersionJson": // do things...
    // handle other cases
    default: // this means this is not a VersionParseError, handle error normally.
  }
}
````
#### Parameters

- **minecraftPath**: `MinecraftLocation`
The .minecraft path
- **version**: `string`
The vesion id.
- **platofrm**: `Platform`
#### Return Type

- `Promise<ResolvedVersion>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L434" target="_blank" rel="noreferrer">packages/core/version.ts:434</a>
</p>


### parseServer

```ts
parseServer(minecraftPath: MinecraftLocation, version: string): Promise<ResolvedServerVersion>
```
Parse the server version from the Minecraft folder.

This is non-standard version json format, only contains server related information.
#### Parameters

- **minecraftPath**: `MinecraftLocation`
The path of the Minecraft folder
- **version**: `string`
The version id
#### Return Type

- `Promise<ResolvedServerVersion>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L455" target="_blank" rel="noreferrer">packages/core/version.ts:455</a>
</p>


### resolve

```ts
resolve(minecraftPath: MinecraftLocation, hierarchy: PartialResolvedVersion[]): ResolvedVersion
```
Resolve the given version hierarchy into ``ResolvedVersion``.

Some launcher has non-standard version json format to handle hierarchy,
and if you want to handle them, you can use this function to parse.
#### Parameters

- **minecraftPath**: `MinecraftLocation`
The path of the Minecraft folder
- **hierarchy**: `PartialResolvedVersion[]`
The version hierarchy, which can be produced by ``normalizeVersionJson``
#### Return Type

- `ResolvedVersion`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L489" target="_blank" rel="noreferrer">packages/core/version.ts:489</a>
</p>


### resolveDependency

```ts
resolveDependency(path: MinecraftLocation, version: string, platform: Platform= ...): Promise<PartialResolvedVersion[]>
```
Resolve the dependencies of a minecraft version
#### Parameters

- **path**: `MinecraftLocation`
The path of minecraft
- **version**: `string`
The version id
- **platform**: `Platform`
#### Return Type

- `Promise<PartialResolvedVersion[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L703" target="_blank" rel="noreferrer">packages/core/version.ts:703</a>
</p>


### resolveLibraries

```ts
resolveLibraries(libs: Library[], platform: Platform= ...): ResolvedLibrary[]
```
Resolve all these library and filter out os specific libs
#### Parameters

- **libs**: `Library[]`
All raw lib
- **platform**: `Platform`
The platform
#### Return Type

- `ResolvedLibrary[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L846" target="_blank" rel="noreferrer">packages/core/version.ts:846</a>
</p>


### resolveLibrary

```ts
resolveLibrary(lib: Library, platform: Platform= ...): ResolvedLibrary | undefined
```
#### Parameters

- **lib**: `Library`
- **platform**: `Platform`
#### Return Type

- `ResolvedLibrary | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L758" target="_blank" rel="noreferrer">packages/core/version.ts:758</a>
</p>


## ⏩ Type Aliases

### LaunchArgument

```ts
LaunchArgument: string | { rules?: Rule[]; value: string | string[] }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L345" target="_blank" rel="noreferrer">packages/core/version.ts:345</a>
</p>


### Library

```ts
Library: NormalLibrary | NativeLibrary | PlatformSpecificLibrary | LegacyLibrary
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L343" target="_blank" rel="noreferrer">packages/core/version.ts:343</a>
</p>


