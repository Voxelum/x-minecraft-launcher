import { upnpNat } from '@achingbrain/nat-port-mapper'
import { test } from 'vitest'

test.skip('test', async () => {
  const client = upnpNat()
  const gateway = await client.getGateway(new URL('http://192.168.1.1:49652/49652gatedesc.xml'))
  // Map public port 1000 to private port 1000 with TCP
  await gateway.map(25565, '192.168.1.2', {
    protocol: 'tcp',
  })

  // Unmap previously mapped private port 1000
  // await gateway.unmap(25565)

  // Get external IP
  const externalIp = await gateway.externalIp()

  console.log('External IP:', externalIp)

  // Unmap all mapped ports and cancel any in-flight network operations
  await gateway.stop()
})
