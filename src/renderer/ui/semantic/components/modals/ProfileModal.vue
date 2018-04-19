   <template>
    <div class="ui basic modal" style="padding:0 15% 0 15%;">
        <i class="close icon"></i>
        <div class="ui icon small header">
            {{$t('user.info')}}
        </div>
        <div class="ui grid">
            <div class="ten wide column">
                <div class="ui container">
                    <table class="ui very basic collapsing celled inverted table" style="width: 100%">
                        <tbody>
                            <tr>
                                <td>
                                    <div class="ui inverted header">
                                        <i class="address card icon"></i>
                                        <div class="content">
                                            {{$t('user.name')}}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    {{info.name || $store.getters['user/username']}}
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <div class="ui inverted header">
                                        <i class="bug icon"></i>
                                        <div class="content">
                                            {{$t('user.id')}}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    {{info.id || "Unknown"}}
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <div class="ui inverted header">
                                        <i class="at icon"></i>
                                        <div class="content">
                                            {{$t('user.email')}}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    {{info.email || "Unknown"}}
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <div class="ui inverted header">
                                        <i class="calendar icon"></i>
                                        <div class="content">
                                            {{$t('user.birth')}}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    {{info.dateOfBirth ? new Date(info.dateOfBirth).toString(): "Unknown"}}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="six wide column">
                <skin-view :width="210" :height="200" :rotate="false" :slim="skin.slim" :data="skin.data" :maxDistance="1.5"></skin-view>
            </div>
        </div>

        <div class="ui divider"></div>
        <div class="ui input" style="width: 70%;  padding-right: 10px; color: white">
            <input ref="url" type="text" class="select-white" placeholder="Place your Skin URL here" style="background-color: transparent; border: 1px solid white; color: white">
        </div>
        <div class="ui right floated inverted button" style="float: right; margin: 0px;" @click="importUrl">Load URL Skin</div>
        <div class="ui divider"></div>
        <div class="ui inverted button" @click="exportSkin">Export Skin</div>
        <div class="ui inverted button" @click="importLocal">Import Local Skin</div>
        <div class="ui right floated green inverted loading button" style="margin: 0px" v-if="uploading" >Upload</div>
        <div v-else class="ui right floated green inverted button" style="margin: 0px;" @click="uploadSkin">Upload</div>
    </div>
</template>
 
<script>
import fs from 'fs-extra'

export default {
    data: () => ({
        loading: false,
        info: {},
        skin: {
            data: '',
            slim: false,
        },
        uploading: false,
    }),
    mounted() {
    },
    methods: {
        show() {
            $(this.$el).modal('show');
            this.$store.dispatch('mojang/fetchUserInfo', this.$store.state.user.auth.accessToken)
                .then((out) => {
                    this.info = out;
                });
            const rskin = this.$store.getters['user/skin'];
            this.skin.data = rskin.data;
            this.skin.slim = rskin.slim;
        },
        exportSkin() {
            this.$store.dispatch('saveDialog', {
                title: 'Save Skin To Disk',
                filters: [{ extensions: ['png'], name: 'Minecraft Skin PNG' }],
                defaultPath: `${this.$store.getters['user/username']}-skin`
            }).then((file) => {
                if (!file) return;
                return this.$store.dispatch('write', {
                    path: file,
                    data: this.skin.data
                })
            })
        },
        importLocal() {
            this.$store.dispatch('openDialog', {
                title: 'Import Skin File to Preview',
                filters: [{ extensions: ['png'], name: 'Minecraft Skin PNG' }],
            }).then((file) => {
                if (!file || file.length === 0) return undefined;
                return fs.readFile(file[0])
            }).then((data) => {
                if (!data) return undefined;
                this.skin.data = data;
            }).catch((e) => {
                console.error(e);
            })
        },
        uploadSkin() {
            this.uploading = true;
            this.$store.dispatch('mojang/uploadSkin', this.skin)
                .then(() => {
                    this.uploading = false;
                    this.$store.dispatch('user/refreshSkin')
                }, (e) => {
                    this.uploading = false;
                    console.error(e)
                })
        },
        importUrl() {
            const url = this.$refs.url.value;
            this.$store.dispatch('request', url)
                .then((buf) => {
                    this.skin.data = buf;
                });
        }
    },
    computed: {
    },
}
</script>

<style>
.select-white::selection {
  color: white;
}
</style>
