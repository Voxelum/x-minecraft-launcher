# Interface MojangFriendsListResponse

## 🏷️ Properties

### etag <Badge type="info" text="optional" />

```ts
etag: string
```
The etag returned by the server. Used for ``If-None-Match`` to skip
unchanged responses (the server replies with 304 in that case).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L650" target="_blank" rel="noreferrer">packages/user/mojang.ts:650</a>
</p>


### friends

```ts
friends: MojangFriendProfile[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L643" target="_blank" rel="noreferrer">packages/user/mojang.ts:643</a>
</p>


### incomingRequests

```ts
incomingRequests: MojangFriendProfile[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L644" target="_blank" rel="noreferrer">packages/user/mojang.ts:644</a>
</p>


### outgoingRequests

```ts
outgoingRequests: MojangFriendProfile[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/mojang.ts#L645" target="_blank" rel="noreferrer">packages/user/mojang.ts:645</a>
</p>


