import Vue from 'vue'
import { RouteConfig } from 'vue-router'

import SemanticUi from './Semantic'
import ModpackView from './components/ModpackView'
import ServerView from './components/ServerView'
import CardView from './components/CardView'
import MarketView from './components/MarketView'
import Curseforge from './components/Curseforge'
import CurseforgeProject from './components/CurseforgeProject'
import Mcmodcn from './components/McmodCn'

import ResourcePackList from './components/ResourcePackList'
import GameSettings from './components/GameSettings'
import ModsList from './components/ModsList'
import ForgeView from './components/ForgeView'

import CardsButtonGroup from './components/CardsButtonGroup'
import ProfileSelectedButtonGroup from './components/ProfileSelectedButtonGroup'
import MarketButtonGroup from './components/MarketButtonGroup'

export default {
    path: '/semantic',
    name: 'semantic',
    redirect: '/semantic/cards',
    component: SemanticUi,
    children: [
        {
            path: 'cards',
            name: 'cards',
            components: {
                default: CardView,
                buttons: CardsButtonGroup,
            },
        },
        {
            path: 'modpack/:id',
            name: 'modpack',
            components: {
                default: ModpackView,
                buttons: ProfileSelectedButtonGroup,
            },
            props: {
                default: true,
                buttons: false,
            },
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
            components: {
                default: ServerView,
                buttons: ProfileSelectedButtonGroup,
            },
            props: {
                default: true,
                buttons: false,
            },
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
            components: { buttons: MarketButtonGroup, default: MarketView },
        },
        {
            path: 'curseforge',
            name: 'curseforge',
            components: { buttons: MarketButtonGroup, default: Curseforge },
        },
        {
            path: 'curseforge/:id',
            name: 'curseforge-project',
            components: { buttons: MarketButtonGroup, default: CurseforgeProject },
            props: { default: true, buttons: false },
        },
        {
            path: 'mcmodcn',
            name: 'mcmodcn',
            components: { buttons: MarketButtonGroup, default: Mcmodcn },
        },
    ],
}
