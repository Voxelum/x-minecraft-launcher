import { Forge } from '@xmcl/mod-parser';
import { HTMLElement, parse as parseHtml } from 'fast-html-parser';
import querystring from 'querystring';
import InstanceService from './InstanceService';
import ResourceService from './ResourceService';
import Service, { Inject } from './Service';

export type ProjectType = 'mc-mods' | 'texture-packs' | 'worlds' | 'modpacks';

export interface DownloadFile {
    /**
     * The number id of the curseforge file 
     */
    id: number;
    name: string;
    href?: string;

    projectType: ProjectType;
    projectPath: string;
    projectId?: number;
}

export interface Downloads {
    pages: number;
    versions: Version[];
    files: Download[];
}
export interface Download {
    id: number;
    name: string;
    href: string;

    type: string;
    size: string;
    date: string;
    version: string;
    downloadCount: string;
}
export interface ProjectPreview {
    name: string;
    title: string;
    author: string;
    description: string;
    updatedDate: string;
    createdDate: string;
    count: string;
    categories: {
        href: string;
        icon: string;
    }[];
    icon: string;
}

/**
 * Project detail info
 */
export interface Project {
    /**
     * Number id of the project
     */
    id: number;
    /**
     * mc-mods/jei, jei is the path
     */
    path: string;
    type: ProjectType;
    /**
     * Display name
     */
    name: string;
    /**
     * Image url
     */
    image: string;
    members: { icon: string; name: string; type: string }[];
    updatedDate: number;
    createdDate: number;
    totalDownload: string;
    license: { url: string; name: string };
    files: {
        /**
         * number id of the file
         */
        id: number;
        type: string;
        /**
         * Display name
         */
        name: string;
        date: number;

        href: string;
    }[];
    description: string;
}

export interface Version {
    type: string;
    text: string;
    value: string;
}
export interface Filter {
    text: string;
    value: string;
}

/**
 * The modpack metadata structure
 */
export interface Modpack {
    manifestType: string;
    manifestVersion: number;
    minecraft: {
        version: string;
        libraries?: string;
        modLoaders: {
            id: string;
            primary: boolean;
        }[];
    };
    name: string;
    version: string;
    author: string;
    files: {
        projectID: number;
        fileID: number;
        required: boolean;
    }[];
    overrides: string;
}


