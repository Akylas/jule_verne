<template>
    <Page>
        <Drawer
            ref="drawer"
            @navigatedTo="onNavigatedTo"
            @loaded="onLoaded"
            :gestureEnabled="true"
            :leftSwipeDistance="20"
            :gestureHandlerOptions="{
                failOffsetYStart: -10,
                failOffsetYEnd: 10
            }"
        >
            <BottomSheet :stepIndex="stepIndex" :steps="[0, 70]" :gestureEnabled="false" ~mainContent>
                <StackLayout ref="page" actionBarHidden>
                    <Pager ref="pager" height="0" :items="messages" backgroundColor="#405798" +alias="messageItem">
                        <v-template>
                            <GridLayout columns="auto,*,auto,auto" rows="auto,*,auto" width="100%" height="100%">
                                <Label padding="4 4 0 4" colSpan="4" color="white" fontSize="14" lineBreak="end" verticalTextAlignment="center">
                                    <Span :visibility="messageItem.smallIcon ? 'visible' : 'hidden'" :text="messageItem.smallIcon + ' '" :fontFamily="mdiFontFamily" />
                                    <Span :text="messageItem.title" fontWeight="bold" />
                                </Label>
                                <Label
                                    marginLeft="4"
                                    row="1"
                                    v-show="messageItem.icon"
                                    fontWeight="bold"
                                    color="#405798"
                                    textAlignment="center"
                                    width="26"
                                    height="26"
                                    borderRadius="13"
                                    verticalTextAlignment="center"
                                    backgroundColor="white"
                                    fontSize="20"
                                    :text="messageItem.icon"
                                    :fontFamily="mdiFontFamily"
                                    verticalAlignment="center"
                                />
                                <Label padding="0 4 0 4" row="1" col="1" :text="messageItem.message" color="white" fontSize="10" verticalTextAlignment="top" />
                                <Label rowSpan="2" col="2" color="white" marginRight="4" verticalTextAlignment="center" textAlignment="right">
                                    <Span :text="messageItem.rightIcon" :visibility="messageItem.rightIcon ? 'visible' : 'hidden'" fontSize="26" :fontFamily="mdiFontFamily" fontWeight="bold" />
                                    <Span :text="'\n' + messageItem.rightMessage" :visibility="messageItem.rightMessage ? 'visible' : 'hidden'" fontSize="10" />
                                </Label>
                                <MDButton
                                    rowSpan="2"
                                    variant="text"
                                    class="mdi"
                                    fontSize="20"
                                    padding="5"
                                    width="30"
                                    height="30"
                                    verticalAlignment="center"
                                    :fontFamily="mdiFontFamily"
                                    v-show="messageItem.action"
                                    :text="messageItem.action.text"
                                    color="white"
                                    @tap="onButtonTap(messageItem)"
                                    col="3"
                                />
                                <MDProgress row="2" colSpan="4" v-show="messageItem.progress !== undefined" :value="messageItem.progress" verticalAlignment="bottom" color="white" />
                            </GridLayout>
                        </v-template>
                    </Pager>
                    <Frame>
                        <MainMenu />
                    </Frame>
                </StackLayout>
                <BarAudioPlayerWidget ~bottomSheet />
            </BottomSheet>
            <GridLayout ~leftDrawer rows="auto,*,auto,auto" height="100%" :backgroundColor="backgroundColor" width="80%">
                <GridLayout padding="10" height="80" rows="auto, *" columns="auto, *">
                    <Label marginLeft="15" fontSize="20" :text="$t('menu') | titlecase" :color="textColor" />
                    <GlassesIcon
                        horizontalAlignment="right"
                        col="1"
                        :glasses="connectedGlasses"
                        :battery="glassesBattery"
                        @longPress="onLongPress('disconnectGlasses', $event)"
                        @tap="onTap('connectGlasses')"
                    />
                </GridLayout>
                <CollectionView :items="menuItems" row="1" paddingTop="10" rowHeight="50" @tap="noop" +alias="menuItem">
                    <v-template>
                        <GridLayout columns="50, *" class="menu" :active="menuItem.activated" :rippleColor="accentColor" @tap="onNavItemTap(menuItem)">
                            <Label col="0" class="menuIcon" :text="menuItem.icon" verticalAlignment="center" />
                            <Label col="1" class="menuText" :text="menuItem.title | titlecase" verticalAlignment="center" :active="menuItem.activated" />
                        </GridLayout>
                    </v-template>
                </CollectionView>
                <MDButton :text="$tc('stop')" row="2" v-show="sessionRunning" @tap="stopSession" />
                <StackLayout row="3" padding="10">
                    <Label @longPress="$switchDevMode" textWrap textAlignment="center" fontSize="13">
                        <Span :text="'Glasses data version: ' + (glassesDataUpdateDate ? date(glassesDataUpdateDate, 'L LT') : $tc('missing'))" />
                        <Span :text="'\n' + 'Map data version: ' + (mapDataUpdateDate ? date(mapDataUpdateDate, 'L LT') : $tc('missing'))" />
                        <Span :text="'\n' + 'GeoJSON version: ' + (geojsonDataUpdateDate ? date(geojsonDataUpdateDate, 'L LT') : $tc('missing'))" />
                        <Span :text="'\n' + 'App version: ' + (appVersion || '')" />
                    </Label>
                </StackLayout>
            </GridLayout>
        </Drawer>
    </Page>
