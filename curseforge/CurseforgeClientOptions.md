# Interface CurseforgeClientOptions

## 🏷️ Properties

### baseUrl <Badge type="info" text="optional" />

```ts
baseUrl: string
```
The base url, the default is ``https://api.curseforge.com``
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L524" target="_blank" rel="noreferrer">packages/curseforge/index.ts:524</a>
</p>


### fetch <Badge type="info" text="optional" />

```ts
fetch: { (input: RequestInfo | URL, init?: RequestInit): Promise<Response>; (input: string | Request | URL, init?: RequestInit): Promise<Response> }
```
The fetch function to use. The default is ``fetch``
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L528" target="_blank" rel="noreferrer">packages/curseforge/index.ts:528</a>
</p>


### headers <Badge type="info" text="optional" />

```ts
headers: Record<string, string>
```
Extra headers
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L520" target="_blank" rel="noreferrer">packages/curseforge/index.ts:520</a>
</p>


