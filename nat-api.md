# nat-api

Fast port mapping with **UPnP** and **NAT-PMP** in NodeJS.

This is a fork version of [nat-api](https://npmjs.org/nat-api).

The major differences are:

- Use typescript, so has type definition.
- Split PMP and upnp API, so you can use them individually.
- Support ESM.
- Optimize the dependencies. (only 2 up-to-dated deps)

## Install

**Required: NodeJS >= 16**

```sh
npm install @xmcl/nat-api
```

## Usage

```js
const { createUpnpClient } = require('nat-api')

const client = await createUpnpClient()

// map 25565 to 25565 for 1 min:
await client.map({
  description: "Mapped by @xmcl/nat-api",
  protocol: 'tcp',
  public: 25565,
  private: 25565,
  ttl: 60 * 1000,
})

// Unmap port public and private port 25565 with TCP by default
await client.unmap({ port: 25565 })

// Get external IP
const mappings = await client.getMappings()

// see existed mappings
console.log(mappings)

// Destroy client
client.destroy()
```

## API

See type definition in typescript.

## Additional Information

- http://miniupnp.free.fr/nat-pmp.html
- http://wikipedia.org/wiki/NAT_Port_Mapping_Protocol
- http://tools.ietf.org/html/draft-cheshire-nat-pmp-03

## License

MIT. Copyright (c) [Alex](https://github.com/alxhotel)

[nat-api-ti]: https://img.shields.io/travis/com/alxhotel/nat-api/master.svg
[nat-api-tu]: https://travis-ci.com/alxhotel/nat-api
[nat-api-ni]: https://img.shields.io/npm/v/nat-api.svg
[nat-api-nu]: https://npmjs.org/package/nat-api
[nat-api-di]: https://david-dm.org/alxhotel/nat-api/status.svg
[nat-api-du]: https://david-dm.org/alxhotel/nat-api
[standard-image]: https://img.shields.io/badge/code_style-standard-brightgreen.svg
[standard-url]: https://standardjs.com

## 🧾 Classes

<div class="definition-grid class"><a href="nat-api/Device">Device</a><a href="nat-api/PmpClient">PmpClient</a><a href="nat-api/Ssdp">Ssdp</a><a href="nat-api/UpnpClient">UpnpClient</a></div>

## 🤝 Interfaces

<div class="definition-grid interface"><a href="nat-api/Address">Address</a><a href="nat-api/GetMappingOptions">GetMappingOptions</a><a href="nat-api/MappingInfo">MappingInfo</a><a href="nat-api/PmpMapOptions">PmpMapOptions</a><a href="nat-api/UpnpMapOptions">UpnpMapOptions</a><a href="nat-api/UpnpUnmapOptions">UpnpUnmapOptions</a></div>

## 🏭 Functions

### createPmpClient

```ts
createPmpClient(gateway: string): Promise<PmpClient>
```
#### Parameters

- **gateway**: `string`
#### Return Type

- `Promise<PmpClient>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/pmp.ts#L26" target="_blank" rel="noreferrer">packages/nat-api/lib/pmp.ts:26</a>
</p>


### createSsdp

```ts
createSsdp(options: { sourcePort?: number }= {}): Promise<Ssdp>
```
#### Parameters

- **options**: `{ sourcePort?: number }`
#### Return Type

- `Promise<Ssdp>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/ssdp.ts#L14" target="_blank" rel="noreferrer">packages/nat-api/lib/ssdp.ts:14</a>
</p>


### createUpnpClient

```ts
createUpnpClient(): Promise<UpnpClient>
```
#### Return Type

- `Promise<UpnpClient>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/upnp.ts#L7" target="_blank" rel="noreferrer">packages/nat-api/lib/upnp.ts:7</a>
</p>



## 🏷️ Variables

### ERROR_GATEWAY_NOTFOUND <Badge type="tip" text="const" />

```ts
ERROR_GATEWAY_NOTFOUND: "GatewayNotFound" = 'GatewayNotFound'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/upnp.ts#L13" target="_blank" rel="noreferrer">packages/nat-api/lib/upnp.ts:13</a>
</p>



