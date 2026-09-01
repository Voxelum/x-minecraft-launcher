# Interface QueryOption

The options to query
## 🏷️ Properties

### client <Badge type="info" text="optional" />

```ts
client: (url: string, options: QueryOption, body?: object, text?: boolean) => Promise<string | object>
```
override the http client
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L477" target="_blank" rel="noreferrer">packages/curseforge/index.ts:477</a>
</p>


### headers <Badge type="info" text="optional" />

```ts
headers: Record<string, any>
```
Additional header
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L473" target="_blank" rel="noreferrer">packages/curseforge/index.ts:473</a>
</p>


