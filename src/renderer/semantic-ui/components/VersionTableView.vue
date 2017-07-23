<template>
    <div>
        <h1 class="ui inverted top attached header">
            <i class="plug icon"></i>
            <div class="content">
                {{selectingVersion}}
                <!-- <div class="sub header">{{selectedMeta.releaseDate}}</div> -->
                <!-- <div class="sub header">{{selectedMeta.type}}</div> -->
            </div>
        </h1>
        <div class="ui attached disabled segment" style='height:500px;overflow-x: hidden;'>
            <div class="ui active dimmer">
                <div class="ui indeterminate text loader">Preparing Files</div>
            </div>
            <table class="ui very basic selectable celled center aligned table">
                <thead>
                    <tr>
                        <th>{{$t('version.status')}}</th>
                        <th>{{$t('version')}}</th>
                        <th>{{$t('version.releaseDate')}}</th>
                        <th>{{$t('version.date')}}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="meta in metas" :key="meta">
                        <td class="selectable">
                            <i class="download icon"></i>
                            {{meta.type}}
                        </td>
                        <td>
                            {{meta.id}}
                            <div class="floating ui label">{{meta.type}}</div>
    
                        </td>
                        <td>{{meta.releaseTime}}</td>
                        <td>{{meta.time}}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="ui inverted grey bottom attached footer center aligned segment">
            <div class="ui inverted fluid button">Save</div>
        </div>
    
    </div>
</template>
<script>
import { mapGetters, mapState } from 'vuex'
export default {
    data() {
        return {
            selectedMeta: ''
        }
    },
    computed: {
        ...mapGetters('profiles', ['selected']),
        ...mapState('versions', ['minecraft']),
        selectingVersion() {
            return this.selected.version
        },
        metas() {
            return this.minecraft.versions
        }
    },
    components: {}
}
</script>

