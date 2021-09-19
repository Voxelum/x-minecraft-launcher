const chalk = require('chalk')
const { build: electronBuilder } = require('electron-builder')
const { build: esbuild } = require('esbuild')
const fsExtra = require('fs-extra')
const path = require('path')
const { build } = require('vite')
const esbuildConfig = require('./esbuild.config')
const config = require('./vite.config')
const { createHash } = require('crypto')
const { existsSync, createReadStream, createWriteStream } = require('fs')
const { promisify } = require('util')
const { pipeline } = require('stream')

const { remove, stat } = fsExtra

process.env.NODE_ENV = 'production'

/**
 * @param {string} algorithm The hash algorithm
 * @param {string} path path of the file
 * @param {string} destination
 * @returns Hash string
 */
async function writeHash(algorithm, path, destination) {
  let hash = createHash(algorithm).setEncoding("hex");
  await promisify(pipeline)(createReadStream(path), hash, createWriteStream(destination));
}

async function generatePackageJson() {
  const original = require('../package.json')
  const result = {
    name: original.name,
    author: original.author,
    version: original.version,
    license: original.license,
    description: original.description,
    main: './index.js',
    dependencies: Object.entries(original.dependencies).filter(([name, version]) => original.external.indexOf(name) !== -1).reduce((object, entry) => ({ ...object, [entry[0]]: entry[1] }), {})
  }
  await fsExtra.writeFile('dist/package.json', JSON.stringify(result))
}
/**
 * Use esbuild to build main process
 * @param {import('esbuild').BuildOptions} options
 */
async function buildMain(options) {
  const result = await esbuild({
    ...options,
    entryPoints: [path.join(__dirname, '../src/main/index.ts')]
  })

  if (!result.metafile) {
    throw new Error('Unexpected rollup config to build!')
  }

  /**
   * Print the esbuild output
 * @param {import('esbuild').Metafile} options
   */
  async function printOutput(options) {
    for (const [file, chunk] of Object.entries(options.outputs)) {
      console.log(
        `${chalk.gray('[write]')} ${chalk.cyan(file)}  ${(
          chunk.bytes / 1024
        ).toFixed(2)}kb`
      )
    }
  }
  if (result.metafile) {
    await printOutput(result.metafile)
  }
}

/**
 * Use vite to build renderer process
 */
function buildRenderer() {
  console.log(chalk.bold.underline('Build renderer process'))

  return build({
    ...config,
    mode: process.env.NODE_ENV
  })
}

/**
 * Use electron builder to build your app to installer, zip, or etc.
 *
 * @param {import('electron-builder').Configuration} config The electron builder config
 * @param {boolean} dir Use dir mode to build
 */
async function buildElectron(config, dir) {
  console.log(chalk.bold.underline('Build electron'))
  const start = Date.now()
  const files = await electronBuilder({ publish: 'never', config, dir })

  for (const file of files) {
    const fstat = await stat(file)
    console.log(
      `${chalk.gray('[write]')} ${chalk.yellow(file)} ${(
        fstat.size /
        1024 /
        1024
      ).toFixed(2)}mb`
    )
  }

  for (const file of files) {
    const fstat = await stat(file)
    if (!file.endsWith('.blockmap')) {
      await writeHash('sha256', file, `${file}.sha256`);
      await writeHash('sha1', file, `${file}.sha1`);
    }
  }

  if (existsSync('build/win-unpacked/resources/app.asar')) {
    await writeHash('sha256', 'build/win-unpacked/resources/app.asar', `build/win-unpacked/resources/app.asar.sha256`);
  }

  console.log(
    `Build completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`
  )
}

async function start() {
  /**
   * Load electron-builder Configuration
   */
  function loadElectronBuilderConfig() {
    switch (process.env.BUILD_TARGET) {
      case 'production':
        return require('./build.config')
      default:
        return require('./build.lite.config')
    }
  }

  await remove(path.join(__dirname, '../dist'))

  console.log(chalk.bold.underline('Build main process & preload'))
  const startTime = Date.now()
  await buildMain(esbuildConfig)
  console.log(
    `Build completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s.\n`
  )
  await buildRenderer()

  console.log()
  if (process.env.BUILD_TARGET) {
    const config = loadElectronBuilderConfig()
    const dir = process.env.BUILD_TARGET === 'dir'
    await generatePackageJson()
    await buildElectron(config, dir)
  }
}

start().catch((e) => {
  console.error(chalk.red(e.toString()))
  process.exit(1)
})