function getHref(file: DownloadFile) {
    return `https://www.curseforge.com/minecraft/${file.projectType}/${file.projectPath}/download/${file.id}/file`;
}
// test url https://cursemeta.dries007.net/238222/2739588 jei
function localDate(string: string) {
    const d = new Date(0);
    d.setUTCSeconds(Number.parseInt(string, 10));
    return d.toLocaleDateString();
}
function notText(n: HTMLElement) {
    return n.nodeType !== 3;
}
function convert(node: HTMLElement | null) {
    if (node === null || !node) return '';
    let text = '';
    if (node.nodeType === 3) {
        text += node.rawText;
    } else if (node instanceof HTMLElement) {
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
        if (node.childNodes.length !== 0) for (const c of node.childNodes) text += convert(c as HTMLElement);
        if (node.tagName !== null) text += `</${node.tagName}>`;
    } else throw new Error(`Unsupported type ${JSON.stringify(node)}`);
    return text;
}
function processProjectListingRow(item: HTMLElement): ProjectPreview {
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

export default class CurseForgeService extends Service {
    @Inject('InstanceService')
    private instanceService!: InstanceService;

    @Inject('ResourceService')
    private resourceService!: ResourceService;

    private async request<T>(url: string, transformToObject: (element: HTMLElement) => T) {
        const body = await this.networkManager.requestPage(url);
        const html = parseHtml(body);
        return transformToObject(html);
    }

    fetchCurseForgeProjects(payload: { page?: string; version?: string; filter?: string; project: ProjectType } = { project: 'mc-mods' }): Promise<{
        projects: ProjectPreview[]; pages: number; versions: Version[]; filters: Filter[];
    }> {
        const { page, version, filter, project } = payload;
        if (typeof project !== 'string') throw new Error('Require project be [mc-mod], [resourcepack]');
        const sort = filter;
        const endpoint = `https://www.curseforge.com/minecraft/${project}?${querystring.stringify({
            page: page || '0',
            'filter-sort': sort || 'popularity',
            'filter-game-version': version || '',
        })}`;
        return this.request(endpoint, (root) => {
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
    }

    /**
     * Query the project detail from path.
     */
    fetchCurseForgeProject({ path, project }: { path: string; project: ProjectType }): Promise<Project> {
        if (!path || path == null) throw new Error('Curseforge path cannot be null');
        const url = `https://www.curseforge.com/minecraft/${project}/${path}`;

        this.log(`Get curseforge project ${url}`);

        return this.request(url, (root) => {
            const details = root.querySelector('.project-detail__content').removeWhitespace();

            const header = root.querySelector('.game-header').querySelectorAll('.container')[1]
                .childNodes.filter(notText)[0];
            const image = header.querySelector('img').attributes.src;
            const name = header.querySelector('.font-bold').text;
            const updatedDate = Number.parseInt(header.querySelector('.standard-date').attributes['data-epoch'], 10);

            const sides = root.querySelectorAll('.my-4')[1].childNodes.filter(notText);
            const sideInfoElems = sides[0] // <div class="my-4">
                .childNodes.filter(notText)[0] // <div class="pb-4 border-b border-gray--100">
                .childNodes.filter(notText)[1] // <div class="flex flex-col mb-3"> 
                .childNodes.filter(notText);
            const id = Number.parseInt(sideInfoElems[0].querySelectorAll('span')[1].rawText, 10);
            const createdDate = Number.parseInt(sideInfoElems[1].querySelector('abbr').attributes['data-epoch'], 10);
            const totalDownload = sideInfoElems[3].querySelectorAll('span')[1].rawText;
            const licenseElem = sideInfoElems[4].querySelector('a');
            const license = { url: licenseElem.attributes.href, name: licenseElem.rawText };

            const filesElems = root.querySelectorAll('.cf-recentfiles'); // <ul class="cf-recentfiles">
            const files = filesElems.map((e) => {
                e = e.removeWhitespace();
                return e.childNodes.map((c) => {
                    const type = c.firstChild.querySelector('span').attributes.title.toLocaleLowerCase();
                    const body = c.childNodes[1];

                    /*
                    <div class="flex flex-col w-2/3">
                        <a class="overflow-tip truncate j-tooltip" href="/minecraft/modpacks/rlcraft/files/2836137" data-action="'modpack-file-link'" data-id="285109" data-name="RLCraft 1.12.2 - Beta v2.8.1.zip">RLCraft 1.12.2 - Beta v2.8.1.zip</a>
                        <abbr class="tip standard-date standard-datetime" title="12/2/2019 10:45 PM" data-epoch="1575355531" time-processed="true">Dec 3, 2019</abbr>
                    </div>
                    */
                    const [nameElem, timeElem] = body.removeWhitespace().childNodes;
                    const fileHref = nameElem.attributes.href;
                    const id = Number.parseInt(fileHref.substring(fileHref.lastIndexOf('/') + 1), 10);
                    const name = nameElem.attributes['data-name'];
                    const date = Number.parseInt(timeElem.attributes['data-epoch'], 10);
                    const downloadElem = c.childNodes[2].querySelector('a');
                    return {
                        id,
                        type,
                        name,
                        date,
                        href: downloadElem ? downloadElem.attributes.href : fileHref.replace('files', 'download'),
                    };
                });
            }).reduce((a, b) => [...a, ...b]);
            const members = sides[0] // <div class="my-4">
                .querySelectorAll('.mb-2').map(e => ({
                    icon: e.querySelector('img').attributes.src,
                    name: e.querySelector('span').rawText,
                    type: e.querySelectorAll('p')[1].rawText,
                }));

            return {
                id,
                path,
                type: project,
                name,
                image,
                updatedDate,
                createdDate,
                totalDownload,
                members,
                license,
                files,
                description: convert(details),
            };
        });
    }

    /**
     * Query the project downloadable files.
     */
    fetchCurseForgeProjectFiles(payload: { path: string; version?: string; page?: number; project: ProjectType | string }): Promise<Downloads> {
        if (!payload) throw new Error('Require fetch file with project type & project path');
        let { page, version } = payload;
        const { project, path } = payload;
        if (!path || path == null) throw new Error('Curseforge path cannot be null');
        version = version || '';
        page = page || 1;
        const url = `https://www.curseforge.com/minecraft/${project}/${path}/files/all?filter-game-version=${version}&page=${page}`;
        this.log(`Get curseforge project file ${url}`);
        return this.request(url, (filespage) => {
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
                    id: Number.parseInt(i.childNodes[1].firstChild.attributes.href.substring(i.childNodes[1].firstChild.attributes.href.lastIndexOf('/') + 1), 10),
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
    }

    async fetchCurseforgeProjectImages({ path, type }: { path: string; type: string | ProjectType }): Promise<{ name: string; url: string; mini: string }[]> {
        const url = `https://www.curseforge.com/minecraft/${type}/${path}/screenshots`;

        this.log(`Fetch curseforge images from ${url}`);

        return this.request(url, (root) => {
            const page = root.querySelector('.project-screenshot-page');
            return page.querySelectorAll('.justify-center')
                .map(i => ({
                    url: i.attributes['data-featherlight'],
                    mini: i.querySelector('img').attributes.href,
                    name: i.querySelector('img').attributes.title,
                }));
        });
    }

    async fetchCurseForgeProjectLicense(url: string) {
        if (url == null || !url) throw new Error('URL cannot be null');
        const body = await this.networkManager.requst(`https://www.curseforge.com${url}`).text();
        return parseHtml(body).querySelector('.module').removeWhitespace().firstChild.rawText;
    }

    async searchCurseforgeProjects({ keyword, type }: { keyword: string; type: string | ProjectType }): Promise<ProjectPreview[]> {
        const url = `https://www.curseforge.com/minecraft/${type}/search?search=${keyword}`;
        return this.request(url, root => root.querySelectorAll('.project-listing-row').map(processProjectListingRow));
    }

    async fetchMetadataByModId({ modid, version }: { modid: string; version: string }) {
        // http://voxelauncher.azurewebsites.net/api/v1/mods/file/{modid}/{version}
        const result = await this.networkManager.requst(`http://voxelauncher.azurewebsites.net/api/v1/mods/file/${modid}/${version}`, { method: 'HEAD' }).json();
        return result as Forge.ModMetaData & { projectId: string; fileId: string };
    }

    async downloadAndImportFile(payload: DownloadFile) {
        const href = payload.href || getHref(payload);
        this.commit('startDownloadCurseforgeFile', { download: payload, taskId: '' });

        if (this.getters.isFileInstalled({ id: payload.id, href })) {
            this.commit('endDownloadCurseforgeFile', payload);
            return;
        }
        try {
            await this.resourceService.importResource({
                uri: `curseforge://path/${payload.projectType}/${payload.projectPath}`,
                metadata: {
                    projectId: payload.projectId,
                    fileId: payload.id,
                    projectPath: payload.projectPath,
                    projectType: payload.projectType,
                },
            });
        } finally {
            this.commit('endDownloadCurseforgeFile', payload);
        }
    }
}
