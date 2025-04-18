import { createServer } from 'http'
import { Peers } from './multiplayerImpl'
import { basename } from 'path'
import { Transform } from 'stream'

export function createHosting(peers: Peers) {
  const server = createServer((req, res) => {
    const url = req.url ?? '/'
    if (url.startsWith('/files')) {
      // /files/<id>?path=<path>
      const fullUrl = new URL(url, 'http://localhost')
      const peerId = fullUrl.pathname.split('/')[2]
      const filePath = fullUrl.searchParams.get('path')
      if (!filePath) {
        res.writeHead(400)
        res.end()
        return
      }
      const filePathBuffer = Buffer.from(filePath, 'base64url')
      const filePathString = filePathBuffer.toString('utf-8')
      const peer = peers.get(peerId)
      if (!peer) {
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${basename(filePathString)}"`,
      })
      peer.stream(filePathString, res)
    } else {
      res.writeHead(404)
      res.end()
    }
  }).once('listening', () => {
    console.log('Peer server listening on port', (server.address() as any).port)
  })
  return server
}
