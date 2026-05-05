import { assert, test } from 'vitest'
import { createUpnpClient } from './upnp'

test.skip('upnp', async () => {
  const client = await createUpnpClient()
  await client.unmap({ protocol: 'tcp', public: 25565 })

  let mappings = await client.getMappings()

  // const gateway = await client.findGateway()

  // assert.ok(mappings)
  await client.map({
    protocol: 'tcp',
    private: 25565,
    public: 25565,
    ttl: 60 * 1000,
    description: 'x',
  })

  mappings = await client.getMappings()
  const ip = await client.externalIp()

  console.log(mappings)
  console.log('External IP:', ip)
  // assert.ok(mappings.find(m => m.description === 'minecraft'))
  client.destroy()
})

test.skip('upnp - external ip', async () => {
  const client = await createUpnpClient()
  const ip = await client.externalIp()
  assert.ok(ip)
  client.destroy()
})
