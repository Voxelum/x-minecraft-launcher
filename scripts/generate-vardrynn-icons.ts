/** Native encodings of the approved mark. Run on macOS: pnpm exec tsx scripts/generate-vardrynn-icons.ts */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

if (process.platform !== 'darwin') throw new Error('Icon generation requires macOS sips and iconutil')
const root = resolve(__dirname, '..')
const source = join(root, 'xmcl-keystone-ui/src/assets/vardrynn-mark.png')
const icons = join(root, 'xmcl-electron-app/icons')
const temporary = mkdtempSync(join(tmpdir(), 'vardrynn-icons-'))

function resize(destination: string, width: number, height = width) {
  mkdirSync(dirname(destination), { recursive: true })
  const scaled = join(temporary, 'scaled.png')
  const size = Math.min(width, height)
  execFileSync('sips', ['-z', String(size), String(size), source, '--out', scaled], { stdio: 'ignore' })
  // Wide and large Windows tiles keep the mark's aspect ratio and transparent padding.
  execFileSync('sips', ['--padToHeightWidth', String(height), String(width), scaled, '--out', destination], { stdio: 'ignore' })
}

try {
  // Use Windows' declared tile sizes, rather than inheriting distorted source dimensions.
  for (const file of readdirSync(icons).filter(f => f.includes('@') && f.endsWith('.png'))) {
    const target = file.match(/targetsize-(\d+)/)
    const scale = Number(file.match(/scale-(\d+)/)?.[1] ?? 100) / 100
    const [width, height] = target ? [Number(target[1]), Number(target[1])]
      : file.includes('Wide310x150') ? [310 * scale, 150 * scale]
        : file.includes('LargeTile') ? [310 * scale, 310 * scale]
          : file.includes('SmallTile') ? [71 * scale, 71 * scale]
            : file.includes('Square150') ? [150 * scale, 150 * scale]
              : file.includes('Square44') ? [44 * scale, 44 * scale]
                : file.includes('StoreLogo') ? [50 * scale, 50 * scale]
                  : file.includes('tray') ? [32, 32] : [256, 256]
    resize(join(icons, file), width, height)
  }
  resize(join(icons, 'vardrynn.png'), 1024)
  resize(join(icons, 'vardrynn-tray.png'), 40)
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
    resize(join(icons, 'linux', `${size}x${size}.png`), size)
  }

  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const header = Buffer.alloc(6 + sizes.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  const frames = sizes.map((size, index) => {
    const png = readFileSync(join(icons, 'linux', `${size}x${size}.png`))
    const entry = 6 + index * 16
    header[entry] = header[entry + 1] = size === 256 ? 0 : size
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
    return png
  })
  writeFileSync(join(icons, 'vardrynn.ico'), Buffer.concat([header, ...frames]))

  const iconset = join(temporary, 'vardrynn.iconset')
  for (const size of [16, 32, 128, 256, 512]) {
    resize(join(iconset, `icon_${size}x${size}.png`), size)
    resize(join(iconset, `icon_${size}x${size}@2x.png`), size * 2)
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(icons, 'vardrynn.icns')])
  // Compatibility filenames for downstream consumers; every encoding uses Vardrynn artwork.
  for (const theme of ['dark', 'light']) {
    copyFileSync(join(icons, 'vardrynn.ico'), join(icons, `${theme}.ico`))
    copyFileSync(join(icons, 'vardrynn.icns'), join(icons, `${theme}.icns`))
  }
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
