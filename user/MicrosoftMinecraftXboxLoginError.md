# Class MicrosoftMinecraftXboxLoginError

Thrown by [MicrosoftAuthenticator.loginMinecraftWithXBox](#MicrosoftAuthenticator.loginMinecraftWithXBox) when the
Minecraft auth endpoint returns a non-200 response. Carries enough
context that the launcher can tell the user *exactly* what went wrong
instead of a generic "loginMinecraftByXboxFailed" (see issue #1445).

Retry semantics (for 408/425/429/5xx) are intentionally out of scope of
this module -- compose them on the caller side by wrapping the injected
``fetch`` (see ```xmcl-runtime/user/utils/withRetry.ts``` in the launcher).
## 🏭 Constructors

### constructor

```ts
MicrosoftMinecraftXboxLoginError(status: number, body: string, retryAfter: number, retryable: boolean): MicrosoftMinecraftXboxLoginError
```
#### Parameters

- **status**: `number`
- **body**: `string`
- **retryAfter**: `number`
Effective Retry-After in ms from the response header, if any.
- **retryable**: `boolean`
True when the status is in the transient set a retrying client would
normally retry (408/425/429/5xx). Useful to tell the user "try again
in a moment" vs. "this is a permanent error".
#### Return Type

- `MicrosoftMinecraftXboxLoginError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L150" target="_blank" rel="noreferrer">packages/user/microsoft.ts:150</a>
</p>


## 🏷️ Properties

### body <Badge type="tip" text="public" />

```ts
body: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L152" target="_blank" rel="noreferrer">packages/user/microsoft.ts:152</a>
</p>


### name

```ts
name: string = 'MicrosoftMinecraftXboxLoginError'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L149" target="_blank" rel="noreferrer">packages/user/microsoft.ts:149</a>
</p>


### retryable <Badge type="info" text="optional" /> <Badge type="tip" text="public" />

```ts
retryable: boolean
```
True when the status is in the transient set a retrying client would
normally retry (408/425/429/5xx). Useful to tell the user "try again
in a moment" vs. "this is a permanent error".
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L160" target="_blank" rel="noreferrer">packages/user/microsoft.ts:160</a>
</p>


### retryAfter <Badge type="info" text="optional" /> <Badge type="tip" text="public" />

```ts
retryAfter: number
```
Effective Retry-After in ms from the response header, if any.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L154" target="_blank" rel="noreferrer">packages/user/microsoft.ts:154</a>
</p>


### status <Badge type="tip" text="public" />

```ts
status: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L151" target="_blank" rel="noreferrer">packages/user/microsoft.ts:151</a>
</p>


