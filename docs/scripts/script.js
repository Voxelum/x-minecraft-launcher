i18next.init({
    lng: navigator.language,
    resources: { en, zh, zh_CN: zh, en_US: en },
}, function (err, t) {
    jqueryI18next.init(i18next, $);
    $('.section').localize();
    $('.bar').localize();
});

$(document).ready(function () {
    $('body').pagepiling({
        // onLeave: function (index, nextIndex, direction) {
        // },
    });
});
$('.menu .item').tab();
$('.dropdown').dropdown();

$('#languages').dropdown({
    onChange: function (src, _, elem) {
        i18next.changeLanguage(elem.attr('value'), (err, r) => {
            $('.section').localize();
            $('.bar').localize();
        })
    }
});

$('#source').dropdown({
    onChange: function (src, _, elem) {
        downloadSource = elem.attr('value');
    }
})

/**
 * @type {'azure' | 'github' | 'auto'}
 */
let downloadSource = 'auto';

$('#downloadFor').attr('data-i18n', `downloadFor.${platform.os}`);

function inGFW() {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(false);
        img.onerror = () => resolve(false);

        img.src = "https://www.google.com";

        setTimeout(() => {
            resolve(true);
        }, 1500);
    })
}

const isInGFW = inGFW();

function getFileUrl(name, fallback) {
    return isInGFW.then((inside) => {
        if (inside) {
            return `https://xmcl-release.azureedge.net/releases/${name}`;
        } else {
            return fallback;
        }
    }).catch(() => {
        console.log(e);
        return fallback;
    });
}

function initGithubInfo() {
    let releases
    function handleReleases(inReleases) {
        releases = inReleases;
        const latest = releases[0];
        $('#version').text(latest.tag_name);
        if (latest.prerelease) {
            $('#prerelease').css('visibility', 'visible');
        } else {
            $('#prerelease').css('visibility', 'hidden');
        }

        switch (platform.os.family) {
            case 'Windows':
                $('[win]').clone().appendTo('[main]');
                break;
            case 'OS X':
                $('[mac]').clone().appendTo('[main]');
                break;
            case 'Ubuntu':
            case 'Debian':
            case 'SuSE':
            case 'Fedora':
            case 'Red Hat':
                $('[linux]').clone().appendTo('[main]');
                break;
        }
        function setupHref(elem, find) {
            const found = latest.assets.find(find);
            if (!found) {
                $(elem).addClass('disabled');
            } else {
                $(elem).click((event) => {
                    $(elem).addClass('loading');
                    if (downloadSource === 'auto') {
                        getFileUrl(found.name, found.browser_download_url).then((url) => {
                            $(elem).attr('href', url);
                            $(elem).removeClass('loading');
                        })
                    } else if (downloadSource === 'github') {
                        $(elem).attr('href', found.browser_download_url);
                        $(elem).removeClass('loading');
                    } else {
                        $(elem).attr('href', `https://xmcl-release.azureedge.net/releases/${found.name}`);
                        $(elem).removeClass('loading');
                    }
                });
            }
        }
        setupHref('[win-portable]', a => a.name.indexOf('-Setup') === -1 && a.name.endsWith('.exe'));
        setupHref('[win-zip-32]', a => a.name.endsWith('win.zip') && a.name.indexOf('ia32') !== -1);
        setupHref('[win-zip]', a => a.name.endsWith('win.zip') && a.name.indexOf('ia32') === -1);
        setupHref('[win-setup]', a => a.name.indexOf('-Setup') !== -1 && a.name.endsWith('.exe'));
        setupHref('[mac-zip]', a => a.name.endsWith('mac.zip'));
        setupHref('[dmg]', a => a.name.endsWith('.dmg'));
        setupHref('[deb]', a => a.name.endsWith('.deb'));
        setupHref('[snap]', a => a.name.endsWith('.snap'));
        setupHref('[appimage]', a => a.name.endsWith('.AppImage'));
        setupHref('[rpm]', a => a.name.endsWith('.rpm'));

        const { installer, portable, zip } = getLatestDownloadsByPlatform(latest.assets);
        $('#download').attr('href', installer.browser_download_url);
        if (portable) {
            $('#download-portable').attr('href', portable.browser_download_url);
        } else {
            $('#download-portable').attr('disable', true).addClass('disabled');
        }
        if (zip) {
            $('#download-zip').attr('href', zip.browser_download_url);
        } else {
            $('#download-zip').attr('disable', true).addClass('disabled');
        }
    }


    function getLatestDownloadsByPlatform(assets) {
        const os = platform.os;
        const is64 = os.architecture === 64;
        switch (os.family) {
            case 'Windows':
                return {
                    installer: assets.find(a => a.name.indexOf('-Setup-') !== -1 && a.name.endsWith('.exe')),
                    portable: assets.find(a => a.name.indexOf('-Setup-') === -1 && a.name.endsWith('.exe')),
                    zip: is64 ? assets.find(a => a.name.endsWith('win.zip') && a.name.indexOf('ia32') === -1)
                        : assets.find(a => a.name.endsWith('win.zip') && a.name.indexOf('ia32') !== -1),
                };
            case 'OS X':
                return {
                    installer: assets.find(a => a.name.endsWith('.dmg')),
                    zip: assets.find(a => a.name.endsWith('mac.zip')),
                }
            case 'Linux':
                return {
                    installer: assets.find(a => a.name.endsWith('.AppImage')),
                    portable: assets.find(a => a.name.endsWith('.snap')),
                }
        }
        return '';
    }

    fetch('https://api.github.com/repos/voxelum/x-minecraft-launcher/releases')
        .then(resp => {
            return resp.json()
        })
        .then(handleReleases);
}


initGithubInfo();
