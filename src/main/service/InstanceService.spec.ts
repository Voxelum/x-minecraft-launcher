import { join } from 'path';
import { LATEST_MC_RELEASE } from 'universal/utils/constant';
import InstanceService from './InstanceService';

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
            const id = await service.createInstance({ type: 'modpack' });
            expect(typeof id).toBe('string');
            expect(config.id).toBe(id);
            expect(config.author).toBe('username');
            expect(config.type).toBe('modpack');
            expect(config.java).toEqual(mocks.getters.defaultJava);
            expect(config.deployments).toBeTruthy();
            expect(config.version.minecraft).toEqual(LATEST_MC_RELEASE);
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
                type: 'modpack',
                image: 'lll',
                name: 'xxx',
                blur: 1,
                java: { path: 'x', version: 'y' },
                version: {
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
            expect(config.type).toBe('modpack');
            expect(config.java).toEqual({ path: 'x', version: 'y', majorVersion: 0 });
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
            const id = await service.createInstance({ type: 'modpack' });
            await service.selectInstance(id);
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
            await service.selectInstance('abc');
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
});
