import Service from '@main/service/Service';
import ExternalAuthSkinService from '@main/service/ExternalAuthSkinService';

function mockSerivce(service: Service) {
    // Reflect.set(service, )
}

describe.skip('AuthLibService', () => {
    describe('#doesAuthlibInjectionExisted', () => {
        test('should return false if not existed', async () => {
            const seriv = new ExternalAuthSkinService();
            mockSerivce(seriv);
            expect(seriv.doesAuthlibInjectionExisted())
                .toBeFalsy();
        });
        test('should return true if existed', async () => {
            const seriv = new ExternalAuthSkinService();
            mockSerivce(seriv);
            expect(seriv.doesAuthlibInjectionExisted())
                .toBeTruthy();
        });
    });
});
