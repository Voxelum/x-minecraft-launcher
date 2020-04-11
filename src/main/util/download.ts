import { Task } from '@xmcl/task';
import { createHash } from 'crypto';
import got from 'got';
import { finished as fin } from 'stream';
import { promisify } from 'util';

const finished = promisify(fin);

export function cacheWithHash(url: string) {
    const download = Task.create('download', async (context: Task.Context) => {
        const buffers: Buffer[] = [];
        const hasher = createHash('sha1');
        const urls: string[] = [];
        const stream = got.stream(url, {
            followRedirect: true,
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36',
            },
        });

        context.pausealbe(stream.pause, stream.resume);

        stream.on('data', (b) => {
            buffers.push(b);
            hasher.update(b);
        });
        stream.on('downloadProgress', (p) => {
            context.update(p.transferred, p.total || undefined);
        });
        stream.on('redirect', (m) => {
            if (m.url) {
                urls.push(m.url);
            }
        });
        await finished(stream);

        return {
            buffer: Buffer.concat(buffers),
            hash: hasher.digest('hex'),
            urls,
        };
    });
    return download;
}
