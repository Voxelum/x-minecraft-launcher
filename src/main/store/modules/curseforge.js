import parser from 'fast-html-parser';
import { createWriteStream, promises, existsSync, fstat } from 'fs';
import { ensureFile, ensureDir } from 'main/utils/fs';
import request from 'main/utils/request';
import { join, basename } from 'path';
import querystring from 'querystring';
import { finished } from 'stream';
import Task from 'treelike-task';
import { downloadFileWork, downloadToFolder, got } from 'ts-minecraft/dest/libs/utils/network';
import { promisify } from 'util';
import { bufferEntry, open, openEntryReadStream, walkEntries } from 'yauzlw';
import fileType from 'file-type';
import { cpus } from 'os';
import base from 'universal/store/modules/curseforge';

/**
 * @param {string} string 
 */
function localDate(string) {
    const d = new Date(0);
    d.setUTCSeconds(Number.parseInt(string, 10));
    return d.toLocaleDateString();
}

/**
 * @param {any} n
 */
function notText(n) { return !(n instanceof parser.TextNode); }
/**
 * @param {parser.Node | null} node
 */
function convert(node) {
    if (node === null || !node) return '';
    let text = '';
    if (node instanceof parser.TextNode) {
        text += node.rawText;
    } else if (node instanceof parser.HTMLElement) {
        if (node.tagName !== null) {
            if (node.tagName === 'a') {
                let attrs = node.rawAttrs === '' ? '' : ` ${node.rawAttrs}`;
                if (node.attributes.href) {
                    const href = node.attributes.href;
                    const rLinkIdx = href.indexOf('remoteUrl=');
                    const newHref = rLinkIdx !== -1
                        ? `#/external/${href.substring(href.indexOf('remoteUrl=') + 'remoteUrl='.length)}`
                        : `#/external/${href}`;
                    attrs = querystring.unescape(querystring.unescape(attrs.replace(href, newHref)));
                }
                text += `<${node.tagName}${attrs}>`;
            } else {
                const attrs = node.rawAttrs === '' ? '' : ` ${node.rawAttrs}`;
                text += `<${node.tagName}${attrs}>`;
            }
        }
        if (node.childNodes.length !== 0) for (const c of node.childNodes) text += convert(c);
        if (node.tagName !== null) text += `</${node.tagName}>`;
    } else throw new Error(`Unsupported type ${JSON.stringify(node)}`);
    return text;
}

/**
 * @param { import('fast-html-parser').HTMLElement } item
 * @returns { import('universal/store/modules/curseforge').CurseForgeModule.ProjectPreview }
 */
function processProjectListingRow(item) {
    item = item.removeWhitespace();

    const childs = item.childNodes.filter(notText);
    const iconElem = item.querySelector('.project-avatar').querySelector('a');
    const url = iconElem.attributes.href;
    const imgTag = iconElem.querySelector('img');
    const icon = imgTag ? imgTag.attributes.src : '';

    const mainBody = childs[1].childNodes.filter(notText);
    const categorysBody = childs[2].childNodes.filter(notText)[1];

    const baseInfo = mainBody[0].childNodes.filter(notText);
    const metaInfo = mainBody[1].childNodes.filter(notText);
    const description = mainBody[2].text;

    const title = baseInfo[0].querySelector('h3').rawText;
    const author = baseInfo[2].rawText;
    const count = metaInfo[0].rawText.replace(' Downloads', '');
    const updatedDate = metaInfo[1].querySelector('abbr').attributes['data-epoch'];
    const createdDate = metaInfo[2].querySelector('abbr').attributes['data-epoch'];

    const categories = categorysBody.querySelectorAll('a').map(link => ({
        href: link.attributes.href,
        icon: link.querySelector('img').attributes.src,
        title: link.querySelector('figure').attributes.title,
    }));

    return {
        name: url.substring(url.lastIndexOf('/') + 1),
        title,
        author,
        description,
        createdDate,
        updatedDate,
        count,
        categories,
        icon,
    };
}

/**
 * @typedef {import('universal/store/modules/curseforge').CurseForgeModule.Modpack} Modpack
 * @type {import('universal/store/modules/curseforge').CurseForgeModule}
 */
