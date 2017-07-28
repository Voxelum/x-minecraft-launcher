<template>
<div>
    <mu-raised-button label="Alert Dialog" @click="open" />
    <mu-dialog id="loginModel" :open="dialog" :class="{'hiddenAction': logining}">
        <mu-tabs :value="activeTab" @change="handleTabChange" class="loginTabel" :class="{'not-tabs-active': notActive}">
            <mu-tab value="tab1" disabled class="unselectAble loginTitle no-active" @active="handleActive" title="Login"/>
            <mu-tab value="tab2" @active="handleNotActice" title="正版登陆"/>
            <mu-tab value="tab3" @active="handleNotActice" title="离线登陆"/>
        </mu-tabs>
        
        <div v-if="activeTab === 'tab2'">
            <div class="center">
                <br>
                <mu-text-field 
                    v-model.lazy="user.onlineEmail" 
                    hintText="账号"
                /><br/>
                <mu-text-field 
                    type="password" 
                    v-model.lazy="user.onlinePassword"
                    hintText="密码"
                /><br/>
            </div>
        </div>
        <div v-if="activeTab === 'tab3'">
            <div class="center">
                <br>
                <mu-text-field v-model.lazy="user.offlineUsername" hintText="用户名"/><br/>
            </div>
        </div>
        
        <div v-if="logining" class="login-action" id="login-wait">
            <mu-circular-progress :size="40"/>
        </div>
        <div v-if="!logining" class="login-action">
            <mu-flat-button label="登陆" slot="actions" primary @click="login"/>
        </div>
    </mu-dialog>
    <mu-snackbar v-if="snackbar.status" :message="snackbar.message" action="关闭" @actionClick="hideSnackbar" @close="hideSnackbar"/>
</div>
</template>

<script>
    import { mapGetters, mapMutations, mapState } from 'vuex'
    export default {
        data () {
            return {
                dialog: true,
                activeTab: "tab2",
                notActive: false,
                logining: false,
                items: ['正版登陆', '离线模式'],
                user: {
                    offlineUsername: "",
                    onlineEmail: "",
                    onlinePassword: "",
                },
                snackbar: {
                    status: false,
                    message: ""
                },
            }
        },
        computed: {
            ...mapState('auth', ['history', 'clientToken', 'mode', 'modes']),
            ...mapGetters('auth', [
                'disablePassword',
            ])
        },
        methods: {
            open () {
                this.dialog = true
            },
            login () {
                this.logining = true
                this.$store.dispatch('auth/login',{ 
                    account: this.account,
                    password: this.password,
                    mode: this.mode,
                    clientToken: this.clientToken
                }).then((result) => {
                        this.logining = false
                        this.showSnackbar("Logined", () => { this.dialog = false; })
                        this.$emit('logined')
                    }, err => {
                        this.logining = false
                    })
            },
            handleTabChange (val) {
                this.activeTab = val
            },
            handleActive () {
                this.notActive = true;
                this.activeTab = "tab2";
                return false;
            },
            handleNotActice() {
                this.notActive = false;
            },
            hideSnackbar () {
                this.snackbar.status = false
                if (this.snackTimer) { clearTimeout(this.snackTimer); this.snackCb() }
            },
            showSnackbar (message, onHiden) {
                this.snackbar.message = message
                this.snackbar.status = true
                if (this.snackTimer) clearTimeout(this.snackTimer)
                this.snackCb = onHiden;
                this.snackTimer = setTimeout(() => { this.snackbar = false, onHiden() }, 1000)
            },
        }
    }
</script>

<style scoped> 
    .center {
        text-align: center;
    }
    .loginTitle {
        font-size: 22px;
        font-weight: 50;
        font-family: Microsoft YaHei;
    }
    .modelActive {
        color: black;
        border-bottom:1px solid #000
    }
    .clickAble {
        cursor: pointer;
    }
    .unselectAble {
        cursor: default !important;
    }
    .loginTabel >button {
        margin-bottom: 0px;
        background-color: rgb(0, 188, 212);
        color: rbg(0, 86, 97);
        height: 100%
    }
    .login-action {
        text-align: right;
        padding-right: 16px;
        padding-bottom: 12px;
    }
    .hidden {
        display: none;
    }
    #login-wait {
        padding-bottom: 6px;
    }
</style>
<style>
    .center > .mu-text-field > .mu-text-field-content > .mu-text-field-input {
        text-align: center;
    }
    .mu-dialog-body {
        padding: 0px;
    }
    .mu-tabs {
        background-color: rgb(0, 188, 212);
    }
    .mu-tab-link-highlight {
        height: 3px;
        background-color: rgb(255, 235, 59);
    }
    .not-tabs-active > .mu-tab-link-highlight {
        transform: translate3d(100%, 0px, 0px);
    }
    .no-active > div > .mu-ripple-wrapper > .mu-circle-ripple {
        opacity: 0;
        display: none;
    }
    #loginModel > .mu-dialog-actions {
        display: none;
    }
</style>