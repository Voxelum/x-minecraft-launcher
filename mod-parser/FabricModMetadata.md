# Interface FabricModMetadata

The ``ModMetadata`` is extract from ``fabric.mod.json``.

The ``fabric.mod.json`` file is a mod metadata file used by Fabric Loader to load mods.
In order to be loaded, a mod must have this file with the exact name placed in the root directory of the mod JAR.
## 🏷️ Properties

### authors <Badge type="info" text="optional" />

```ts
authors: Person[]
```
A list of authors of the mod. Each entry is a single name or an object containing following fields:
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L171" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:171</a>
</p>


### breaks <Badge type="info" text="optional" />

```ts
breaks: Record<string, string | string[]>
```
For mods whose together with yours might cause a game crash. With them a game will crash.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L126" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:126</a>
</p>


### conflicts <Badge type="info" text="optional" />

```ts
conflicts: Record<string, string | string[]>
```
For mods whose together with yours cause some kind of bugs, etc. With them a game will log a warning.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L130" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:130</a>
</p>


### contact <Badge type="info" text="optional" />

```ts
contact: { email?: string; homepage?: string; irc?: string; issues?: string; sources?: string[] }
```
Defines the contact information for the project. It is an object of the following fields:
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L145" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:145</a>
</p>


### contributors <Badge type="info" text="optional" />

```ts
contributors: Person[]
```
A list of contributors to the mod. Each entry is the same as in author field. See above.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L175" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:175</a>
</p>


### depends <Badge type="info" text="optional" />

```ts
depends: Record<string, string | string[]>
```
For dependencies required to run. Without them a game will crash.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L114" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:114</a>
</p>


### description <Badge type="info" text="optional" />

```ts
description: string
```
Defines the mod's description. If not present, assume empty string.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L141" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:141</a>
</p>


### entrypoints <Badge type="info" text="optional" />

```ts
entrypoints: string[]
```
Defines main classes of your mod, that will be loaded.
- There are 3 default entry points for your mod:
 - main Will be run first. For classes implementing ModInitializer.
 - client Will be run second and only on the client side. For classes implementing ClientModInitializer.
 - server Will be run second and only on the server side. For classes implementing DedicatedServerModInitializer.
- Each entry point can contain any number of classes to load. Classes (or methods or static fields) could be defined in two ways:
 - If you're using Java, then just list the classes (or else) full names. For example:
````json
"main": [
     "net.fabricmc.example.ExampleMod",
     "net.fabricmc.example.ExampleMod::handle"
 ]
````
 - If you're using any other language, consult the language adapter's documentation. The Kotlin one is located [here](https://github.com/FabricMC/fabric-language-kotlin/blob/master/README.md).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L66" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:66</a>
</p>


### environment <Badge type="info" text="optional" />

```ts
environment: Environment
```
Defines where mod runs: only on the client side (client mod), only on the server side (plugin) or on both sides (regular mod). Contains the environment identifier:
- ``*`` Runs everywhere. Default.
- ``client`` Runs on the client side.
- ``server`` Runs on the server side.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L48" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:48</a>
</p>


### icon <Badge type="info" text="optional" />

```ts
icon: string
```
Defines the mod's icon. Icons are square PNG files. (Minecraft resource packs use 128×128, but that is not a hard requirement - a power of two is, however, recommended.) Can be provided in one of two forms:
- A path to a single PNG file.
- A dictionary of images widths to their files' paths.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L188" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:188</a>
</p>


### id

```ts
id: string
```
Defines the mod's identifier - a string of Latin letters, digits, underscores with length from 1 to 63.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L34" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:34</a>
</p>


### jars <Badge type="info" text="optional" />

```ts
jars: { file: string }[]
```
A list of nested JARs inside your mod's JAR to load. Before using the field, check out [the guidelines on the usage of the nested JARs](https://fabricmc.net/wiki/tutorial:loader04x#nested_jars). Each entry is an object containing file key. That should be a path inside your mod's JAR to the nested JAR. For example:
````json
"jars": [
    {
        "file": "nested/vendor/dependency.jar"
    }
]
````
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L78" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:78</a>
</p>


### languageAdapters <Badge type="info" text="optional" />

```ts
languageAdapters: string[]
```
A dictionary of adapters for used languages to their adapter classes full names. For example:
````json
"languageAdapters": {
   "kotlin": "net.fabricmc.language.kotlin.KotlinAdapter"
}
````
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L87" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:87</a>
</p>


### license <Badge type="info" text="optional" />

```ts
license: string | string[]
```
Defines the licensing information.Can either be a single license string or a list of them.
- This should provide the complete set of preferred licenses conveying the entire mod package.In other words, compliance with all listed licenses should be sufficient for usage, redistribution, etc.of the mod package as a whole.
- For cases where a part of code is dual - licensed, choose the preferred license.The list is not exhaustive, serves primarily as a kind of hint, and does not prevent you from granting additional rights / licenses on a case -by -case basis.
- To aid automated tools, it is recommended to use SPDX License Identifiers for open - source licenses.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L182" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:182</a>
</p>


### mixins <Badge type="info" text="optional" />

```ts
mixins: (string | { config: string; environment: Environment })[]
```
A list of mixin configuration files.Each entry is the path to the mixin configuration file inside your mod's JAR or an object containing following fields:
 - ``config`` The path to the mixin configuration file inside your mod's JAR.
 - ``environment`` The same as upper level ``environment`` field.See above. For example:
 ````json
 "mixins": [
      "modid.mixins.json",
      {
          "config": "modid.client-mixins.json",
          "environment": "client"
      }
  ]
 ````
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L102" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:102</a>
</p>


### name <Badge type="info" text="optional" />

```ts
name: string
```
Defines the user-friendly mod's name. If not present, assume it matches id.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L137" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:137</a>
</p>


### provides <Badge type="info" text="optional" />

```ts
provides: string[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L26" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:26</a>
</p>


### recommends <Badge type="info" text="optional" />

```ts
recommends: Record<string, string | string[]>
```
For dependencies not required to run. Without them a game will log a warning.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L118" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:118</a>
</p>


### schemaVersion

```ts
schemaVersion: number
```
Needed for internal mechanisms. Must always be 1.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L30" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:30</a>
</p>


### suggests <Badge type="info" text="optional" />

```ts
suggests: Record<string, string | string[]>
```
For dependencies not required to run. Use this as a kind of metadata.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L122" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:122</a>
</p>


### version

```ts
version: string
```
Defines the mod's version - a string value, optionally matching the Semantic Versioning 2.0.0 specification.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/fabric.ts#L38" target="_blank" rel="noreferrer">packages/mod-parser/fabric.ts:38</a>
</p>


