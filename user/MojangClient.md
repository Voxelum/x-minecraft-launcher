# Class MojangClient

The mojang api client. Please referece https://wiki.vg/Mojang_API.

All the apis need user to authenticate the access token from microsoft.
## 🏭 Constructors

### constructor

```ts
MojangClient(options: MojangClientOptions): MojangClient
```
#### Parameters

- **options**: `MojangClientOptions`
#### Return Type

- `MojangClient`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L226" target="_blank" rel="noreferrer">packages/user/mojang.ts:226</a>
</p>


## 🏷️ Properties

### File <Badge type="warning" text="protected" />

```ts
File: (fileBits: BlobPart[], fileName: string, options?: FilePropertyBag) => File
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L224" target="_blank" rel="noreferrer">packages/user/mojang.ts:224</a>
</p>


### FormData <Badge type="warning" text="protected" />

```ts
FormData: typeof FormData
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L223" target="_blank" rel="noreferrer">packages/user/mojang.ts:223</a>
</p>


## 🔧 Methods

### addFriend

```ts
addFriend(token: string, target: { name?: string; profileId?: string }, signal: AbortSignal): Promise<void>
```
Add a friend either by Minecraft username or by profile uuid.

If both are provided, ``name`` takes precedence.
#### Parameters

- **token**: `string`
- **target**: `{ name?: string; profileId?: string }`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L541" target="_blank" rel="noreferrer">packages/user/mojang.ts:541</a>
</p>


### checkGameOwnership

```ts
checkGameOwnership(token: string, signal: AbortSignal): Promise<MinecraftOwnershipResponse>
```
Return the owner ship list of the player with those token.
#### Parameters

- **token**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<MinecraftOwnershipResponse>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L479" target="_blank" rel="noreferrer">packages/user/mojang.ts:479</a>
</p>


### checkNameAvailability

```ts
checkNameAvailability(name: string, token: string, signal: AbortSignal): Promise<NameAvailability>
```
#### Parameters

- **name**: `string`
- **token**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<NameAvailability>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L285" target="_blank" rel="noreferrer">packages/user/mojang.ts:285</a>
</p>


### getFriends

```ts
getFriends(token: string, etag: string, signal: AbortSignal): Promise<MojangFriendsListResponse | { etag?: string; notModified: true }>
```
Fetch the friends list of the current authenticated player.

Returns ``friends``, ``incomingRequests`` and ``outgoingRequests`` arrays.

Throws [UnauthorizedError](UnauthorizedError) on 401, [MojangFriendsError](MojangFriendsError) on other failures.
#### Parameters

- **token**: `string`
- **etag**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<MojangFriendsListResponse | { etag?: string; notModified: true }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L512" target="_blank" rel="noreferrer">packages/user/mojang.ts:512</a>
</p>


### getNameChangeInformation

```ts
getNameChangeInformation(token: string): Promise<NameChangeInformation>
```
#### Parameters

- **token**: `string`
#### Return Type

- `Promise<NameChangeInformation>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L272" target="_blank" rel="noreferrer">packages/user/mojang.ts:272</a>
</p>


### getPlayerAttributes

```ts
getPlayerAttributes(token: string, signal: AbortSignal): Promise<MojangPlayerAttributes>
```
Fetch the player's attributes (including friends preferences).
#### Parameters

- **token**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<MojangPlayerAttributes>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L606" target="_blank" rel="noreferrer">packages/user/mojang.ts:606</a>
</p>


### getProfile

```ts
getProfile(token: string, signal: AbortSignal): Promise<MicrosoftMinecraftProfile>
```
#### Parameters

- **token**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<MicrosoftMinecraftProfile>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L304" target="_blank" rel="noreferrer">packages/user/mojang.ts:304</a>
</p>


### getSecurityChallenges

```ts
getSecurityChallenges(token: string): Promise<MojangChallenge[]>
```
#### Parameters

- **token**: `string`
#### Return Type

- `Promise<MojangChallenge[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L443" target="_blank" rel="noreferrer">packages/user/mojang.ts:443</a>
</p>


### hideCape

```ts
hideCape(token: string, signal: AbortSignal): Promise<void>
```
#### Parameters

- **token**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L389" target="_blank" rel="noreferrer">packages/user/mojang.ts:389</a>
</p>


### removeFriend

```ts
removeFriend(token: string, target: { name?: string; profileId?: string }, signal: AbortSignal): Promise<void>
```
Remove a friend (or decline an incoming request, or revoke an outgoing
request) by profile uuid or username.
#### Parameters

- **token**: `string`
- **target**: `{ name?: string; profileId?: string }`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L549" target="_blank" rel="noreferrer">packages/user/mojang.ts:549</a>
</p>


### resetSkin

```ts
resetSkin(token: string, signal: AbortSignal): Promise<void>
```
#### Parameters

- **token**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L373" target="_blank" rel="noreferrer">packages/user/mojang.ts:373</a>
</p>


### setName

```ts
setName(name: string, token: string, signal: AbortSignal): Promise<MicrosoftMinecraftProfile>
```
#### Parameters

- **name**: `string`
- **token**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<MicrosoftMinecraftProfile>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L232" target="_blank" rel="noreferrer">packages/user/mojang.ts:232</a>
</p>


### setSkin

```ts
setSkin(fileName: string, skin: string | Buffer<ArrayBufferLike>, variant: "slim" | "classic", token: string, signal: AbortSignal): Promise<MinecraftProfileResponse>
```
#### Parameters

- **fileName**: `string`
- **skin**: `string | Buffer<ArrayBufferLike>`
- **variant**: `"slim" | "classic"`
- **token**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<MinecraftProfileResponse>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L326" target="_blank" rel="noreferrer">packages/user/mojang.ts:326</a>
</p>


### showCape

```ts
showCape(capeId: string, token: string, signal: AbortSignal): Promise<MicrosoftMinecraftProfile>
```
#### Parameters

- **capeId**: `string`
- **token**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<MicrosoftMinecraftProfile>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L405" target="_blank" rel="noreferrer">packages/user/mojang.ts:405</a>
</p>


### submitSecurityChallenges

```ts
submitSecurityChallenges(answers: MojangChallengeResponse[], token: string): Promise<void>
```
#### Parameters

- **answers**: `MojangChallengeResponse[]`
- **token**: `string`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L457" target="_blank" rel="noreferrer">packages/user/mojang.ts:457</a>
</p>


### updatePlayerAttributes

```ts
updatePlayerAttributes(token: string, prefs: { acceptInvites?: boolean; friendsEnabled?: boolean }, signal: AbortSignal): Promise<void>
```
Update the player's friend-related preferences.
#### Parameters

- **token**: `string`
- **prefs**: `{ acceptInvites?: boolean; friendsEnabled?: boolean }`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L580" target="_blank" rel="noreferrer">packages/user/mojang.ts:580</a>
</p>


### verifySecurityLocation

```ts
verifySecurityLocation(token: string, signal: AbortSignal): Promise<boolean>
```
#### Parameters

- **token**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L428" target="_blank" rel="noreferrer">packages/user/mojang.ts:428</a>
</p>