</template>
<script lang="ts">
import { ApplicationSettings, ObservableArray } from '@akylas/nativescript';
import { isSimulator } from '@nativescript-community/extendedinfo';
import { MapBounds } from '@nativescript-community/ui-carto/core';
import { Drawer } from '@nativescript-community/ui-drawer';
import { confirm } from '@nativescript-community/ui-material-dialogs';
import { File, knownFolders, path } from '@nativescript/core/file-system';
import { GestureEventData } from '@nativescript/core/ui';
import Vue from 'nativescript-vue';
import { Component } from 'vue-property-decorator';
import BarAudioPlayerWidget from '~/components/BarAudioPlayerWidget.vue';
import { BgServiceMethodParams } from '~/components/BgServiceComponent';
import GlassesConnectionComponent from '~/components/GlassesConnectionComponent';
import GlassesIcon from '~/components/GlassesIcon.vue';
import MainMenu from '~/components/MainMenu.vue';
import { SessionEventData, SessionState, SessionStateEvent } from '~/handlers/GeoHandler';
import { Catch, off as appOff, on as appOn, off, on } from '~/utils';
import { bboxify } from '~/utils/geo';
import { getWorkingDir } from '~/utils/utils';
import { backgroundColor, mdiFontFamily, textColor } from '~/variables';
import { date } from '~/vue.filters';
import { ComponentIds } from '~/vue.prototype';

interface MessageItem {
    smallIcon: string;
    rightIcon: string;
    icon: string;
    id: number;
    title: string;
    message: string;
    rightMessage: string;
    progress: number;
    action?: {
        text: string;
        callback: Function;
    };
}
interface MenuItem {
    title: string;
    icon: string;
    component;
    url: string;
    activated: boolean;
}

@Component({
    components: {
        BarAudioPlayerWidget,
        MainMenu,
        GlassesIcon
    }
})
export default class App extends GlassesConnectionComponent {
    date = date;
    backgroundColor = backgroundColor;
    mdiFontFamily = mdiFontFamily;
    textColor = textColor;
    messages: ObservableArray<MessageItem> = new ObservableArray([
        // {
        //     id: 0,
        //     icon: '1',
        //     smallIcon: 'mdi-upload',
        //     rightIcon: `${10}%`,
        //     title: $tc('uploading_story'),
        //     message: `${fileSize(123589, { round: 1, pad: true })}`,
        //     rightMessage: `${formatDuration(dayjs.duration(120000), DURATION_FORMAT.SECONDS)}`,
        //     ongoing: true,
        //     indeterminate: false,
        //     progress: 10,
        //     action: {
        //         id: 'cancel',
        //         text: 'mdi-close',
        //         callback: () => {}
        //     }
        // }
    ]);

    stepIndex = 0;
    mShowMessages = false;
    messageItem: MessageItem;
    menuItem: MenuItem;

    appVersion = __APP_VERSION__ + '.' + __APP_BUILD_NUMBER__;
    glassesDataUpdateDate = ApplicationSettings.getNumber('GLASSES_DATA_LASTDATE', null);
    mapDataUpdateDate = ApplicationSettings.getNumber('MAP_DATA_LASTDATE', null);
    geojsonDataUpdateDate = ApplicationSettings.getNumber('GEOJSON_DATA_LASTDATE', null);
    needsImportOldSessionsOnLoaded = false;
    menuItems = new ObservableArray([
        // {
        //     title: this.$t('map'),
        //     icon: 'mdi-map',
        //     component: async () => (await import('~/components/Home')).default,
        //     url: ComponentIds.Activity,
        //     activated: false
        // },
        {
            title: this.$t('tracks'),
            icon: 'mdi-map-marker-path',
            component: async () => (await import('~/components/Tracks')).default,
            url: ComponentIds.Tracks,
            activated: false
        },
        // {
        //     title: this.$t('create_track'),
        //     icon: 'mdi-map-marker-distance',
        //     url: ComponentIds.Leaflet,
        //     activated: false
        // },
        {
            title: this.$t('settings'),
            icon: 'mdi-cogs',
            component: async () => (await import('~/components/Settings.vue')).default,
            url: ComponentIds.Settings,
            activated: false
        },
        {
            title: this.$t('images'),
            icon: 'mdi-image',
            component: async () => (await import('~/components/Images.vue')).default,
            url: ComponentIds.Images,
            activated: false
        }
    ]);
    public currentSessionState: SessionState = SessionState.STOPPED;

