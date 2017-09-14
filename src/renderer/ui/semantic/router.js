import Vue from 'vue'
import { RouteConfig } from 'vue-router'

import SemanticUi from './Semantic'
import ModpackView from './components/ModpackView'
import ServerView from './components/ServerView'
import CardView from './components/CardView'

import ResourcePackList from './components/ResourcePackList'
import GameSettings from './components/GameSettings'
import ModsList from './components/ModsList'
import ForgeView from './components/ForgeView'

export default {
    path: '/semantic',
    name: 'semantic',
    redirect: '/semantic/cards',
    component: SemanticUi,
    children: [
        {
            path: 'cards',
            name: 'cards',
            component: CardView,
        },
        {
            path: 'modpack/:id',
            name: 'modpack',
            component: ModpackView,
            props: true,
            children: [
                {
                    path: 'maps',
                    name: 'maps',
                },
            ],
        },
        {
            path: 'server/:id',
            name: 'server',
            component: ServerView,
            props: true,
            children: [
                {
                    path: '',
                    redirect: 'gamesettings',
                },
                {
                    path: 'resourcepacks',
                    name: 'resourcepacks',
                    component: ResourcePackList,
                    props: true,
                },
                {
                    path: 'gamesettings',
                    name: 'gamesettings',
                    component: GameSettings,
                    props: true,
                },
                {
                    path: 'mods',
                    name: 'mods',
                    component: ModsList,
                    props: true,
                },
                {
                    path: 'forge',
                    name: 'forge',
                    component: ForgeView,
                    props: true,
                },
            ],
        },
        {
            path: 'market',
            name: 'market',
        },
    ],
}
