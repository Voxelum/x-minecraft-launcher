
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
