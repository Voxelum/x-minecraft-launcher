import { ResourceSchema } from '@universal/entities/resource.schema';
import { extname, relative } from 'path';

export function fixResourceSchema(schema: ResourceSchema, dataRoot: string) {
    if ('path' in (schema as any) && !schema.location) {
        const relativePath = relative(dataRoot, (schema as any).path);
        const ext = extname(relativePath);
        schema.location = relativePath.slice(0, relativePath.length - ext.length);
    }
    if ('source' in (schema as any)) {
        const source = (schema as any).source;
        schema.uri = source.uri;
        schema.curseforge = source.uri;
        schema.github = source.github;
        schema.date = source.date;
    }
}
