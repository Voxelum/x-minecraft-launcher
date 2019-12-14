import { Task } from '@xmcl/minecraft-launcher-core';
import { fs } from 'main/utils';
import { join } from 'path';
import CurseForgeService from './CurseForgeService';
import ResourceService from './ResourceService';

const mockRoot = join(__dirname, '..', '..', '..', 'mock');
const tempRoot = join(__dirname, '..', '..', '..', 'temp');

describe('CurseforgeService', () => {
    const runtime = Task.createRuntime();
    const mocks = {
        state: { root: tempRoot },
        getters: {
            queryResource() { return undefined; },
            getResource() { return undefined; },
        },
        commit(t: any) { },
        getPath(...p: string[]) { return join(tempRoot, ...p); },
        instanceService: { editInstance() { } },
        submit(t: any) { return runtime.submit(t); },
    };
    jest.setTimeout(1000000000);
    describe('importCurseforgeModpack', () => {
        test('should be able to import a curseforge project from zip', async () => {
            const seriv = new CurseForgeService();
            const resSeriv = new ResourceService();
            const commitFn = jest.fn();
            const editFn = jest.fn();
            mocks.commit = (type: any) => {
                expect(type).toEqual('resource');
                commitFn();
            };
            mocks.instanceService.editInstance = editFn;
            Object.entries({
                ...mocks,
            }).forEach(([k, v]) => Reflect.set(resSeriv, k, v));
            Object.entries({
                ...mocks,
                resourceService: resSeriv,
            }).forEach(([k, v]) => Reflect.set(seriv, k, v));

            await seriv.importCurseforgeModpack({ profile: 'a', path: join(mockRoot, 'modpack.zip') });
            expect(commitFn).toBeCalledTimes(6);
            expect(editFn).toBeCalledWith({
                author: 'ramoddi',
                name: 'Slightly Vanilla',
                deployments: {
                    mods: [
                        'resource/e6c5df3da83d1c6bcd0d8e1299a803f27a358e57',
                        'resource/d7f0f0e52c55ba0e80b6e6f4d2a4ca4d79309283',
                        'resource/35c96f4a8dc20041f2a1637c83a83714b4b8d718',
                        'resource/e52a918311bf72760156d1462ed93e4e8b97c00a',
                    ],
                },
                version: {
                    forge: '28.1.99',
                    liteloader: '',
                    minecraft: '1.14.4',
                },
            });
            await expect(fs.exists(join(tempRoot, 'profiles', 'a', 'config', 'bwncr-common.toml')))
                .resolves.toBeTruthy();
            await expect(fs.exists(join(tempRoot, 'profiles', 'a', 'config', 'biomesoplenty', 'server.toml')))
                .resolves.toBeTruthy();
        });
    });
});
