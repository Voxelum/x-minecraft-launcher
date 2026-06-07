import { spawn } from 'child_process'
import { setHandler } from '@xmcl/worker/helper'
import { getDiskInfo } from 'node-disk-info'
import Drive from 'node-disk-info/dist/classes/drive'
import { getSerializedError } from '~/infra/errors/error_serialize'

setHandler({
  getDiskInfo: async () => {
    try {
      const infos = await getDiskInfo()
      return infos
    } catch (e) {
      if (process.platform === 'win32') {
        return new Promise<Drive[]>((resolve, reject) => {
          const child = spawn("powershell.exe", ["get-psdrive -psprovider filesystem | select-object name,used,free | ConvertTo-Json"]);
          // `stdout.on('data')` chunks at the pipe buffer (~8 KB on Windows),
          // so JSON longer than one chunk arrives in multiple events. Calling
          // `JSON.parse` on each chunk yields `SyntaxError: Expected ',' or
          // '}' after property value in JSON at position N` (issue #1469 —
          // 119 users in 0.56.4). Buffer until `end`, then parse once.
          const chunks: Buffer[] = []
          child.stdout.on("data", function (data: Buffer | string) {
            chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data))
          });
          child.stdout.on("end", function () {
            const body = Buffer.concat(chunks).toString('utf-8').trim()
            if (!body) {
              resolve([])
              return
            }
            try {
              const res = JSON.parse(body, (k, v) => {
                if (k === 'Name') {
                  return v + ":"
                }
                return v
              })
              if (res instanceof Array) {
                const transformed = res.map((d: any) => new Drive('NTFS', 0, d.Used, d.Free, d.Used + d.Free, d.Name));
                resolve(transformed)
              } else if (res && typeof res === 'object') {
                // ConvertTo-Json collapses a single-element array to one
                // object. Wrap so the consumer sees a uniform list.
                resolve([new Drive('NTFS', 0, res.Used, res.Free, res.Used + res.Free, res.Name)])
              } else {
                resolve([])
              }
            } catch {
              resolve([])
            }
          });
          child.on("error", reject);
        }).catch(() => [])
      }
      throw e
    }
  }
}, getSerializedError)
