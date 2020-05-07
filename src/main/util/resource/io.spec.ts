/* eslint-disable import/first */
jest.mock('fs-extra');

import { ensureFile, unlink, writeFile } from 'fs-extra';
import { resolve } from 'path';
import { createResourceBuilder, getResourceFromBuilder } from '.';
import { commitResourceOnDisk, discardResourceOnDisk } from './io';

const mockedEnsureFile = ensureFile as unknown as jest.Mock<typeof ensureFile>;
const mockedUnlink = unlink as unknown as jest.Mock<typeof unlink>;
const mockedWriteFile = writeFile as unknown as jest.Mock<typeof writeFile>;


describe('#commitResourceOnDisk', () => {
    test('should commit the file to disk', async () => {
        let builder = createResourceBuilder();
        builder.source.date = 'DATE';
        builder.name = 'ModA';
        builder.ext = '.jar';
        builder.hash = 'd6c94fad4f7a03a8e46083c023926515fc0e551e';
        builder.icon = Buffer.from([]);
        await commitResourceOnDisk(builder, Buffer.from([]), '/test/root');
        expect(builder.path).toEqual(resolve('/test/root/ModA.d6c94f.jar'));
        expect(mockedEnsureFile).toBeCalledWith(resolve('/test/root/ModA.d6c94f.jar'));
        expect(mockedWriteFile).toBeCalledWith(resolve('/test/root/ModA.d6c94f.jar'), Buffer.from([]));
        expect(mockedWriteFile).toBeCalledWith(resolve('/test/root/ModA.d6c94f.json'), JSON.stringify(getResourceFromBuilder(builder), null, 4));
        expect(mockedWriteFile).toBeCalledWith(resolve('/test/root/ModA.d6c94f.png'), builder.icon);
    });
});

describe('#discardResourceOnDisk', () => {
    test('should discard resource', async () => {
        let builder = createResourceBuilder();
        builder.path = '/abc/real/mods/path.jar';
        builder.domain = 'mods';
        await discardResourceOnDisk(builder, '/test/root');
        expect(mockedUnlink).toBeCalledWith(resolve(builder.path));
        expect(mockedUnlink).toBeCalledWith(resolve('/abc/real/mods/path.json'));
        mockedUnlink.mockReturnValueOnce(Promise.resolve() as any);
        expect(mockedUnlink).toBeCalledWith(resolve('/abc/real/mods/path.png'));
    });
});
