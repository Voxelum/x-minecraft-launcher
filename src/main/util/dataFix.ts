import { ResourceSchema } from '@universal/entities/resource.schema';
import { relative } from 'path';

export function fixResourceSchema(schema: ResourceSchema, dataRoot: string) {
    if ('path' in (schema as any)) {
        schema.location = relative(dataRoot, (schema as any).path);
    }
    if ('source' in (schema as any)) {
        const source = (schema as any).source;
        schema.uri = source.uri;
        schema.curseforge = source.uri;
        schema.github = source.github;
        schema.date = source.date;
    }
}
