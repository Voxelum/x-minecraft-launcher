import Vue from 'vue'
import { RouteConfig } from 'vue-router'

import SemanticUi from './Semantic'

import ProfileView from './components/home/ProfileView'
import CardView from './components/home/CardView'

import ResourcePackList from './components/home/ResourcePackList'
import GameSettings from './components/home/GameSettings'
import ModsList from './components/home/ModsList'
import MapsList from './components/home/MapsList'
import VersionView from './components/home/VersionView'
import LaunchSettings from './components/home/LaunchSettings'

import CardsButtonGroup from './components/home/CardsButtonGroup'
import ProfileSelectedButtonGroup from './components/home/ProfileSelectedButtonGroup'

import MarketView from './components/market/MarketView'
import Curseforge from './components/market/Curseforge'
import CurseforgeProject from './components/market/CurseforgeProject'
import Mcmodcn from './components/market/McmodCn'
import McmodcnProject from './components/market/McModCnProject'
import MarketButtonGroup from './components/market/MarketButtonGroup'

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
            path: 'profile/:id',
            components: {
                default: ProfileView,
                buttons: ProfileSelectedButtonGroup,
            },
            props: {
                default: true,
                buttons: false,
            },
            children: [
                {
                    path: '',
                    redirect: 'version',
                },
                {
                    path: 'resourcepack',
                    component: ResourcePackList,
                },
                {
                    path: 'setting',
                    component: GameSettings,
                },
                {
                    path: 'mod',
                    component: ModsList,
                },
                {
                    path: 'version',
                    component: VersionView,
                },
                {
                    path: 'map',
                    component: MapsList,
                },
                {
                    path: 'launchsetting',
                    component: LaunchSettings,
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
        {
            path: 'mcmodcn/:id',
            components: { buttons: MarketButtonGroup, default: McmodcnProject },
            props: { default: true, buttons: false },
        },
    ],
}
