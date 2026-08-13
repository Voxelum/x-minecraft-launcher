# Class MicrosoftAuthenticator

The microsoft authenticator for Minecraft (Xbox) account.
## 🏭 Constructors

### constructor

```ts
MicrosoftAuthenticator(options: MicrosoftAuthenticatorOptions): MicrosoftAuthenticator
```
#### Parameters

- **options**: `MicrosoftAuthenticatorOptions`
#### Return Type

- `MicrosoftAuthenticator`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L176" target="_blank" rel="noreferrer">packages/user/microsoft.ts:176</a>
</p>


## 🏷️ Properties

### fetch

```ts
fetch: { (input: RequestInfo | URL, init?: RequestInit): Promise<Response>; (input: string | Request | URL, init?: RequestInit): Promise<Response> }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L170" target="_blank" rel="noreferrer">packages/user/microsoft.ts:170</a>
</p>


## 🔧 Methods

### acquireXBoxToken

```ts
acquireXBoxToken(oauthAccessToken: string, signal: AbortSignal): Promise<{ liveXstsResponse: XBoxResponse | undefined; minecraftXstsResponse: XBoxResponse }>
```
Acquire both Minecraft and xbox token and xbox game profile.
You can use the xbox token to login Minecraft by [loginMinecraftWithXBox](#MicrosoftAuthenticator.loginMinecraftWithXBox).

This method is the composition of calling
- [authenticateXboxLive](#MicrosoftAuthenticator.authenticateXboxLive)
- [authorizeXboxLive](#MicrosoftAuthenticator.authorizeXboxLive) to ``rp://api.minecraftservices.com/``
- [authorizeXboxLive](#MicrosoftAuthenticator.authorizeXboxLive) to ``http://xboxlive.com``
- [getXboxGameProfile](#MicrosoftAuthenticator.getXboxGameProfile)

You can call them individually if you want a more detailed control.
#### Parameters

- **oauthAccessToken**: `string`
The microsoft access token
- **signal**: `AbortSignal`
The abort signal
#### Return Type

- `Promise<{ liveXstsResponse: XBoxResponse | undefined; minecraftXstsResponse: XBoxResponse }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L443" target="_blank" rel="noreferrer">packages/user/microsoft.ts:443</a>
</p>


### authenticateXboxDevice

```ts
authenticateXboxDevice(signal: AbortSignal): Promise<Pick<XBoxResponse, "Token" | "NotAfter">>
```
#### Parameters

- **signal**: `AbortSignal`
#### Return Type

- `Promise<Pick<XBoxResponse, "Token" | "NotAfter">>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L215" target="_blank" rel="noreferrer">packages/user/microsoft.ts:215</a>
</p>


### authenticateXboxLive

```ts
authenticateXboxLive(oauthAccessToken: string, signal: AbortSignal): Promise<XBoxResponse>
```
Authenticate with xbox live by ms oauth access token
#### Parameters

- **oauthAccessToken**: `string`
The oauth access token
- **signal**: `AbortSignal`
#### Return Type

- `Promise<XBoxResponse>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L185" target="_blank" rel="noreferrer">packages/user/microsoft.ts:185</a>
</p>


### authorizeXboxLive

```ts
authorizeXboxLive(xblResponseToken: string, relyingParty: "rp://api.minecraftservices.com/" | "http://xboxlive.com"= 'rp://api.minecraftservices.com/', signal: AbortSignal, deviceToken: string): Promise<XBoxResponse>
```
Authorize the xbox live. It will get the xsts token in response.
#### Parameters

- **xblResponseToken**: `string`
The [XBoxResponse.Token](#XBoxResponse.Token)
- **relyingParty**: `"rp://api.minecraftservices.com/" | "http://xboxlive.com"`
- **signal**: `AbortSignal`
- **deviceToken**: `string`
#### Return Type

- `Promise<XBoxResponse>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L312" target="_blank" rel="noreferrer">packages/user/microsoft.ts:312</a>
</p>


### getXboxGameProfile

```ts
getXboxGameProfile(xuid: string, uhs: string, xstsToken: string, signal: AbortSignal): Promise<XBoxGameProfileResponse>
```
Get xbox user profile, including **username** and **avatar**.

You can find the parameters from the [XBoxResponse](XBoxResponse).
#### Parameters

- **xuid**: `string`
The ``xuid`` in a [XBoxResponse.DisplayClaims](#XBoxResponse.DisplayClaims)
- **uhs**: `string`
The ``uhs`` in a [XBoxResponse.DisplayClaims](#XBoxResponse.DisplayClaims)
- **xstsToken**: `string`
The [XBoxResponse.Token](#XBoxResponse.Token)
- **signal**: `AbortSignal`
#### Return Type

- `Promise<XBoxGameProfileResponse>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L366" target="_blank" rel="noreferrer">packages/user/microsoft.ts:366</a>
</p>


### getXboxPresence

```ts
getXboxPresence(xuids: string[], uhs: string, xstsToken: string, signal: AbortSignal): Promise<XBoxPresenceRecord[]>
```
Fetch Xbox Live presence status for a list of xuids or single xuid.
#### Parameters

- **xuids**: `string[]`
Array of Xbox User IDs (xuid)
- **uhs**: `string`
The ``uhs`` in [XBoxResponse.DisplayClaims](#XBoxResponse.DisplayClaims)
- **xstsToken**: `string`
The [XBoxResponse.Token](#XBoxResponse.Token)
- **signal**: `AbortSignal`
#### Return Type

- `Promise<XBoxPresenceRecord[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L395" target="_blank" rel="noreferrer">packages/user/microsoft.ts:395</a>
</p>


### loginMinecraftWithXBox

```ts
loginMinecraftWithXBox(uhs: string, xstsToken: string, signal: AbortSignal): Promise<MinecraftAuthResponse>
```
Login Minecraft with an Xbox token. This method does exactly one HTTP
attempt -- if you need retry/backoff for transient failures (408, 425,
429, 5xx), compose it on the caller side by wrapping the ``fetch`` you
inject into this authenticator. On any non-200 the method throws a
[MicrosoftMinecraftXboxLoginError](MicrosoftMinecraftXboxLoginError) that carries ``status``,
``body``, parsed ``retryAfter`` (ms) and a ``retryable`` flag so the UI can
surface a precise message (see issue #1445).
#### Parameters

- **uhs**: `string`
uhs from [XBoxResponse](XBoxResponse) of [acquireXBoxToken](#MicrosoftAuthenticator.acquireXBoxToken)
- **xstsToken**: `string`
You need to get this token from [acquireXBoxToken](#MicrosoftAuthenticator.acquireXBoxToken)
- **signal**: `AbortSignal`
#### Return Type

- `Promise<MinecraftAuthResponse>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/user/microsoft.ts#L490" target="_blank" rel="noreferrer">packages/user/microsoft.ts:490</a>
</p>