    constructor() {
        super();
        this.autoConnect = !PRODUCTION;
    }
    get drawer() {
        return this.getRef<Drawer>('drawer');
    }
    set showMessages(value) {
        if (this.mShowMessages !== value) {
            this.mShowMessages = value;
            (async () => {
                try {
                    await this.getRef('pager').animate({
                        height: value ? 60 : 0,
                        duration: 100
                    });
                } catch (er) {
                    console.log('error', er);
                    this.getRef('pager').height = value ? 60 : 0;
                }
            })();
        }
    }
    get showMessages() {
        return this.mShowMessages;
    }
    mounted() {
        super.mounted();
        this.$onAppMounted();
        on('appMessage', this.setMessage, this);
        on('appMessageUpdate', this.updateMessage, this);
        on('appMessageRemove', this.removeMessage, this);
        appOn('GLASSES_DATA_LASTDATE', this.onGlassesDataUpdateDate, this);
        appOn('MAP_DATA_LASTDATE', this.onMapDataUpdateDate, this);
        appOn('GEOJSON_DATA_LASTDATE', this.onGeojsonDataUpdateDate, this);
    }
    destroyed() {
        super.destroyed();
        off('appMessage', this.setMessage, this);
        off('appMessageUpdate', this.updateMessage, this);
        off('appMessageRemove', this.removeMessage, this);
        appOff('GLASSES_DATA_LASTDATE', this.onGlassesDataUpdateDate, this);
        appOff('MAP_DATA_LASTDATE', this.onMapDataUpdateDate, this);
        appOff('GEOJSON_DATA_LASTDATE', this.onGeojsonDataUpdateDate, this);
    }
    onLoaded() {
        Vue.prototype.$drawer = this.drawer;
    }
    onNavigatedTo() {
        // GC();
        console.log('onNavigatedTo', this.needsImportOldSessionsOnLoaded);
        if (this.dbHandler && this.dbHandler.started) {
            this.importDevSessions();
        } else {
            this.needsImportOldSessionsOnLoaded = true;
        }
        if (PRODUCTION || !isSimulator()) {
            this.$networkService.checkForMapDataUpdate();
        }
        if (!DISABLE_UPDATES && (PRODUCTION || !isSimulator())) {
            this.$networkService.checkForGlassesDataUpdate();
        }
    }
    onButtonTap(item: MessageItem) {
        item.action?.callback?.();
    }
    updateMessage(event) {
        try {
            const update = event.data;
            // DEV_LOG && console.log('updateMessage', update);
            const currentMessageIndex = this.messages.findIndex((d) => d.id === update.id);
            if (currentMessageIndex >= 0) {
                this.messages.setItem(currentMessageIndex, Object.assign(this.messages.getItem(currentMessageIndex), update));
            }
        } catch (error) {
            console.error('updateMessage', error, error.stack);
        }
    }
    setMessage(event) {
        try {
            const message = event.data;
            // DEV_LOG && console.log('setMessage', message);
            const currentMessageIndex = this.messages.findIndex((d) => d.id === message.id);
            if (currentMessageIndex >= 0) {
                this.messages.setItem(currentMessageIndex, message);
            } else {
                this.messages.push(message);
            }
            this.showMessages = this.messages.length > 0;
        } catch (error) {
            console.error('setMessage', error, error.stack);
        }
    }
    removeMessage(event) {
        try {
            const message = event.data;
            const currentMessageIndex = this.messages.findIndex((d) => d.id === message.id);
            if (currentMessageIndex >= 0) {
                this.messages.splice(currentMessageIndex, 1);
            }
            this.showMessages = this.messages.length > 0;
        } catch (error) {
            console.error('removeMessage', error, error.stack);
        }
    }
    onPlayerState(event) {
        const state = event.data;
        if (PRODUCTION && state === 'play') {
            const playingInfo = this.bluetoothHandler.playingInfo;
            if (playingInfo.showPlayBar === true) {
                this.stepIndex = 1;
            }
        } else {
            this.stepIndex = state === 'stopped' ? 0 : 1;
        }
    }
    setup(handlers: BgServiceMethodParams) {
        super.setup(handlers);
        if (!handlers.geoHandler) {
            return;
        }
        this.bluetoothHandlerOn('playback', this.onPlayerState);
        this.onPlayerState({ data: handlers.bluetoothHandler.playerState });
    }
    async onServiceStarted(handlers: BgServiceMethodParams) {
        this.geoHandlerOn(SessionStateEvent, this.onSessionStateEvent, this);
        console.log('onServiceStarted', this.needsImportOldSessionsOnLoaded);
        if (this.needsImportOldSessionsOnLoaded) {
            this.needsImportOldSessionsOnLoaded = false;
            this.importDevSessions();
        }
    }
    async importDevSessions() {
        try {
            let geojsonPath = path.join(getWorkingDir(false), 'map.geojson');
            if (PRODUCTION || !isSimulator()) {
                await this.$networkService.checkForGeoJSONUpdate(geojsonPath);
            }
            if (!File.exists(geojsonPath)) {
                geojsonPath = path.join(knownFolders.currentApp().path, 'assets/data/map.geojson');
            }
            if (!File.exists(geojsonPath)) {
                return;
            }
            // this.showLoading({ text: this.$t('importing_data'), progress: 0 });
            const file = File.fromPath(geojsonPath);
            const lastChecked = ApplicationSettings.getNumber('map.geojson_date', 0);
            if (file.lastModified.getTime() <= lastChecked) {
                return;
            }
            const importData = file.readTextSync();
            const data = JSON.parse(importData);
            const existing = (await this.dbHandler.trackRepository.searchItem()).map((t) => t.id);
            for (let index = 0; index < data.length; index++) {
                const d = data[index];
                const track = { ...d, id: (d.name || Date.now()) + '' };
                const geojson = bboxify(track.geometry);
                track.geometry = geojson as any;
                // track.geometry = reader.readFeatureCollection(JSON.stringify(d.geometry));
                track.bounds = new MapBounds<LatLonKeys>({ lat: geojson.bbox[3], lon: geojson.bbox[2] }, { lat: geojson.bbox[1], lon: geojson.bbox[0] });

                let newTrack;
                if (existing.indexOf(track.id) === -1) {
                    newTrack = await this.dbHandler.trackRepository.createItem(track);
                } else {
                    newTrack = await this.dbHandler.trackRepository.updateItem(track);
                }
                if (this.geoHandler.currentTrack?.id === newTrack.id) {
                    this.geoHandler.currentTrack = newTrack;
                }
            }
            ApplicationSettings.setNumber('map.geojson_date', file.lastModified.getTime());
        } catch (err) {
            this.showError(err);
        } finally {
            // this.hideLoading();
        }
    }
    protected onSessionStateEvent(e: SessionEventData) {
        this.currentSessionState = e.data.state;
    }

