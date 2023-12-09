import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

if (!existsSync(join(__dirname, 'dist'))) {
  mkdirSync(join(__dirname, 'dist'))
}

if (!existsSync(join(__dirname, '.env'))) {
  writeFileSync(join(__dirname, '.env'), 'CURSEFORGE_API_KEY=')
}
