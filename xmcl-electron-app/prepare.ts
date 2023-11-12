import { existsSync, mkdirSync, writeFileSync } from 'fs'

if (!existsSync('./dist')) {
  mkdirSync('dist')
}

if (!existsSync('.env')) {
  writeFileSync('.env', 'CURSEFORGE_API_KEY=\n')
}
