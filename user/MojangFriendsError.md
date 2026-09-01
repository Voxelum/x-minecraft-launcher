# Class MojangFriendsError

## 🏭 Constructors

### constructor

```ts
MojangFriendsError(message: string, status: number, payload: any): MojangFriendsError
```
#### Parameters

- **message**: `string`
- **status**: `number`
- **payload**: `any`
#### Return Type

- `MojangFriendsError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L676" target="_blank" rel="noreferrer">packages/user/mojang.ts:676</a>
</p>


## 🏷️ Properties

### details <Badge type="info" text="optional" />

```ts
details: any
```
The original error payload returned by the server, when available.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L668" target="_blank" rel="noreferrer">packages/user/mojang.ts:668</a>
</p>


### name

```ts
name: string = 'MojangFriendsError'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L664" target="_blank" rel="noreferrer">packages/user/mojang.ts:664</a>
</p>


### status

```ts
status: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L669" target="_blank" rel="noreferrer">packages/user/mojang.ts:669</a>
</p>


### subStatus <Badge type="info" text="optional" />

```ts
subStatus: string
```
Sub-status from the ``details.status`` field on 400 responses (e.g.
``UNKNOWN_PROFILE``, ``CANNOT_ADD_SELF``, ``DUPLICATED_PROFILES``).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L674" target="_blank" rel="noreferrer">packages/user/mojang.ts:674</a>
</p>


