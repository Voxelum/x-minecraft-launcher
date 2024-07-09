import { createServer } from 'http'
import { Peers } from './multiplayerImpl'
import { basename } from 'path'

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
      const peer = peers.get(peerId)
      if (!peer) {
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${basename(filePath)}"`,
      })
      peer.stream(filePath, res)
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  return server
}
