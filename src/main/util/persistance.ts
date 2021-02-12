import { Logger } from '@main/manager/LogManager';
import { Schema } from '@universal/entities/schema';
import Ajv from 'ajv';
import { ensureFile, readFile, writeFile } from 'fs-extra';
import { createContext, runInContext } from 'vm';

export class JSONPersister<T> {
    constructor(
        readonly path: string,
        readonly schema: Schema<T>,
        readonly commit: () => void,
        readonly logger: Logger,
    ) { }

    async write(data: T) {
        const deepCopy = JSON.parse(JSON.stringify(data));
        const schemaObject = this.schema;
        const path = this.path;
        const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
        const validation = ajv.compile(schemaObject);
        const valid = validation(deepCopy);
        if (!valid) {
            const context = createContext({ object: deepCopy });
            if (validation.errors) {
                let message = `Error to persist to the disk path "${path}" with datatype ${typeof data}:\n`;
                validation.errors.forEach(e => {
                    message += `- ${e.keyword} error @[${e.dataPath}:${e.schemaPath}]: ${e.message}\n`;
                });
                const cmd = validation.errors.map(e => `delete object${e.dataPath};`);
                this.logger.log(message);
                this.logger.log(cmd.join('\n'));
                runInContext(cmd.join('\n'), context);
            }
        }
        await ensureFile(path);
        await writeFile(path, JSON.stringify(deepCopy, null, 4), { encoding: 'utf-8' });
    }

    async read(): Promise<T> {
        const { path, schema } = this;
        const originalString = await readFile(path).then(b => b.toString(), () => '{}');
        let object;
        try {
            object = JSON.parse(originalString);
        } catch (e) {
            object = {};
        }
        if (object) {
            const schemaObject = schema;
            const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
            const validation = ajv.compile(schemaObject);
            const valid = validation(object);
            if (!valid) {
                // this.warn('Try to remove those invalid keys. This might cause problem.');
                // this.warn(originalString);
                // const context = createContext({ object });
                // if (validation.errors) {
                //     // this.warn(`Found invalid config file on ${path}.`);
                //     // validation.errors.forEach(e => this.warn(e));
                //     const cmd = validation.errors.filter(e => e.dataPath).map(e => `delete object${e.dataPath};`);
                //     if (cmd.length !== 0) {
                //         // this.log(cmd.join('\n'));
                //         runInContext(cmd.join('\n'), context);
                //     }
                // }
            }
        }
        return object;
    }
}
