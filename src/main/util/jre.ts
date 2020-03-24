
export function getTsingHuaMirror(system: 'linux' | 'mac' | 'windows', arch: '32' | '64'): string[] {
    let url = `https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/jre/x${arch}/${system}/`;
    if (arch === '32') {
        if (system === 'windows') {
            return ['OpenJDK8U-jre_x86-32_windows_hotspot_8u242b08.zip',
                'OpenJDK8U-jre_x86-32_windows_hotspot_8u242b08.zip.sha256.txt'].map(v => url + v);
        }
        throw new Error();
    } else {
        if (system === 'linux') {
            return ['OpenJDK8U-jre_x64_linux_hotspot_8u242b08.tar.gz',
                'OpenJDK8U-jre_x64_linux_hotspot_8u242b08.tar.gz.sha256.txt'].map(v => url + v);
        } if (system === 'mac') {
            return ['OpenJDK8U-jre_x64_mac_hotspot_8u242b08.tar.gz',
                'OpenJDK8U-jre_x64_mac_hotspot_8u242b08.tar.gz.sha256.txt'].map(v => url + v);
        }
        return ['OpenJDK8U-jre_x64_windows_hotspot_8u242b08.zip',
            'OpenJDK8U-jre_x64_windows_hotspot_8u242b08.zip.sha256.txt'].map(v => url + v);
    }
}
