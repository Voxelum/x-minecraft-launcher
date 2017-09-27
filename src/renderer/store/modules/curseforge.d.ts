interface State {
    mods: ProjectPreview[],
    page: number,
    pages: number,
    version: string,
    versions: string[],
    filter: string,
    filters: string[],
    category: string,
    categories: string[],
    loading: boolean,
    cached: {
        [path: string]: CurseforgeProject
    }
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

interface CurseforgeProject {
    image: string,
    name: string,
    createdDate: string,
    lastFile: string,
    totalDownload: string,
    license: string,
    description: string,
    downloads: {
        [path: string]: CurseforgeDownload[]
        page: number,
        pages: number
    }
}

interface CurseforgeDownload {
    type: string
    name: string
    href: string
    size: string
    date: string
    version: string
    downloadCount: string
}