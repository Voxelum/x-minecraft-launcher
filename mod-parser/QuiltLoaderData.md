# Interface QuiltLoaderData

## 🏷️ Properties

### breaks <Badge type="info" text="optional" />

```ts
breaks: DependencyObject[]
```
An array of dependency objects. Defines mods that this mod either breaks or is broken by.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L214" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:214</a>
</p>


### depends <Badge type="info" text="optional" />

```ts
depends: DependencyObject[]
```
An array of dependency objects. Defines mods that this mod will not function without.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L209" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:209</a>
</p>


### entrypoints <Badge type="info" text="optional" />

```ts
entrypoints: Record<string, string>
```
A collection of ``key: value`` pairs, where each key is the type of the entrypoints specified and each values is either a single entrypoint or an array of entrypoints. An entrypoint is an object with the following keys:

- adapter — Language adapter to use for this entrypoint. By default this is ``default`` and tells loader to parse using the JVM entrypoint notation.
- value — Points to an implementation of the entrypoint. See below for the default JVM notation.

If an entrypoint does not need to specify a language adapter other than the default language adapter, the entrypoint can be represented simply as the value string instead.

### JVM entrypoint notation

When referring to a class, the binary name is used. An example of a binary name is ``my.mod.MyClass$Inner``.

One of the following ``value`` notations may be used in the JVM notation:

- Implementation onto a class
  - The value must contain a fully qualified binary name to the class.
  - Implementing class must extend or implement the entrypoint interface.
  - Class must have a no-argument public constructor.
  - Example: example.mod.MainModClass
- A field inside of a class.
  - The value must contain a fully qualified binary name to the class followed by :: and a field name.
  - The field must be static.
  - The type of the field must be assignable from the field's class.
  - Example: example.mod.MainModClass::THE_INSTANCE
  - If there is ambiguity with a method's name, an exception will be thrown.
- A method inside of a class.
  - The value must contain a fully qualified binary name to the class followed by :: and a method name.
  - The method must be capable to implement the entrypoint type as a method reference. Generally this means classes which are functional interfaces.
  - Constructor requirement varies based on the method being static or instance level:
    - A static method does not require a public no-argument constructor.
    - An instance method requires a public no-argument constructor.
  - Example: example.mod.MainModClass::init
  - If there is ambiguity with a fields's name or other method, an exception will be thrown.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L182" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:182</a>
</p>


### group

```ts
group: string
```
A unique identifier for the organization behind or developers of the mod. The group string must match the ^[a-zA-Z0-9-_.]+$ regular expression, and must not begin with the reserved namespace loader.plugin. It is recommended, but not required, to follow Maven's [guide to naming conventions](https://maven.apache.org/guides/mini/guide-naming-conventions.html).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L66" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:66</a>
</p>


### id

```ts
id: string
```
A unique identifier for the mod or library defined by this file, matching the ^[a-z][a-z0-9-_]{1,63}$ regular expression. Best practice is that mod ID's are in snake_case.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L70" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:70</a>
</p>


### intermediate_mappings <Badge type="info" text="optional" />

```ts
intermediate_mappings: string
```
The intermediate mappings used for this mod. The intermediate mappings string must be a valid maven coordinate and match the ^[a-zA-Z0-9-_.]+:[a-zA-Z0-9-_.]+$ regular expression. This field currently only officially supports org.quiltmc:hashed and net.fabricmc:intermediary.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L246" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:246</a>
</p>


### jars <Badge type="info" text="optional" />

```ts
jars: string[]
```
A list of paths to nested JAR files to load, relative to the root directory inside of the mods JAR.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L199" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:199</a>
</p>


### language_adapters <Badge type="info" text="optional" />

```ts
language_adapters: Record<string, string>
```
A collection of ``key: value`` pairs, where each key is the namespace of a language adapter and the value is an implementation of the ``LanguageAdapter`` interface.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L204" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:204</a>
</p>


### load_type <Badge type="info" text="optional" />

```ts
load_type: string
```
Influences whether or not a mod candidate should be loaded or not. May be any of these values:

- "always" (default for mods directly in the mods folder)
- "if_possible"
- "if_required" (default for jar-in-jar mods)

This doesn't affect mods directly placed in the mods folder.

##### Always
If any versions of this mod are present, then one of them will be loaded. Due to how mod loading actually works if any of the different versions of this mod are present, and one of them has "load_type" set to "always", then all of them are treated as it being set to "always".

##### If Possible
If this mod can be loaded, then it will - otherwise it will silently not be loaded.

##### If Required
If this mod is in another mods "depends" field then it will be loaded, otherwise it will silently not be loaded.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L234" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:234</a>
</p>


### metadata <Badge type="info" text="optional" />

```ts
metadata: { contact?: { email?: string; homepage?: string; issues?: string; sources?: string }; contributors?: Record<string, string>; description?: string; icon?: string | Record<string, string>; license?: string | string[] | { description?: string; id: string; name: string; url: string }; name?: string }
```
Optional metadata that can be used by mods to display information about the mods installed.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L82" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:82</a>
</p>


### minecraft <Badge type="info" text="optional" />

```ts
minecraft: { access_widener?: string | string[]; environment?: string }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L248" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:248</a>
</p>


### plugins <Badge type="info" text="optional" />

```ts
plugins: string[]
```
An array of loader plugins. A plugin is an object with the following keys:

- adapter — Language adapter to use for this plugin
- value — Points to an implementation of the ``LoaderPlugin`` interface. Can be in either of the following forms:
  - ``my.package.MyClass`` — A class to be instantiated and used
  - ``my.package.MyClass::thing`` — A static field containing an instance of a ``LoaderPlugin``

If a plugin does not need to specify a language adapter other than the default language adapter, the plugin can be represented simply as the value string instead.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L194" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:194</a>
</p>


### provides <Badge type="info" text="optional" />

```ts
provides: string[]
```
An array of ProvidesObjects describing other mods/APIs that this package provides.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L74" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:74</a>
</p>


### repositories <Badge type="info" text="optional" />

```ts
repositories: string[]
```
A list of Maven repository URL strings where dependencies can be looked for in addition to Quilt's central repository.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L239" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:239</a>
</p>


### version

```ts
version: string
```
Must conform to the Semantic Versioning 2.0.0 specification. In a development environment, the value ${version} can be used as a placeholder by quilt-gradle to be replaced on building the resulting JAR.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L78" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:78</a>
</p>