    get sessionRunning() {
        return this.currentSessionState !== SessionState.STOPPED;
    }

    onGlassesDataUpdateDate(event) {
        this.glassesDataUpdateDate = event.data;
    }
    onMapDataUpdateDate(event) {
        this.mapDataUpdateDate = event.data;
    }
    onGeojsonDataUpdateDate(event) {
        this.geojsonDataUpdateDate = event.data;
    }

    openDrawer() {
        this.drawer.open();
    }
    closeDrawer() {
        this.drawer && this.drawer.close();
    }
    @Catch()
    async onNavItemTap(item: MenuItem) {
        this.$navigateToUrl(item.url, { component: item.component });
    }

    @Catch()
    async onTap(command: string, ...args) {
        switch (command) {
            case 'connectGlasses': {
                if (!this.connectedGlasses) {
                    if (!this.bluetoothHandler.isEnabled()) {
                        await this.bluetoothHandler.enable();
                    }
                    this.pickGlasses();
                }
                break;
            }
        }
    }
    @Catch()
    onLongPress(command: string, args: GestureEventData) {
        if (__IOS__ && args?.ios?.state !== 3) {
            return;
        }
        switch (command) {
            case 'disconnectGlasses':
                if (this.connectedGlasses) {
                    confirm({
                        title: this.$tt('disconnect_glasses'),
                        message: this.$tc('disconnect_glasses_are_you_sure'),
                        okButtonText: this.$t('disconnect'),
                        cancelButtonText: this.$t('cancel')
                    }).then((result) => {
                        if (!!result) {
                            this.bluetoothHandler.disconnectGlasses(true);
                        }
                    });
                }
                break;
        }
    }

    @Catch()
    async stopSession() {
        const result = await confirm({
            title: this.$t('stop_session'),
            message: this.$t('stop_session_are_you_sure'),
            okButtonText: this.$t('stop'),
            cancelButtonText: this.$t('cancel')
        });
        this.geoHandler.stopSession(true);
    }
}
</script>