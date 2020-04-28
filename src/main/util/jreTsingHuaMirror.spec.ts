import { getTsingHuaMirror } from './jreTsingHuaMirror';

describe('#getTsingHuaMirror', () => {
    test('should get for win32', () => {
        expect(getTsingHuaMirror('windows', '32')).toEqual([
            'https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/jre/x32/windows/OpenJDK8U-jre_x86-32_windows_hotspot_8u242b08.zip',
            'https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/jre/x32/windows/OpenJDK8U-jre_x86-32_windows_hotspot_8u242b08.zip.sha256.txt',
        ]);
    });
    test('should get for win64', () => {
        expect(getTsingHuaMirror('windows', '64')).toEqual([
            'https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/jre/x64/windows/OpenJDK8U-jre_x64_windows_hotspot_8u242b08.zip',
            'https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/jre/x64/windows/OpenJDK8U-jre_x64_windows_hotspot_8u242b08.zip.sha256.txt',
        ]);
    });
    test('should get for linux 64', () => {
        expect(getTsingHuaMirror('linux', '64')).toEqual([
            'https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/jre/x64/system/OpenJDK8U-jre_x64_linux_hotspot_8u242b08.tar.gz.zip',
            'https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/jre/x64/system/OpenJDK8U-jre_x64_linux_hotspot_8u242b08.tar.gz.zip.sha256.txt',
        ]);
    });
    test('should get mac64', () => {
        expect(getTsingHuaMirror('mac', '64')).toEqual([
            'https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/jre/x64/mac/OpenJDK8U-jre_x64_mac_hotspot_8u242b08.tar.gz.zip',
            'https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/jre/x64/mac/OpenJDK8U-jre_x64_mac_hotspot_8u242b08.tar.gz.zip.sha256.txt',
        ]);
    });
    test('should throw for mac32 and linux 32', () => {
        expect(getTsingHuaMirror('mac', '32')).toThrow();
        expect(getTsingHuaMirror('linux', '32')).toThrow();
    });
});
