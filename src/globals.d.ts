
interface ResourceParser {
    domain: string
    parse: (name: string, data: Buffer, type: string) => any
}

interface Service {
    id?: string
    initialize?: () => void
    proxy?: any
    actions?: { [actionName: string]: (context: ServiceContext, payload: any) => Promise<any> }
}

namespace McModCN {
    interface Item {
        id: string
        url: string
        image: string
    }
    interface ModPreview {
        id: string
        image: string
        url: string
        title: string
        view: string
        likes: string
        favor: string
        items: Item
    }

    interface Mod {
        title: string
        subTitle: string
        likes: string
        popularity: string
        popularityType: string
        lastDayCount: string
        averageCount: string
        browseCount: string
        recommendCount: string
        image: string
        modType: string
        recordTime: string
        author: string
        lastModifiedTime: string
        mod: string
        lastRecommendTime: string
        modifyCount: string
        relevantLink: string[]
        modDescription: string
    }

    interface Category {
        title: string
        url: string
        description: string
        list: ModPreview
    }
}

interface TaskModule {
    create(payload: { id: string, uuid: string, path: string[] }): string[]
    update(payload: { path: string[], progress: number, total: number, status: string }): void
    finish(payload: { path: string[] }): void
    error(payload: { path: string[], error: any }): void
}

declare module 'fast-html-parser' {
    interface Node {
        text: string
        rawText: string
        structuredText: string

        firstChild: Node
        lastChild: Node
        childNodes: Node[]

        removeWhitespace(): Node
        trimRight(): Node

        attributes: { [key: string]: string }
        rawAttributes: string
        rawAttrs: string
        tagName: string
        id: string
        classNames: string[]
    }
    interface HTMLElement extends Node {
        querySelectorAll(selector: string): Node[]
        querySelector(selector: string): Node

        removeWhitespace(): HTMLElement
        trimRight(): HTMLElement
    }

    function parse(raw: string, options?: {
        lowerCaseTagName?: false,  // convert tag name to lower case (hurt performance heavily)
        script?: false,            // retrieve content in <script> (hurt performance slightly)
        style?: false,             // retrieve content in <style> (hurt performance slightly)
        pre?: false,
    }): HTMLElement;
}

interface ServiceContext {
    uuid: string
    source: Electron.WebContents
    dispatch: (service: string, action: string, payload: any) => Promise<any>
}

interface Download {
    type: string
    name: string
    href: string
    size: string
    date: string
    version: string
    downloadCount: string
}
interface Downloads {
    pages: string,
    versions: string[],
    files: Download[],
}

interface ProjectPreview {
    path: string
    name: string
    author: string
    description: string
    date: string
    count: string
    categories: string
    icon: string
}

interface Project {
    image: string,
    name: string,
    createdDate: string,
    lastFile: string,
    totalDownload: string,
    license: string,
    description: string,
}
