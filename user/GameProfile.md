# Interface GameProfile

The game profile of the user.

In auth response, it will usually carry the ``userId``, ``createdAt`` properties.

In ``lookup`` function, it will carry the ``properties`` property.
## 🏷️ Properties

### createdAt <Badge type="info" text="optional" />

```ts
createdAt: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/gameProfile.ts#L19" target="_blank" rel="noreferrer">packages/user/gameProfile.ts:19</a>
</p>


### id

```ts
id: string
```
game profile unique id
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/gameProfile.ts#L12" target="_blank" rel="noreferrer">packages/user/gameProfile.ts:12</a>
</p>


### legacy <Badge type="info" text="optional" />

```ts
legacy: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/gameProfile.ts#L24" target="_blank" rel="noreferrer">packages/user/gameProfile.ts:24</a>
</p>


### legacyProfile <Badge type="info" text="optional" />

```ts
legacyProfile: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/gameProfile.ts#L20" target="_blank" rel="noreferrer">packages/user/gameProfile.ts:20</a>
</p>


### migrated <Badge type="info" text="optional" />

```ts
migrated: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/gameProfile.ts#L23" target="_blank" rel="noreferrer">packages/user/gameProfile.ts:23</a>
</p>


### name

```ts
name: string
```
This is in game displayed name
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/gameProfile.ts#L16" target="_blank" rel="noreferrer">packages/user/gameProfile.ts:16</a>
</p>


### paid <Badge type="info" text="optional" />

```ts
paid: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/gameProfile.ts#L22" target="_blank" rel="noreferrer">packages/user/gameProfile.ts:22</a>
</p>


### properties <Badge type="info" text="optional" />

```ts
properties: { [name: string]: string }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/gameProfile.ts#L17" target="_blank" rel="noreferrer">packages/user/gameProfile.ts:17</a>
</p>


### suspended <Badge type="info" text="optional" />

```ts
suspended: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/gameProfile.ts#L21" target="_blank" rel="noreferrer">packages/user/gameProfile.ts:21</a>
</p>


### userId <Badge type="info" text="optional" />

```ts
userId: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/gameProfile.ts#L18" target="_blank" rel="noreferrer">packages/user/gameProfile.ts:18</a>
</p>


