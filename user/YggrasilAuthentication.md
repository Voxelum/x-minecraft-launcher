# Interface YggrasilAuthentication

The auth response format.

Please refer https://wiki.vg/Authentication
## 🏷️ Properties

### accessToken

```ts
accessToken: string
```
hexadecimal or JSON-Web-Token (unconfirmed) [The normal accessToken can be found in the payload of the JWT (second by '.' separated part as Base64 encoded JSON object), in key "yggt"]
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L13" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:13</a>
</p>


### availableProfiles

```ts
availableProfiles: GameProfile[]
```
only present if the agent field was received
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L21" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:21</a>
</p>


### clientToken

```ts
clientToken: string
```
identical to the one received
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L17" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:17</a>
</p>


### selectedProfile

```ts
selectedProfile: GameProfile
```
only present if the agent field was received
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L25" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:25</a>
</p>


### user <Badge type="info" text="optional" />

```ts
user: { blocked?: boolean; dateOfBirth?: number; email?: string; emailVerified?: boolean; id: string; legacyUser?: boolean; migrated?: boolean; migratedAt?: number; migratedFrom?: string; passwordChangedAt?: number; properties?: object[]; registeredAt?: number; registerIp?: string; secured?: boolean; suspended?: boolean; username: string; verifiedByParent?: boolean }
```
only present if requestUser was true in the request payload
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/yggdrasil.ts#L29" target="_blank" rel="noreferrer">packages/user/yggdrasil.ts:29</a>
</p>


