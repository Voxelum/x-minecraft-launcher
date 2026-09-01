# Class CertifiedDevice

## 🏭 Constructors

### constructor

```ts
CertifiedDevice(client: Client, props: Record<string, any>): CertifiedDevice
```
#### Parameters

- **client**: `Client`
- **props**: `Record<string, any>`
#### Return Type

- `CertifiedDevice`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/CertifiedDevice.ts#L70" target="_blank" rel="noreferrer">packages/discord-rpc/structures/CertifiedDevice.ts:70</a>
</p>


## 🏷️ Properties

### automatic_gain_control <Badge type="info" text="optional" />

```ts
automatic_gain_control: boolean
```
if the device's native automatic gain control is enabled
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/CertifiedDevice.ts#L64" target="_blank" rel="noreferrer">packages/discord-rpc/structures/CertifiedDevice.ts:64</a>
</p>


### client

```ts
client: Client
```
the client instance
*Inherited from: `Base.client`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Base.ts#L7" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Base.ts:7</a>
</p>


### echo_cancellation <Badge type="info" text="optional" />

```ts
echo_cancellation: boolean
```
if the device's native echo cancellation is enabled
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/CertifiedDevice.ts#L56" target="_blank" rel="noreferrer">packages/discord-rpc/structures/CertifiedDevice.ts:56</a>
</p>


### hardware_mute <Badge type="info" text="optional" />

```ts
hardware_mute: boolean
```
if the device is hardware muted
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/CertifiedDevice.ts#L68" target="_blank" rel="noreferrer">packages/discord-rpc/structures/CertifiedDevice.ts:68</a>
</p>


### id

```ts
id: string
```
the device's Windows UUID
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/CertifiedDevice.ts#L40" target="_blank" rel="noreferrer">packages/discord-rpc/structures/CertifiedDevice.ts:40</a>
</p>


### model

```ts
model: Model
```
the model of the product
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/CertifiedDevice.ts#L48" target="_blank" rel="noreferrer">packages/discord-rpc/structures/CertifiedDevice.ts:48</a>
</p>


### noise_suppression <Badge type="info" text="optional" />

```ts
noise_suppression: boolean
```
if the device's native noise suppression is enabled
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/CertifiedDevice.ts#L60" target="_blank" rel="noreferrer">packages/discord-rpc/structures/CertifiedDevice.ts:60</a>
</p>


### related

```ts
related: string[]
```
UUIDs of related devices
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/CertifiedDevice.ts#L52" target="_blank" rel="noreferrer">packages/discord-rpc/structures/CertifiedDevice.ts:52</a>
</p>


### type

```ts
type: DeviceType
```
the type of device
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/CertifiedDevice.ts#L36" target="_blank" rel="noreferrer">packages/discord-rpc/structures/CertifiedDevice.ts:36</a>
</p>


### vendor

```ts
vendor: Vendor
```
the hardware vendor
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/CertifiedDevice.ts#L44" target="_blank" rel="noreferrer">packages/discord-rpc/structures/CertifiedDevice.ts:44</a>
</p>


