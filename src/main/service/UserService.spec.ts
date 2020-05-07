/* eslint-disable import/first */
jest.mock('@xmcl/user');

import { checkLocation, login, offline } from '@xmcl/user';
import UserService from './UserService';


describe('UserService', () => {
    function mockService(state: any, getters: any, fn: (type: string, payload: any) => void) {
        let service = new UserService();
        Object.assign(service, {
            state,
            getters: {
                ...getters,
                isBusy: () => false,
            },
            commit: (type: any, payload: any) => {
                if (type === 'aquire' || type === 'release') return;
                fn(type, payload);
            },
        });
        return service;
    }

    describe('#login', () => {
        let mockedLogin = login as unknown as jest.MockedFunction<typeof login>;
        let mockedOffline = offline as unknown as jest.MockedFunction<typeof offline>;

        test('should', async () => {
            let mockResult = {
                user: { id: 'resultId', username: 'resultName' },
                accessToken: 'newAccessToken',
                clientToken: 'clientToken',
                availableProfiles: [],
                selectedProfile: { id: '', name: '' },
            };
            let mockInput = {
                username: 'ci010',
                password: 'password',
                authService: 'offline',
                profileService: 'mojang',
            };
            mockedOffline.mockReturnValue(mockResult);
            let fn = jest.fn();
            let serivce = mockService({
                user: {
                    clientToken: 'clientToken',
                    authServices: {
                        mojang: {},
                    },
                },
            }, {
                accessTokenValid: false,
                user: {
                    username: 'ci010',
                    profileService: 'mojang',
                    authService: 'mojang',
                    id: 'userId',
                },
            }, fn);
            await serivce.login(mockInput);
            expect(fn).toBeCalledTimes(2);
            expect(fn).toBeCalledWith('userProfileAdd', {
                id: mockResult.user.id,
                username: mockInput.username,
                profileService: mockInput.profileService,
                authService: mockInput.authService,
                accessToken: mockResult.accessToken,
                profiles: mockResult.availableProfiles,
            });
            expect(fn).toBeCalledWith('userGameProfileSelect', {
                profileId: mockResult.selectedProfile.id,
                userId: mockResult.user.id,
            });
        });
        test('should update offline profile if username is the same', async () => {
            let mockResult = {
                user: { id: 'resultId', username: 'resultName' },
                accessToken: 'newAccessToken',
                clientToken: 'clientToken',
                availableProfiles: [],
                selectedProfile: { id: '', name: '' },
            };
            let mockInput = {
                username: 'ci010',
                password: 'password',
                authService: 'offline',
                profileService: 'mojang',
            };
            mockedOffline.mockReturnValue(mockResult);
            let fn = jest.fn();
            let serivce = mockService({
                user: {
                    clientToken: 'clientToken',
                    authServices: {
                        mojang: {},
                    },
                },
            }, {
                accessTokenValid: false,
                user: {
                    username: 'ci010',
                    profileService: 'mojang',
                    authService: 'offline',
                    id: 'userId',
                },
            }, fn);
            await serivce.login(mockInput);
            expect(fn).toBeCalledTimes(1);
            expect(fn).toBeCalledWith('userProfileUpdate', {
                id: 'userId',
                accessToken: mockResult.accessToken,
                profiles: mockResult.availableProfiles,
            });
        });
    });
    describe('#checkLocation', () => {
        let mocked = checkLocation as unknown as jest.MockedFunction<typeof checkLocation>;
        test('should not check if the accessToken is not valid', async () => {
            let fn = jest.fn();
            let serivce = mockService({}, {
                accessTokenValid: false,
                user: {
                    authService: 'mojang',
                    accessToken: 'token',
                },
            }, fn);
            let result = await serivce.checkLocation();
            expect(result).toBe(true);
            expect(fn).toBeCalledTimes(0);
        });
        test('should not check if the auth not mojang', async () => {
            let fn = jest.fn();
            let serivce = mockService({}, {
                accessTokenValid: true,
                user: {
                    authService: 'mojangss',
                    accessToken: 'token',
                },
            }, fn);
            let result = await serivce.checkLocation();
            expect(result).toBe(true);
            expect(fn).toBeCalledTimes(0);
        });
        test('should check during mojang service', async () => {
            let fn = jest.fn();
            mocked.mockReturnValueOnce(Promise.resolve(true));
            let serivce = mockService({}, {
                accessTokenValid: true,
                user: {
                    authService: 'mojang',
                    accessToken: 'token',
                },
            }, fn);
            let result = await serivce.checkLocation();
            expect(result).toBe(true);
            expect(fn).toBeCalledWith('userSecurity', true);
        });
    });
});
