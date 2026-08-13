# Class YggdrasilClient

## 🏭 Constructors

### constructor

```ts
YggdrasilClient(api: string, options: YggdrasilClientOptions): YggdrasilClient
```
Create client for official-like api endpoint
#### Parameters

- **api**: `string`
The official-like api endpoint
- **options**: `YggdrasilClientOptions`
#### Return Type

- `YggdrasilClient`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L112" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:112</a>
</p>


## 🏷️ Properties

### api <Badge type="tip" text="public" />

```ts
api: string
```
The official-like api endpoint
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L113" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:113</a>
</p>


### fetch <Badge type="warning" text="protected" />

```ts
fetch: { (input: RequestInfo | URL, init?: RequestInit): Promise<Response>; (input: string | Request | URL, init?: RequestInit): Promise<Response> }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L104" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:104</a>
</p>


### File <Badge type="warning" text="protected" />

```ts
File: (fileBits: BlobPart[], fileName: string, options?: FilePropertyBag) => File
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L106" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:106</a>
</p>


### FormData <Badge type="warning" text="protected" />

```ts
FormData: (form?: HTMLFormElement, submitter?: HTMLElement | null) => FormData
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L105" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:105</a>
</p>


### headers <Badge type="warning" text="protected" />

```ts
headers: Record<string, string>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L103" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:103</a>
</p>


## 🔧 Methods

### invalidate

```ts
invalidate(accessToken: string, clientToken: string, signal: AbortSignal): Promise<boolean>
```
#### Parameters

- **accessToken**: `string`
- **clientToken**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L135" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:135</a>
</p>


### login

```ts
login(__namedParameters: { clientToken: string; password: string; requestUser?: boolean; username: string }, signal: AbortSignal): Promise<YggrasilAuthentication>
```
#### Parameters

- **__namedParameters**: `{ clientToken: string; password: string; requestUser?: boolean; username: string }`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<YggrasilAuthentication>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L147" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:147</a>
</p>


### refresh

```ts
refresh(__namedParameters: { accessToken: string; clientToken: string; requestUser?: boolean }, signal: AbortSignal): Promise<YggrasilAuthentication>
```
#### Parameters

- **__namedParameters**: `{ accessToken: string; clientToken: string; requestUser?: boolean }`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<YggrasilAuthentication>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L187" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:187</a>
</p>


### validate

```ts
validate(accessToken: string, clientToken: string, signal: AbortSignal): Promise<boolean>
```
#### Parameters

- **accessToken**: `string`
- **clientToken**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L122" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:122</a>
</p>


