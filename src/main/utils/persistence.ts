
import Ajv from 'ajv';
import { createContext, runInContext } from 'vm';
import Schema from 'universal/store/Schema';
import { writeFile, ensureFile, readFile } from 'fs-extra';

export async function setPersistence<T>({ path, data, schema }: { path: string; data: T; schema?: Schema<T> }) {
    const deepCopy = JSON.parse(JSON.stringify(data));
    if (schema) {
        const schemaObject = schema;
        const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
        const validation = ajv.compile(schemaObject);
        const valid = validation(deepCopy);
        if (!valid) {
            const context = createContext({ object: deepCopy });
            if (validation.errors) {
                validation.errors.forEach(e => console.warn(e));
                const cmd = validation.errors.map(e => `delete object${e.dataPath};`);
                console.log(cmd.join('\n'));
                runInContext(cmd.join('\n'), context);
            }
        }
    }
    await ensureFile(path);
    await writeFile(path, JSON.stringify(deepCopy, null, 4), { encoding: 'utf-8' });
}

export async function getPersistence<T>(option: { path: string; schema?: Schema<T> }): Promise<T> {
    const { path, schema } = option;
    const originalString = await readFile(path).then(b => b.toString(), () => '{}');
    const object = JSON.parse(originalString);
    if (object && schema) {
        const schemaObject = schema;
        const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
        const validation = ajv.compile(schemaObject);
        const valid = validation(object);
        if (!valid) {
            // console.warn('Try to remove those invalid keys. This might cause problem.');
            // console.warn(originalString);
            const context = createContext({ object });
            if (validation.errors) {
                // console.warn(`Found invalid config file on ${path}.`);
                // validation.errors.forEach(e => console.warn(e));
                const cmd = validation.errors.filter(e => e.dataPath).map(e => `delete object${e.dataPath};`);
                if (cmd.length !== 0) {
                    // console.log(cmd.join('\n'));
                    runInContext(cmd.join('\n'), context);
                }
            }
        }
    }

    return object;
}