const mod = {
    ...base,
    actions: {
        async importCurseforgeModpack(context, path) {
            const stat = await promises.stat(path);
            if (!stat.isFile()) throw new Error(`Cannot import curseforge modpack ${path}, since it's not a file!`);
            const buf = await promises.readFile(path);
            const fType = fileType(buf);
            if (!fType || fType.ext !== 'zip') throw new Error(`Cannot import curseforge modpack ${path}, since it's not a zip!`);
            const curseForgeRoot = join(context.rootState.root, 'curseforge');

            /**
             * @param {{url:string, dest: string}[]} pool
             * @param {Task.Context} ctx 
             * @param {string[]} modlist
             */
            async function downloadWorker(pool, ctx, modlist) {
                for (let task = pool.pop(); task; task = pool.pop()) {
                    try {
                        // we want to ensure the mod is in the disk
                        // and know the mod's modid & version
                        let res;
                        const { url, dest } = task;
                        const mappingFile = join(curseForgeRoot, `${basename(dest)}.mapping`);
                        let shouldDownload = true;
                        if (existsSync(mappingFile)) {
                            // if we already have the mapping [file id -> resource], we can just check it from memory
                            const [hash, path] = await promises.readFile(mappingFile).then(b => b.toString().split('\n'));
                            const cachedResource = context.rootState.resource.mods[hash];
                            if (cachedResource) {
                                res = cachedResource;
                                shouldDownload = false;
                            }
                        }
                        if (shouldDownload) {
                            // if we don't have the mod, we should download it
                            await downloadFileWork({ url, destination: dest })(ctx);
                            res = await context.dispatch('importResource', { path: dest });
                            if (res) {
                                await promises.writeFile(mappingFile, `${res.hash}\n${res.path}`);
                                await promises.unlink(dest);
                            }
                        }
                        if (res && res.metadata instanceof Array) {
                            const { modid, version } = res.metadata[0];
                            // now we should add this mod to modlist
                            if (modid && version) {
                                modlist.push(`${modid}:${version}`);
                            } else {
                                console.error(`Cannot resolve ${url} as a mod!`);
                                console.error(JSON.stringify(res));
                                throw new Error(`Cannot resolve ${url} as a mod!`);
                            }
                        } else {
                            console.error(`Cannot resolve ${url} as a mod!`);
                            console.error(JSON.stringify(res));
                            throw new Error(`Cannot resolve ${url} as a mod!`);
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
            }

            const task = Task.create('installCurseforgeModpack', async (ctx) => {
                const zipFile = await open(buf, { lazyEntries: true, autoClose: false });
                /** @type {import('yauzlw').Entry[]} */
                const others = [];
                let manifestEntry;
                await walkEntries(zipFile, (entry) => {
                    if (entry.fileName === 'manifest.json') {
                        manifestEntry = entry;
                    } else {
                        others.push(entry);
                    }
                });
                if (!manifestEntry) throw new Error(`Cannot import curseforge modpack ${path}, since it doesn't have manifest.json`);
                const manifestBuf = await bufferEntry(zipFile, manifestEntry);
                /** @type {Modpack} */
                const manifest = JSON.parse(manifestBuf.toString());
                const tempRoot = join(context.rootState.root, 'temp', manifest.name);

                await ensureDir(curseForgeRoot);
                await ensureDir(tempRoot);

                // download required assets (mods)

                const shouldDownloaded = [];
                for (const f of manifest.files) {
                    const mapping = join(curseForgeRoot, `${f.fileId}.mapping`);
                    if (existsSync(mapping)) {
                        const buf = await promises.readFile(mapping);
                        if (existsSync(buf.toString())) {
                            // eslint-disable-next-line no-continue
                            continue;
                        }
                    }
                    shouldDownloaded.push(f);
                }
                const pool = shouldDownloaded.map(f => ({ url: `https://minecraft.curseforge.com/projects/${f.projectId}/files/${f.fileId}/download`, dest: join(tempRoot, f.fileId.toString()) }));

                /** @type {string[]} */
                const modlist = [];
                await Promise.all(cpus().map(_ => ctx.execute('mod', c => downloadWorker(pool, c, modlist))));

                // create profile accordingly 

                const forgeId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('forge'));
                const id = await context.dispatch('createProfile', {
                    name: manifest.name,
                    mcversion: manifest.minecraft.version,
                    author: manifest.author,
                    forge: {
                        version: forgeId ? forgeId.id.substring(5) : '',
                        mods: modlist,
                    },
                });
                const profileFolder = join(context.rootState.root, 'profiles', id);

                // start handle override

                const waitStream = promisify(finished);
                /** @param {import('yauzlw').Entry} o */
                async function pipeTo(o) {
                    const dest = join(profileFolder, o.fileName.substring(manifest.override.length));
                    const readStream = await openEntryReadStream(zipFile, o);
                    return waitStream(readStream.pipe(createWriteStream(dest)));
                }
                if (manifest.override) {
                    const overrides = others.filter(e => e.fileName.startsWith(manifest.override));
                    for (const o of overrides) {
                        const dest = join(profileFolder, o.fileName.substring(manifest.override.length));
                        await ensureFile(dest);
                    }
                    await Promise.all(overrides.map(o => pipeTo(o)));
                }
            });
            return context.dispatch('executeTask', task);
        },
        fetchCurseForgeProjects(_, payload = { project: 'mc-mods' }) {
            const { page, version, filter, project } = payload;
            if (typeof project !== 'string') throw new Error('Require project be [mc-mod], [resourcepack]');
            const sort = filter;
            const endpoint = `https://www.curseforge.com/minecraft/${project}?${querystring.stringify({
                page: page || '0',
                'filter-sort': sort || 'popularity',
                'filter-game-version': version || '',
            })}`;
            return request(endpoint, (root) => {
                root = root.removeWhitespace();
                const pages = root.querySelectorAll('.pagination-item')
                    .map(pageItem => pageItem.firstChild.rawText)
                    .filter(text => text.length < 5) // hardcode filter out the non page elem 
                    .map(text => Number.parseInt(text, 10))
                    .filter(n => Number.isInteger(n))
                    .reduce((a, b) => (a > b ? a : b));
                const versions = root.querySelector('#filter-game-version').removeWhitespace()
                    .childNodes.map(ver => ({
                        type: ver.attributes.class,
                        text: ver.rawText,
                        value: ver.attributes.value,
                    }));
                const filters = root.querySelector('#filter-sort').removeWhitespace()
                    .childNodes.map(f => ({
                        text: f.rawText,
                        value: f.attributes.value,
                    }));
                const all = root.querySelectorAll('.project-listing-row').map(processProjectListingRow);
                return {
                    projects: all,
                    pages,
                    versions,
                    filters,
                };
            });
        },

        fetchCurseForgeProject(context, { path, project }) {
            if (!path || path == null) throw new Error('Curseforge path cannot be null');
            const url = `https://www.curseforge.com/minecraft/${project}/${path}`;

            console.log(`Get curseforge project ${url}`);

            return request(url, (root) => {
                const details = root.querySelector('.project-detail__content').removeWhitespace();

                const header = root.querySelector('.game-header').querySelectorAll('.container')[1]
                    .childNodes.filter(notText)[0];
                const image = header.querySelector('img').attributes.src;
                const name = header.querySelector('.font-bold').text;
                const updatedDate = header.querySelector('.standard-date').attributes['data-epoch'];

                const sides = root.querySelectorAll('.my-4')[1].childNodes.filter(notText);
                const sideInfoElems = sides[0] // <div class="my-4">
                    .childNodes.filter(notText)[0] // <div class="pb-4 border-b border-gray--100">
                    .childNodes.filter(notText)[1] // <div class="flex flex-col mb-3"> 
                    .childNodes.filter(notText);
                const id = sideInfoElems[0].querySelectorAll('span')[1].rawText;
                const createdDate = sideInfoElems[1].querySelector('abbr').attributes['data-epoch'];
                const totalDownload = sideInfoElems[3].querySelectorAll('span')[1].rawText;
                const licenseElem = sideInfoElems[4].querySelector('a');
                const license = { url: licenseElem.attributes.href, name: licenseElem.rawText };

                const members = sides[0] // <div class="my-4">
                    .querySelectorAll('.mb-2').map(e => ({
                        icon: e.querySelector('img').attributes.src,
                        name: e.querySelector('span').rawText,
                        type: e.querySelectorAll('p')[1].rawText,
                    }));

                return {
                    id,
                    name,
                    image,
                    updatedDate,
                    createdDate,
                    totalDownload,
                    members,
                    license,
                    description: convert(details),
                };
            });
        },

        fetchCurseForgeProjectFiles(context, payload) {
            if (!payload) throw new Error('Require fetch file with project type & project path');
            let { page, version } = payload;
            const { project } = payload;
            const path = `/${project}/${payload.path}`;

            if (!path || path == null) throw new Error('Curseforge path cannot be null');
            version = version || '';
            page = page || 1;
            const url = `https://www.curseforge.com/minecraft/${path}/files/all?filter-game-version=${version}&page=${page}`;
            console.log(`Get curseforge project file ${url}`);
            return request(url, (filespage) => {
                const pagesElement = filespage.querySelectorAll('.pagination-item');
                let page;
                if (pagesElement.length === 0) {
                    page = 0;
                } else {
                    page = pagesElement
                        .map(pageItem => pageItem.firstChild.rawText)
                        .map(text => Number.parseInt(text, 10))
                        .filter(n => Number.isInteger(n))
                        .reduce((a, b) => (a > b ? a : b));
                }
                const versions = filespage.querySelector('#filter-game-version').removeWhitespace()
                    .childNodes.map(ver => ({
                        type: ver.attributes.class,
                        text: ver.rawText,
                        value: ver.attributes.value,
                    }));
                const files = filespage.querySelector('.listing-project-file').querySelector('tbody').querySelectorAll('tr')
                    .map(i => i.removeWhitespace())
                    .map(i => ({
                        type: i.firstChild.querySelector('span').text,
                        name: i.childNodes[1].firstChild.rawText,
                        size: i.childNodes[2].rawText,
                        date: i.childNodes[3].firstChild.attributes['data-epoch'],
                        version: i.childNodes[4].firstChild.removeWhitespace().firstChild.rawText,
                        downloadCount: i.childNodes[5].rawText,
                        href: i.childNodes[6].querySelector('a').attributes.href,
                    }));
                return { pages: page, versions, files };
            });
        },

        async fetchCurseforgeProjectImages(context, { path, type }) {
            const url = `https://www.curseforge.com/minecraft/${type}/${path}/screenshots`;

            console.log(`Fetch curseforge images from ${url}`);

            return request(url, (root) => {
                const page = root.querySelector('.project-screenshot-page');
                return page.querySelectorAll('.justify-center')
                    .map(i => ({
                        url: i.attributes['data-featherlight'],
                        mini: i.querySelector('img').attributes.href,
                        name: i.querySelector('img').attributes.title,
                    }));
            });
        },
        async fetchCurseForgeProjectLicense(context, url) {
            if (url == null || !url) throw new Error('URL cannot be null');
            const { body } = await got(`https://minecraft.curseforge.com${url}`);
            return parser.parse(body).querySelector('.module').removeWhitespace().firstChild.rawText;
        },

        async searchCurseforgeProjects(context, { keyword, type }) {
            const url = `https://www.curseforge.com/minecraft/${type}/search?search=${keyword}`;
            return request(url, root => root.querySelectorAll('.project-listing-row').map(processProjectListingRow));
        },
        async downloadAndImportFile(context, payload) {
            const url = `https://www.curseforge.com${payload.file.href}/file`;

            const task = Task.create('installCurseforgeFile', async (ctx) => {
                if (context.rootGetters.isFileInstalled(payload.file)) {
                    context.commit('endDownloadCurseforgeFile', payload.file);
                    return;
                }
                try {
                    ctx.update(-1, -1, url);
                    const dest = await downloadFileWork({
                        url,
                        destination: context.rootGetters.path('temp', payload.file.name),
                        headers: {
                            'user-agent': '',
                        },
                    })(ctx);
                    ctx.update(-1, -1);
                    await context.dispatch('importResource', {
                        path: dest,
                        metadata: {
                            url,
                            curseforge: {
                                href: payload.file.href,
                                projectId: payload.project.id,
                                path: payload.project.path,
                                type: payload.project.type,
                            },
                        },
                    });
                } finally {
                    context.commit('endDownloadCurseforgeFile', payload.file);
                }
            });

            const id = await context.dispatch('executeTask', task);
            context.commit('startDownloadCurseforgeFile', { download: payload.file, taskId: id });
            return id;
        },
    },
};

export default mod;
