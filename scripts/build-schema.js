const { resolve, join } = require('path');
const fs = require('fs');
const TJS = require('typescript-json-schema');

/**
 * @type {TJS.PartialArgs}
 */
const settings = {
    defaultProps: true,
    required: true,
    noExtraProps: true,
};

/**
 * @type {TJS.CompilerOptions}
 */
const compilerOptions = {
    strictNullChecks: true,
    esModuleInterop: true,
};

const dir = resolve(__dirname, '..', 'src/universal/store/modules');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.config.ts')).map(f => join(dir, f));
console.log('Generate json schema from these definition files:');
files.map(f => f.substring(0, f.length - 3).replace(/\\/g, '/')).forEach(f => console.log(f));

const program = TJS.getProgramFromFiles(files, compilerOptions);
const generator = TJS.buildGenerator(program, settings);
const symbols = generator.symbols.filter(s => s.name.endsWith('Config')
    && files.some(f => s.fullyQualifiedName.indexOf(f.substring(0, f.length - 5).replace(/\\/g, '/')) !== -1));

for (const sym of symbols) {
    const def = TJS.generateSchema(program, sym.name, { required: true });
    def.additionalProperties = false;
    fs.writeFileSync(resolve(__dirname, '..', 'src/main/utils/schema', `${sym.name}.json`), JSON.stringify(def, null, 4));
}
