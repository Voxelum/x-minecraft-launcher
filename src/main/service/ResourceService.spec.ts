import { join } from 'path';
import { Task } from '@xmcl/task';
import fs from '@xmcl/core/fs';
import ResourceService from 'main/service/ResourceService';
import { UNKNOWN_RESOURCE } from 'universal/store/modules/resource';

const mockRoot = join(__dirname, '..', '..', '..', 'mock');
const tempRoot = join(__dirname, '..', '..', '..', 'temp');

describe('ResourceService', () => {
    const taskRuntime = Task.createRuntime();
    const mocks = {
        commit: (type: string, payload: any) => {
        },
        state: {
            root: tempRoot,
        },
        getters: {
            getResource() { return UNKNOWN_RESOURCE; },
        },
        getPath(...p: string[]) { return join(tempRoot, ...p); },
        submit(task: Task<any>) {
            return taskRuntime.submit(task);
        },
    };
    const forgeJar = join(tempRoot, 'mods', 'Sound Filters-1.8-0.8_for_1,8.jar');
    const forgeJson = join(tempRoot, 'mods', 'Sound Filters-1.8-0.8_for_1,8.json');
    const liteMod = join(tempRoot, 'mods', 'ArmorsHUDRevived-1.12.r2-1.2.0-143.litemod');
    const liteJson = join(tempRoot, 'mods', 'ArmorsHUDRevived-1.12.r2-1.2.0-143.json');
    jest.setTimeout(10000000);
    beforeEach(async () => {
        if (await fs.exists(forgeJar)) {
            await fs.unlink(forgeJar);
            await fs.unlink(forgeJson);
        }
        if (await fs.exists(liteMod)) {
            await fs.unlink(liteMod);
            await fs.unlink(liteJson);
        }
    });
    describe('#importResource', () => {
        test('should import a forge mod resource', async () => {
            const service = new ResourceService();
            Object.entries(mocks).forEach(([k, v]) => Reflect.set(service, k, v));
            const srcPath = join(mockRoot, 'mods', 'sample-mod.jar');
            const r = await service.importUnknownResource({ path: srcPath });
            expect(r.path).toEqual(forgeJar);
            expect(r.source.file!.path).toEqual(srcPath);
            await expect(fs.exists(forgeJar))
                .resolves.toBe(true);
            await expect(fs.exists(forgeJson))
                .resolves.toBe(true);
            const o = await fs.readFile(forgeJson).then(b => JSON.parse(b.toString()));
            expect(o).toEqual(r);
        });
        test('should import a forge mod resource with forge hint', async () => {
            const service = new ResourceService();
            Object.entries(mocks).forEach(([k, v]) => Reflect.set(service, k, v));
            const r = await service.importUnknownResource({ path: join(mockRoot, 'mods', 'sample-mod.jar'), type: 'forge' });
            await expect(fs.exists(forgeJar))
                .resolves.toBe(true);
            await expect(fs.exists(forgeJson))
                .resolves.toBe(true);
            const o = await fs.readFile(forgeJson).then(b => JSON.parse(b.toString()));
            expect(o).toEqual(r);
        });
        test('should import a forge mod resource with mods hint', async () => {
            const service = new ResourceService();
            Object.entries(mocks).forEach(([k, v]) => Reflect.set(service, k, v));
            const r = await service.importUnknownResource({ path: join(mockRoot, 'mods', 'sample-mod.jar'), type: 'mods' });
            await expect(fs.exists(forgeJar))
                .resolves.toBe(true);
            await expect(fs.exists(forgeJson))
                .resolves.toBe(true);
            const o = await fs.readFile(forgeJson).then(b => JSON.parse(b.toString()));
            expect(o).toEqual(r);
        });
        test('should import a liteloader mod', async () => {
            const service = new ResourceService();
            Object.entries(mocks).forEach(([k, v]) => Reflect.set(service, k, v));
            const r = await service.importUnknownResource({ path: join(mockRoot, 'mods', 'sample-mod.litemod') });
            await expect(fs.exists(liteMod)).resolves.toBe(true);
            await expect(fs.exists(liteJson)).resolves.toBe(true);
            const o = await fs.readFile(liteJson).then(b => JSON.parse(b.toString()));
            expect(o).toEqual(r);
        });
    });
    describe('#removeResource', () => {
        test('should remove the resource', async () => {
            const service = new ResourceService();
            const rm = jest.fn();
            Object.entries({
                ...mocks,
                commit: rm,
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            const resource = await service.importUnknownResource({ path: join(mockRoot, 'mods', 'sample-mod.litemod') });
            await service.removeResource(resource);
            expect(rm).toHaveBeenCalledWith('resourceRemove', resource);
            await expect(fs.missing(liteMod)).resolves.toBe(true);
            await expect(fs.missing(liteJson)).resolves.toBe(true);
        });
    });
    describe('#renameResource', () => {
        test('should rename the resource', async () => {
            const service = new ResourceService();
            const fn = jest.fn();
            Object.entries({
                ...mocks,
                commit: fn,
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            const resource = await service.importUnknownResource({ path: join(mockRoot, 'mods', 'sample-mod.litemod') });
            const after = { ...resource };
            after.name = 'abc';
            await service.renameResource({ resource, name: 'abc' });
            expect(fn).toHaveBeenCalledWith('resource', { ...resource, name: 'abc' });
            await expect(fs.readFile(liteJson).then(f => JSON.parse(f.toString())))
                .resolves
                .toEqual(after);
        });
    });
    describe('#touchResource', () => {
        test('should do nothing if the file not changed', async () => {
            const service = new ResourceService();
            const fn = jest.fn();
            Object.entries({
                ...mocks,
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            const resource = await service.importUnknownResource({ path: join(mockRoot, 'mods', 'sample-mod.litemod') });
            Object.entries({
                ...mocks,
                fn,
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            await service.touchResource(resource);
            expect(fn).not.toBeCalled();
        });
        test('should re-import if the file changed', async () => {
            const service = new ResourceService();
            const fn = jest.fn();
            Object.entries({
                ...mocks,
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            const resource = await service.importUnknownResource({ path: join(mockRoot, 'mods', 'sample-mod.litemod') });
            const changed = { ...resource, hash: 'changed' };
            Object.entries({
                ...mocks,
                commit: fn,
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            await service.touchResource(changed);
            expect(fn).toBeCalled();
        });
    });
});
