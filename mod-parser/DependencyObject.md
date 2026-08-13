# Interface DependencyObject

A dependency object defines what mods/plugins a given mod depends on or breaks.
It can be represented as either an object containing at least the id field, a string mod identifier in the form of either mavenGroup:modId or modId, or an array of dependency objects.
If an array of dependency objects is provided, the dependency matches if it matches ANY of the dependency objects for the "depends" and "unless" fields, and ALL for the "breaks" field.
## 🏷️ Properties

### id

```ts
id: string
```
A mod identifier in the form of either mavenGroup:modId or modId.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L24" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:24</a>
</p>


### optional <Badge type="info" text="optional" />

```ts
optional: boolean
```
Dependencies marked as optional will only be checked if the mod/plugin specified by the id field is present.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L39" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:39</a>
</p>


### reason <Badge type="info" text="optional" />

```ts
reason: string
```
A short, human-readable reason for the dependency object to exist.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L35" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:35</a>
</p>


### unless <Badge type="info" text="optional" />

```ts
unless: DependencyObject
```
Describes situations where this dependency can be ignored. For example:

````
{
    "id": "sodium",
    "unless": "indium"
}
````

Game providers and loader plugins can also add their own optional fields to the dependency object for extra context when resolving dependencies. The Minecraft game provider, for instance, might define an "environment" field that can be used like so:

````
{
    "id": "modmenu",
    "environment": "client"
}
````
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L59" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:59</a>
</p>


### versions <Badge type="info" text="optional" />

```ts
versions: string | string[]
```
Should be a version specifier or array of version specifiers defining what versions this dependency applies to. If an array of versions is provided, the dependency matches if it matches ANY of the listed versions.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/quilt.ts#L31" target="_blank" rel="noreferrer">packages/mod-parser/quilt.ts:31</a>
</p>


