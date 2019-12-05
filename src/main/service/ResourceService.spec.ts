import ResourceService from "./ResourceService";
import { join } from 'path';
import { Task } from "@xmcl/minecraft-launcher-core";
import { fs } from "main/utils";

const mockRoot = join(__dirname, "..", "..", "..", "mock");
const tempRoot = join(__dirname, "..", "..", "..", "temp");

describe('ResourceService', () => {
    const taskRuntime = Task.createRuntime();
    const mocks = {
        commit: (type: string, payload: any) => {
        },
        state: {
            root: tempRoot,
        },
        getters: {
            getResource() { return undefined; },
        },
        getPath(...p: string[]) { return join(tempRoot, ...p); },
        submit(task: Task<any>) {
            return taskRuntime.submit(task).wait();
        }
    }
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
    })
    describe('#importResource', () => {
        test('should import a forge mod resource', async () => {
            const service = new ResourceService();
            Object.entries(mocks).forEach(([k, v]) => Reflect.set(service, k, v));
            await service.importResource({ path: join(mockRoot, 'mods', 'sample-mod.jar') });
            await expect(fs.exists(forgeJar))
                .resolves.toBe(true);
            await expect(fs.exists(forgeJson))
                .resolves.toBe(true);
        });
        test('should import a forge mod resource with forge hint', async () => {
            const service = new ResourceService();
            Object.entries(mocks).forEach(([k, v]) => Reflect.set(service, k, v));
            await service.importResource({ path: join(mockRoot, 'mods', 'sample-mod.jar'), type: 'forge' });
            await expect(fs.exists(forgeJar))
                .resolves.toBe(true);
            await expect(fs.exists(forgeJson))
                .resolves.toBe(true);
        });
        test('should import a forge mod resource with mods hint', async () => {
            const service = new ResourceService();
            Object.entries(mocks).forEach(([k, v]) => Reflect.set(service, k, v));
            await service.importResource({ path: join(mockRoot, 'mods', 'sample-mod.jar'), type: 'mods' });
            await expect(fs.exists(forgeJar))
                .resolves.toBe(true);
            await expect(fs.exists(forgeJson))
                .resolves.toBe(true);
        });
        test('should import a liteloader mod', async () => {
            const service = new ResourceService();
            Object.entries(mocks).forEach(([k, v]) => Reflect.set(service, k, v));
            await service.importResource({ path: join(mockRoot, 'mods', 'sample-mod.litemod') });
            await expect(fs.exists(liteMod)).resolves.toBe(true);
            await expect(fs.exists(liteJson)).resolves.toBe(true);
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
            const resource = await service.importResource({ path: join(mockRoot, 'mods', 'sample-mod.litemod') });
            await service.removeResource(resource);
            expect(rm).toHaveBeenCalledWith('removeResource', resource);
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
            const resource = await service.importResource({ path: join(mockRoot, 'mods', 'sample-mod.litemod') });
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
            const resource = await service.importResource({ path: join(mockRoot, 'mods', 'sample-mod.litemod') });
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
            const resource = await service.importResource({ path: join(mockRoot, 'mods', 'sample-mod.litemod') });
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