<template>
    <div class="ui grid">
        <div class="ui active inverted dimmer" v-if="loading">
            <div class="ui text loader">Loading</div>
        </div>
        <div v-if="!loading" class="four wide column">
            <div class="ui card">
                <div class="image">
                    <img :src="image">
                </div>
                <div class="content">
                    <a class="header" :href="`#/external/https://minecraft.curseforge.com/projects/${id}`">
                        {{name}}
                    </a>
                    <div class="meta">
                        <i class="download icon"></i>
                        {{totalDownload}}
                    </div>
                    <div class="meta">
                        <i class="time icon"></i>
                        {{createdDate}}
                    </div>
                    <div class="meta">
                        <i class="upload icon"></i>
                        {{lastFile}}
                    </div>
                </div>
                <div class="extra content">
                    <div class="ui vertical fluid secondary menu">
                        <a class="active item" data-tab="description">
                            Description
                        </a>
                        <a class="item" data-tab="files">
                            Files
                        </a>
                        <a class="item" data-tab="license">
                            License
                        </a>
                    </div>
                </div>
            </div>
        </div>
        <div class="twelve wide column" style="overflow-x:hidden; max-height:500px;">
            <div class="ui active tab" data-tab="description">
                <div v-html="description"></div>
            </div>
            <div class="ui tab" data-tab="files">
                <div class="ui active inverted dimmer" v-if="downloads.loading">
                    <div class="ui text loader">Loading</div>
                </div>
                <div class="ui middle aligned black divided items">
                    <div v-for="f of downloads.files" :key="f.href" class="item" style="padding-left:20px">
                        <div class="ui ribbon label">
                            {{f.type}}
                        </div>
                        <div class="content">
                            <div class="header">{{f.name}}</div>
                            <div class="extra">
                                <div class="ui right floated basic button" @click="download(f)">
                                    <i class="download icon"></i>{{f.size}}
                                </div>
                                <div class="ui basic label">
                                    <i class="time icon"></i>{{f.date}}
                                </div>
                                <div class="ui basic label">
                                    <i class="download icon"></i>{{f.downloadCount}}
                                </div>
                                <div class="ui basic label">
                                    <i class="game icon"></i>{{f.version}}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <pagination :pages="downloads.pages" @page="cacheDownload($event)"></pagination>
            </div>
            <div class="ui tab" data-tab="license">
                <div class="ui active inverted dimmer" v-if="license.loading">
                    <div class="ui text loader">Loading</div>
                </div>
                <p class="ui center aligned middle aligned segment">{{license.content}}</p>
            </div>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'

export default {
    data: () => ({
        image: '',
        name: '',
        totalDownload: '',
        createdDate: '',
        lastFile: '',
        description: '',
        downloads: {
            loading: false,
            page: 1,
            pages: 1,
            files: []
        },
        license: {
            loading: false,
            content: '',
        },
        cache: {},
        loading: true,
    }),
    created() {
        if (this.name === '') this.refresh();
    },
    methods: {
        ...vuex.mapActions('curseforge', ['files', 'project']),
        ...vuex.mapActions('curseforge', {
            fetchLicense: 'license',
            startDownload: 'download'
        }),
        cacheDownload(page) {
            this.downloads.loading = true;
            const path = this.id;
            page = page || this.downloads.page;
            this.downloads.files = []
            this.files({ path, version: '', page })
                .then(downloads => {
                    this.downloads.pages = downloads.pages;
                    this.downloads.files = downloads.files;
                    this.downloads.loading = false;
                })
        },
        cacheLicense() {
            if (this.license.content !== '') return;
            this.license.loading = true;
            this.fetchLicense(this.license.url)
                .then(license => {
                    this.license.content = license;
                    this.license.loading = false;
                })
        },
        refresh() {
            this.loading = true;
            const path = this.id;
            if (path === undefined || path == null) return Promise.reject('Path cannot be null');
            return this.project(path)
                .then(project => {
                    this.image = project.image;
                    this.name = project.name;
                    this.totalDownload = project.totalDownload;
                    this.createdDate = project.createdDate;
                    this.lastFile = project.lastFile;
                    this.description = project.description;
                    this.license.url = project.license;
                    this.loading = false;
                    const self = this;
                    this.$nextTick(() => {
                        $('.menu .item').tab({
                            onLoad(path) {
                                switch (path) {
                                    case 'files': self.cacheDownload(); break;
                                    case 'license': self.cacheLicense(); break;
                                }
                            }
                        })
                    })
                })
                .catch(e => {
                    this.loading = false;
                    $('.menu .item').tab({
                        onRequest(path) {
                            console.log(`load path ${path}`)
                        }
                    })
                })
        },
        download(file) {
            const project = {
                name: this.name,
                description: this.description,
                path: this.path,
                image: this.image,
            }
            this.startDownload({ file, project })
        }
    },
    props: ['id'],
}
</script>

<style>

</style>
