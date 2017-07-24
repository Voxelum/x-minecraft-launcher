<template>
    <div>
        <h1 class="ui  top attached header">
            <i class="plug icon"></i>
            <div class="content">
                {{selectingVersion}}
                <div class="sub header">{{selectedMeta.releaseDate}}</div>
                <div class="sub header">{{selectedMeta.type}}</div>
            </div>
        </h1>
        <div class="ui attached segment " :class="{disabled: metas.length==0}" style='height:500px;overflow-x: hidden;'>
            <div v-if="metas.length==0" class="ui active dimmer">
                <div class="ui indeterminate text loader">Preparing Files</div>
            </div>
            <table class="ui very basic selectable celled center aligned table">
                <tbody>
                    <tr style="cursor: pointer;" v-for="meta in metas" :key="meta" :url="meta.url" :version-id='meta.id' @click="selectVersion">
                        <td>
                            <div class="ui ribbon label">{{meta.type}}</div>
                            <br> {{meta.id}}
                        </td>
                        <td>{{meta.releaseTime}}</td>
                        <td>{{meta.time}}</td>
                        <td class="selectable" data-tooltip="Download this version" data-position="left center">
                            <div style="padding:0 10px 0 10px">
                                <i class="download icon"></i>
                            </div>
                            <!-- <label class="ui label" v-if="meta.type!='release'">{{meta.type}}</label> -->
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <!-- <div class="ui   bottom attached footer center aligned segment">
                        <div class="ui  fluid button">Save</div>
                    </div> -->
    
    </div>
</template>
<script>
import { mapGetters, mapState } from 'vuex'
export default {
    data() {
        return {
            selectedMeta: '',
            filterRelease: true,
        }
    },
    computed: {
        ...mapGetters('profiles', ['selected', 'selectedKey']),
        ...mapState('versions', ['minecraft']),
        selectingVersion() {
            return this.selected.version
        },
        metas() {
            if (!this.filterRelease)
                return this.minecraft.versions
            return this.minecraft.versions.filter(v => v.type === 'release')
        }
    },
    methods: {
        selectVersion(event) {
            this.$store.commit(`profiles/${this.selectedKey}/setVersion`, event.srcElement.parentNode.getAttribute('version-id'))
        }
    },
    components: {}
}
</script>
<style>
::-webkit-scrollbar {
    width: 8px;
}
 
/* Track */
::-webkit-scrollbar-track {
    /* -webkit-border-radius: 10px; */
    /* border-radius: 10px; */
    background: rgba(0,0,0,0.1); 
}
 
/* Handle */
::-webkit-scrollbar-thumb {
    -webkit-border-radius: 10px;
    border-radius: 10px;
    background: rgba(0,0,0,0.25); 
}
::-webkit-scrollbar-thumb:window-inactive {
	background: rgba(0,0,0,0.2); 
}
</style>


