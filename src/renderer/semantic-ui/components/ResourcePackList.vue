<template>
    <div>
        <div class="ui button" @click="importResourcePack">Import</div>
        <div class="ui list">
            <div class="item">
                <div class="right floated content">
                    <div class="ui button">
                        <i class="arrow right icon"></i>
                    </div>
                </div>
                <i class="map marker icon"></i>
                <div class="content">
                    <div class="header">Krolewskie Jadlo</div>
                    <div class="description">A pack that do xxx</div>
                </div>
            </div>
            <div class="item">
                <div class="right floated content">
                    <div class="ui button">
                        <i class="arrow right icon"></i>
                    </div>
                </div>
                <i class="map marker icon"></i>
                <div class="content">
                    <div class="header">Xian Famous Foods</div>
                    <div class="description">A pack bring xxx exp to mc.</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { remote } from 'electron'
import { mapActions } from 'vuex'
export default {
    methods: {
        ...mapActions('resourcepacks', 'import'),
        importResourcePack() {
            remote.dialog.showOpenDialog({}, (files) => {

            })
        }
    }

}
</script>
