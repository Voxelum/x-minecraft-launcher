# Class Device

## 🏭 Constructors

### constructor

```ts
Device(url: string): Device
```
#### Parameters

- **url**: `string`
#### Return Type

- `Device`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/device.ts#L72" target="_blank" rel="noreferrer">packages/nat-api/lib/device.ts:72</a>
</p>


## 🏷️ Properties

### services

```ts
services: string[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/device.ts#L65" target="_blank" rel="noreferrer">packages/nat-api/lib/device.ts:65</a>
</p>


### url <Badge type="tip" text="readonly" />

```ts
url: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/device.ts#L72" target="_blank" rel="noreferrer">packages/nat-api/lib/device.ts:72</a>
</p>


## 🔧 Methods

### connectDevice

```ts
connectDevice(): Promise<DeviceInfo>
```
#### Return Type

- `Promise<DeviceInfo>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/device.ts#L80" target="_blank" rel="noreferrer">packages/nat-api/lib/device.ts:80</a>
</p>


### run

```ts
run(action: string, args: Record<string, number | string | undefined>): Promise<any>
```
#### Parameters

- **action**: `string`
- **args**: `Record<string, number | string | undefined>`
#### Return Type

- `Promise<any>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/device.ts#L111" target="_blank" rel="noreferrer">packages/nat-api/lib/device.ts:111</a>
</p>


