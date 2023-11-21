import { Server } from 'net'

export async function listen(server: Server, port: number, nextPort: (cur: number) => number) {
  for (; port <= 65535; port = nextPort(port)) {
    const listened = await new Promise<boolean>((resolve, reject) => {
      const handleError = (e: any) => {
        if (e.code === 'EADDRINUSE') {
          resolve(false)
        } else {
          // should panic
          reject(e)
        }
      }
      server.addListener('error', handleError)
      server.listen(port, () => {
        server.removeListener('error', handleError)
        resolve(true)
      })
    })

    if (listened) {
      break
    }
  }
  return port
}
