import { build, BuildOptions } from 'esbuild'
import { dependencies } from '../package.json'

async function buildAll() {
  const baseFormat: BuildOptions = {
    entryPoints: ['../index.ts'],
    bundle: true,
    platform: 'node',
    target: 'es2020',
    external: Object.keys(dependencies),
  }
  await build({
    ...baseFormat,
    format: 'cjs',
    outfile: '../dist/index.js',
  })
  await build({
    ...baseFormat,
    format: 'esm',
    outfile: '../dist/index.mjs',
  })
}

buildAll()
