const { resolve, join, basename } = require('path')
const fs = require('fs')
const TJS = require('typescript-json-schema')

/**
 * @type {TJS.PartialArgs}
 */
const settings = {
  defaultProps: true,
  required: true,
  noExtraProps: true,
}

/**
 * @type {TJS.CompilerOptions}
 */
const compilerOptions = {
  strictNullChecks: true,
  esModuleInterop: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  downlevelIteration: true,
}

const dir = resolve(__dirname, '..', 'src/entities')
const files = fs.readdirSync(dir).filter(f => f.endsWith('.schema.ts')).map(f => join(dir, f))
console.log('Generate json schema from these definition files:')
files.map(f => f.substring(0, f.length - 3).replace(/\\/g, '/')).forEach(f => console.log(f))

const program = TJS.getProgramFromFiles(files, compilerOptions)
const generator = TJS.buildGenerator(program, settings)
const symbols = generator.getSymbols().filter(s => s.name.endsWith('Schema') &&
  files.some(f => s.fullyQualifiedName.indexOf(f.substring(0, f.length - 6).replace(/\\/g, '/')) !== -1))
  .map(s => [s, files.find(f => s.fullyQualifiedName.indexOf(f.substring(0, f.length - 6).replace(/\\/g, '/')) !== -1)])

for (const [sym, file] of symbols) {
  const def = TJS.generateSchema(program, sym.name, { required: true })
  def.additionalProperties = false
  const dist = file.substring(0, file.length - basename(file).length) + sym.name + '.json'
  console.log(dist)
  fs.writeFileSync(dist, JSON.stringify(def, null, 4))
}
