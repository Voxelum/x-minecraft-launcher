# Interface TeamMember

## 🏷️ Properties

### accepted

```ts
accepted: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L356" target="_blank" rel="noreferrer">packages/modrinth/types.ts:356</a>
</p>


### permissions

```ts
permissions: number
```
The user's permissions in bitfield format (requires authorization to view)

In order from first to eighth bit, the bits are:

- UPLOAD_VERSION
- DELETE_VERSION
- EDIT_DETAILS
- EDIT_BODY
- MANAGE_INVITES
- REMOVE_MEMBER
- EDIT_MEMBER
- DELETE_PROJECT
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L355" target="_blank" rel="noreferrer">packages/modrinth/types.ts:355</a>
</p>


### role

```ts
role: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L340" target="_blank" rel="noreferrer">packages/modrinth/types.ts:340</a>
</p>


### team_id

```ts
team_id: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L301" target="_blank" rel="noreferrer">packages/modrinth/types.ts:301</a>
</p>


### user

```ts
user: { avatar_url: string; bio: string; created: string; email?: string; github_id?: number; id: string; name?: string; role: "admin" | "moderator" | "developer"; username: string }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L302" target="_blank" rel="noreferrer">packages/modrinth/types.ts:302</a>
</p>


