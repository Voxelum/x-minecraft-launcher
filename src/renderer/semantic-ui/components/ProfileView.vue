<template>
    <div class="ui grid">
        <div class="five wide column">
            <h1 class="ui header">
                {{source.name}}
                <h1 class="ui sub header">
                    {{source.author}}
                </h1>
            </h1>
            <div style="min-height:300px"></div>
            <button class="ui large button">Launch</button>
        </div>
        <div class="eleven wide column">
            <div class="ui very basic menu">
                <a class="item active" data-tab="summery">
                    {{$t('summery')}}
                </a>
                <a class="item" data-tab="versions">
                    {{$t('versions')}}
                </a>
                <a class="item" data-tab="resourcepacks">
                    {{$t('resourcepacks')}}
                </a>
                <a class="item" data-tab="mods">
                    {{$t('mods')}}
                </a>
                <a class="item" data-tab="settings">
                    {{$t('settings')}}
                </a>
            </div>
            <div class="ui active tab segment" data-tab="summery">
                <!-- <div class="ui grid">
                                                <div class="three wide column">
                                                    <div class="row">
                                                        <div class="ui label">
                                                            Name
                                                        </div>
                                                    </div>
                                
                                                    <div class="row">
                                                        <div class="ui label">
                                                            Author
                                                        </div>
                                                    </div>
                                                    <div class="row">
                                                        <div class="ui label">
                                                            Description
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="four wide column">
                                                    <div class="row">
                                                        <div class="ui disabled transparent input">
                                                            <input type="text" name="Name" :placeholder="id" :value="source.name" @input="modify">
                                                        </div>
                                                    </div>
                                
                                                    <div class="row">
                                                        <div class="ui disabled transparent input">
                                                            <input type="text" name="Author" placeholder="Unknown author..." :value="source.author" @input="modify">
                                                        </div>
                                                    </div>
                                                    <div class="row">
                                                        <div class="ui disabled transparent input">
                                                            <input type="text" name="Description" placeholder="No description yet..." :value="source.description" @input="modify">
                                                        </div>
                                                    </div>
                                                </div>
                                            </div> -->
                <div class="ui list">
                    <div class="item ">
                        <div class="ui label">
                            Name
                        </div>
                        <div class="ui transparent input">
                            <input type="text" name="Name" :placeholder="id" :value="source.name" :disabled="disableNameEdit" @input="modify" @focus="focusNameEdit" @blur="disableNameEdit=true">
                        </div>
                        <span>
                            <i class="edit icon" @click="edit"></i>
                        </span>
                    </div>
                    <div class="item">
                        <div class="ui label">
                            Author
                        </div>
                        <div class="ui disabled transparent input">
                            <input type="text" name="Author" placeholder="Unknown author..." :value="source.author" @input="modify">
                        </div>
                        <span>
                            <i class="edit icon"></i>
                        </span>
                    </div>
                    <div class="item">
                        <div class="ui label">
                            Description
                        </div>
                        <div class="ui disabled transparent input">
                            <input type="text" name="Description" placeholder="No description yet..." :value="source.description" @input="modify">
                        </div>
                        <span>
                            <i class="edit icon"></i>
                        </span>
                    </div>
                </div>
            </div>
            <div class="ui tab container" data-tab="versions">
                <version-table-view></version-table-view>
            </div>
            <div class="ui tab segment" data-tab="resourcepacks">
                <p class="ui text">
                    AAA
                </p>
            </div>
            <div class="ui tab segment" data-tab="mods">
                <p class="ui text">
                    BBB
                </p>
            </div>
            <div class="ui tab segment" data-tab="settings">
    
            </div>
    
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import VersionDropdown from './VersionDropdown'
import VersionTableView from './VersionTableView'
export default {
    data() {
        return {
            disableNameEdit: true,
        }
    },
    props: ['source', 'id'],
    computed: {
        ...mapState('versions', ['minecraft']),
        versions() {
            return this.minecraft.versions
        },
    },
    methods: {
        focusNameEdit() {
        },
        edit(event) {
            event.target.parentNode.parentNode.childNodes[2].focus()
        },
        modify(event) {
            this.$store.commit('profiles/' + this.id + '/set' + event.target.name, event.target.value)
        },
        ...mapActions('versions', ['refresh']),
        showVersionPopup(event) {
            this.$nextTick(() => {
                $('#versionPopup')
                    .popup({
                        inline: true,
                        // hoverable: true,
                        position: 'bottom left',
                        delay: {
                            show: 300,
                            hide: 800
                        }
                    })
            })

        }
    },
    mounted() {
        this.refresh()
        this.$nextTick(() => {
            $('.menu .item').tab()
            $('.dropdown').dropdown()
        })
    },
    components: { VersionDropdown, VersionTableView },
}
</script>

<style>

</style>
