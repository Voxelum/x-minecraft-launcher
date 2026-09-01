# Interface ForgeModAnnotationData

The
## 🏷️ Properties

### acceptableRemoteVersions

```ts
acceptableRemoteVersions: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L57" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:57</a>
</p>


### acceptableSaveVersions

```ts
acceptableSaveVersions: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L58" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:58</a>
</p>


### acceptedMinecraftVersions

```ts
acceptedMinecraftVersions: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L56" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:56</a>
</p>


### clientSideOnly

```ts
clientSideOnly: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L61" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:61</a>
</p>


### dependencies

```ts
dependencies: string
```
A dependency string for this mod, which specifies which mod(s) it depends on in order to run.

A dependency string must start with a combination of these prefixes, separated by "-":
    [before, after], [required], [client, server]
    At least one "before", "after", or "required" must be specified.
Then ":" and the mod id.
Then a version range should be specified for the mod by adding "@" and the version range.
    The version range format is described in the javadoc here:
    [VersionRange#createFromVersionSpec(java.lang.String)]
Then a ";".

If a "required" mod is missing, or a mod exists with a version outside the specified range,
the game will not start and an error screen will tell the player which versions are required.

Example:
    Our example mod:
     * depends on Forge and uses new features that were introduced in Forge version 14.21.1.2395
        "required:forge@[14.21.1.2395,);"

         1.12.2 Note: for compatibility with Forge older than 14.23.0.2501 the syntax must follow this older format:
         "required-after:forge@[14.21.1.2395,);"
         For more explanation see https://github.com/MinecraftForge/MinecraftForge/issues/4918

     * is a dedicated addon to mod1 and has to have its event handlers run after mod1's are run,
        "required-after:mod1;"
     * has optional integration with mod2 which depends on features introduced in mod2 version 4.7.0,
        "after:mod2@[4.7.0,);"
     * depends on a client-side-only rendering library called rendermod
        "required-client:rendermod;"

    The full dependencies string is all of those combined:
        "required:forge@[14.21.1.2395,);required-after:mod1;after:mod2@[4.7.0,);required-client:rendermod;"

    This will stop the game and display an error message if any of these is true:
        The installed forge is too old,
        mod1 is missing,
        an old version of mod2 is present,
        rendermod is missing on the client.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L54" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:54</a>
</p>


### modid

```ts
modid: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L11" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:11</a>
</p>


### modLanguage

```ts
modLanguage: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L59" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:59</a>
</p>


### modLanguageAdapter

```ts
modLanguageAdapter: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L60" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:60</a>
</p>


### name

```ts
name: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L12" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:12</a>
</p>


### serverSideOnly

```ts
serverSideOnly: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L62" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:62</a>
</p>


### useMetadata

```ts
useMetadata: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L55" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:55</a>
</p>


### value

```ts
value: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L10" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:10</a>
</p>


### version

```ts
version: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L13" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:13</a>
</p>


