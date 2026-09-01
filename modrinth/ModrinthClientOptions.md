# Interface ModrinthClientOptions

## 🏷️ Properties

### baseUrl <Badge type="info" text="optional" />

```ts
baseUrl: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L193" target="_blank" rel="noreferrer">packages/modrinth/index.ts:193</a>
</p>


### fetch <Badge type="info" text="optional" />

```ts
fetch: { (input: RequestInfo | URL, init?: RequestInit): Promise<Response>; (input: string | Request | URL, init?: RequestInit): Promise<Response> }
```
The fetch function to use
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L201" target="_blank" rel="noreferrer">packages/modrinth/index.ts:201</a>
</p>


### headers <Badge type="info" text="optional" />

```ts
headers: Record<string, string>
```
The extra headers
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L197" target="_blank" rel="noreferrer">packages/modrinth/index.ts:197</a>
</p>


