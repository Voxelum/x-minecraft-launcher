# Interface Pack

Holds the resource pack information
## 🏷️ Properties

### description

```ts
description: string | object
```
Text that will be shown below the pack name in the resource pack menu.
The text will be shown on two lines. If the text is too long it will be cut off.

Contains a raw JSON text object that will be shown instead as the pack description in the resource pack menu.
Same behavior as the string version of the description tag, but they cannot exist together.[
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L104" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:104</a>
</p>


### pack_format

```ts
pack_format: number
```
Pack version. If this number does not match the current required number, the resource pack will display an error and required additional confirmation to load the pack.
Requires 1 for 1.6.1–1.8.9, 2 for 1.9–1.10.2, 3 for 1.11–1.12.2, and 4 for 1.13–1.14.4.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L96" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:96</a>
</p>


