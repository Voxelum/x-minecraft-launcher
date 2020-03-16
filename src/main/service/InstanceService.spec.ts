import release from '@universal/util/lasteRelease.json';
import { Task } from '@xmcl/task';
import { existsSync } from 'fs';
import { join } from 'path';
import InstanceService from './InstanceService';
import ResourceService from './ResourceService';

const mockRoot = join(__dirname, '..', '..', '..', 'mock');
const tempRoot = join(__dirname, '..', '..', '..', 'temp');

describe('InstanceService', () => {
    const mocks = {
        state: {
            profile: {
                id: '',
                all: [],
            },
        },
        getters: {
            defaultJava: { path: 'path/to/java', version: '', majorVersion: 0 },
            minecraftRelease: { id: '1.14' },
            selectedGameProfile: { name: 'username' },
        },
        commit() {

        },
        getPath(...p: string[]) { return join(tempRoot, ...p); },
    };
    describe('#createInstance', () => {
        test('should create a instance', async () => {
            const service = new InstanceService();
            let config: any;
            Object.entries({
                ...mocks,
                commit: (type: string, payload: any) => {
                    expect(typeof type === 'string').toBe(true);
                    config = payload;
                },
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            const id = await service.createInstance({});
            expect(typeof id).toBe('string');
            expect(config.id).toBe(id);
            expect(config.author).toBe('username');
            expect(config.java).toEqual(mocks.getters.defaultJava);
            expect(config.deployments).toBeTruthy();
            expect(config.version.minecraft).toEqual(release.id);
            expect(config.blur).toEqual(4);
            expect(config.image).toEqual('');
        });
        test('should create a instance by option', async () => {
            const service = new InstanceService();
            let config: any;
            Object.entries({
                ...mocks,
                commit: (type: string, payload: any) => {
                    expect(typeof type === 'string').toBe(true);
                    config = payload;
                },
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            const id = await service.createInstance({
                author: 'ooo',
                image: 'lll',
                name: 'xxx',
                blur: 1,
                java: '8',
                runtime: {
                    minecraft: '11',
                    forge: '22',
                    liteloader: '33',
                    other: '44',
                },
                deployments: { mods: ['abc'] },
            });
            expect(typeof id).toBe('string');
            expect(config.name).toBe('xxx');
            expect(config.id).toBe(id);
            expect(config.author).toBe('ooo');
            expect(config.java).toEqual('8');
            expect(config.deployments).toEqual({ mods: ['abc'] });
            expect(config.version).toEqual({
                minecraft: '11',
                forge: '22',
                liteloader: '33',
            });
            expect(config.blur).toEqual(1);
            expect(config.image).toEqual('lll');
        });
    });
    describe('#selectInstance', () => {
        test('should select the instance', async () => {
            const service = new InstanceService();
            const cm = jest.fn();
            Object.entries({
                ...mocks,
                commit: cm,
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            const id = await service.createInstance({});
            await service.mountInstance(id);
            expect(cm).toBeCalledWith('selectProfile', id);
        });
        test('should not select the instance if the id is the same', async () => {
            const service = new InstanceService();
            const cm = jest.fn();
            Object.entries({
                ...mocks,
                commit: cm,
                state: { profile: { id: 'abc' } },
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            await service.mountInstance('abc');
            expect(cm).not.toBeCalled();
        });
    });
    describe('#deleteInstance', () => {
        test('should delete the instance', async () => {
            const service = new InstanceService();
            const cm = jest.fn();
            Object.entries({
                ...mocks,
                commit: cm,
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            await service.deleteInstance('id');
            expect(cm).toBeCalledWith('removeProfile', 'id');
        });
        test('should delete the instance and create a new if current is selcted', async () => {
            const service = new InstanceService();
            const cm = jest.fn();
            const select = jest.fn();
            Object.entries({
                ...mocks,
                commit: cm,
                state: {
                    profile: {
                        id: 'cur',
                        all: {
                            cur: { id: 'cur' },
                            s: { id: 's' },
                        },
                    },
                },
                selectInstance: async (a: any) => select(a),
            }).forEach(([k, v]) => Reflect.set(service, k, v));
            await service.deleteInstance('cur');
            expect(select).toBeCalledWith('s');
            expect(cm).toBeCalledWith('removeProfile', 'cur');
        });
    });
    describe('#importCurseforgeModpack', () => {
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
        test('should be able to import a curseforge project from zip', async () => {
            const seriv = new InstanceService();
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

            await seriv.importInstanceFromCurseforgeModpack({ instanceId: 'a', path: join(mockRoot, 'modpack.zip') });
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
            expect(existsSync(join(tempRoot, 'profiles', 'a', 'config', 'bwncr-common.toml'))).toBeTruthy();
            expect(existsSync(join(tempRoot, 'profiles', 'a', 'config', 'biomesoplenty', 'server.toml'))).toBeTruthy();
        });
    });
});
