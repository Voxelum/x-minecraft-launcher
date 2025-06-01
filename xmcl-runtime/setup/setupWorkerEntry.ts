import { spawn } from 'child_process'
import { setHandler } from '../worker/helper'
import { getDiskInfo } from 'node-disk-info'
import Drive from 'node-disk-info/dist/classes/drive'

setHandler({
  getDiskInfo: async () => {
    try {
      const infos = await getDiskInfo()
      return infos
    } catch (e) {
      if (process.platform === 'win32') {
        return new Promise<Drive[]>((resolve, reject) => {
          const child = spawn("powershell.exe", ["get-psdrive -psprovider filesystem | select-object name,used,free | ConvertTo-Json"]);
          child.stdout.on("data", function (data) {
            const res = JSON.parse(data, (k, v) => {
              if (k === 'Name') {
                return v + ":"
              }
              return v
            })
            if (res instanceof Array) {
              const transformed = res.map((d: any) => new Drive('NTFS', 0, d.Used, d.Free, d.Used + d.Free, d.Name));
              resolve(transformed)
            } else {
              resolve([])
            }
          });
          child.on("error", reject);
        }).catch(() => [])
      }
      throw e
    }
  }
})
