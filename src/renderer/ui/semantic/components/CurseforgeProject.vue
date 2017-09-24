<template>
    <div id="project-container" class="ui grid" style="">
        <!-- <div class="ui active inverted dimmer">
                                                        <div class="ui text loader">Loading</div>
                                                    </div> -->
        <div v-if="cache" class="four wide column">
            <div class="ui card">
                <div class="image">
                    <img :src="cache.image">
                </div>
                <div class="content">
                    <div class="header">
                        {{cache.name}}
                    </div>
                    <div class="meta">
                        <i class="download icon"></i>
                        {{cache.totalDownload}}
                    </div>
                    <div class="meta">
                        <i class="time icon"></i>
                        {{cache.createdDate}}
                    </div>
                    <div class="meta">
                        <i class="upload icon"></i>
                        {{cache.lastFile}}
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
                <div v-if="cache.description" v-html="cache.description"></div>
            </div>
            <div class="ui tab" data-tab="files">
                <div v-if="cache.downloads" class="ui middle aligned black divided items">
                    <div v-for="f of cache.downloads.files" :key="f.href" class="item" style="padding-left:20px" @click="download(f.href)">
                        <div class="ui ribbon label">
                            {{f.type}}
                        </div>
                        <div class="content">
                            <div class="header">{{f.name}}</div>
                            <div class="extra">
                                <div class="ui right floated basic button">
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
                <pagination v-if="cache.downloads" :pages="cache.downloads.pages" @page="change($event)"></pagination>
            </div>
            <div class="ui tab" data-tab="license">
            </div>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'
import Pagination from './Pagination'

export default {
    components: { Pagination },
    data() {
        return {
            cache: {},
        }
    },
    created() {
        if (Object.keys(this.cache).length === 0)
            this.refresh();
    },
    methods: {
        ...vuex.mapActions('curseforge', ['project', 'downloads']),
        change(page) {
            this.downloads({ path: this.id, page });
        },
        refresh() {
            const self = this;
            this.project(this.id).then((proj) => {
                self.cache = proj;
                self.$nextTick(() => {
                    $('.menu .item').tab({
                    })
                })
            }, (e) => {
                console.error(e)
            })
        },
        download(href) {
            console.log(href)
        }
    },
    props: ['id'],
}
</script>

<style>

</style>
