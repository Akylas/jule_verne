<template>
    <Page ref="page" id="history" :navigateUrl="navigateUrl">
        <GridLayout rows="auto,*">
            <CActionBar showMenuIcon />
            <StackLayout row="1" horizontalAlignment="center" verticalAlignment="center" width="100%">
                <Image src="res://grenoble_full" stretch="aspectFill" height="70%" />
                <MDButton variant="outline" width="80%" :text="$tc('still_adventure')" @tap="onTap('still_adventure')" />
                <MDButton variant="outline" width="80%" :text="$tc('jules_verne_adventure')" @tap="onTap('jules_verne_adventure')" />
                <!-- <MDButton variant="outline" horizontalAlignment="center" :text="$tc('dev_mode')" @tap="onTap('dev_mode')" v-show="devMode" /> -->
            </StackLayout>
        </GridLayout>
    </Page>
</template>

<script lang="ts">
import { knownFolders } from '@akylas/nativescript';
import { confirm } from '@nativescript-community/ui-material-dialogs';
import { path } from '@nativescript/core/file-system';
import { Component } from 'vue-property-decorator';
import BgServiceComponent, { BgServiceMethodParams } from '~/components/BgServiceComponent';
import { GlassesDevice } from '~/handlers/bluetooth/GlassesDevice';
import { BLEBatteryEventData, BLEConnectionEventData, GlassesBatteryEvent, GlassesConnectedEvent, GlassesDisconnectedEvent } from '~/handlers/BluetoothHandler';
import { Catch, versionCompare } from '~/utils';
import { backgroundColor, mdiFontFamily, textColor } from '~/variables';
import { date } from '~/vue.filters';
import { ComponentIds } from '~/vue.prototype';

@Component({})
export default class MainMenu extends BgServiceComponent {
    navigateUrl = ComponentIds.MainMenu;
    date = date;
    mdiFontFamily = mdiFontFamily;
    backgroundColor = backgroundColor;
    textColor = textColor;
    bluetoothEnabled = true;
    gpsEnabled = true;
    nbDevModeTap = 0;
    devModeClearTimer;
    public connectedGlasses: GlassesDevice = null;
    public glassesBattery: number = 0;

    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }

    @Catch()
    async onTap(command: string, ...args) {
        switch (command) {
            case 'still_adventure': {
                await this.geoHandler.enableLocation();
                const result = await this.$showModal((await import('~/components/Onboarding.vue')).default, { fullscreen: true, props: { forMap: false } });
                if (result) {
                    const component = (await import('~/components/StillAdventure.vue')).default;
                    await this.$navigateTo(component);
                }
                break;
            }
            case 'jules_verne_adventure': {
                if (!this.geoHandler.currentTrack) {
                    const result = await confirm({
                        message: this.$tc('track_not_selected'),
                        okButtonText: this.$tc('select'),
                        cancelButtonText: this.$tc('cancel')
                    });
                    if (result) {
                        const component = (await import('~/components/Tracks.vue')).default;
                        await this.$navigateTo(component, {
                            props: { allowEdit: false }
                        });
                    }
                    return;
                }
                await this.geoHandler.askForSessionPerms();
                // await this.$navigateTo(component);
                const lastLocation = await this.$showModal((await import('~/components/Onboarding.vue')).default, { fullscreen: true, props: { canSkip: !PRODUCTION } });
                if (lastLocation) {
                    const component = await import('~/components/Map.vue');
                    this.$navigateTo(component.default);
                }
                break;
            }
            case 'dev_mode': {
                const component = (await import('~/components/Home.vue')).default;
                await this.$navigateTo(component);
                break;
            }
        }
    }
    onError(event) {
        this.showError(event.data);
    }
    setup(handlers: BgServiceMethodParams) {
        if (!handlers.geoHandler) {
            return;
        }
        this.geoHandlerOn('error', this.onError);
        this.bluetoothHandlerOn('error', this.onError);

        this.bluetoothHandlerOn(GlassesBatteryEvent, this.onGlassesBattery);
        this.bluetoothHandlerOn(GlassesConnectedEvent, this.onGlassesConnected);
        this.bluetoothHandlerOn(GlassesDisconnectedEvent, this.onGlassesDisconnected);

        if (handlers.bluetoothHandler.glasses) {
            this.onGlassesBattery({
                data: handlers.bluetoothHandler.glassesBattery
            } as any);
        }
        handlers.bluetoothHandler.isEnabled().then((r) => {
            this.bluetoothEnabled = r;
        });
    }
    onGlassesBattery(e: BLEBatteryEventData) {
        this.updateGlassesBattery(e.data);
    }
    updateGlassesBattery(value: number) {
        if (value >= 0) {
            this.glassesBattery = value;
        } else {
            this.glassesBattery = 0;
        }
    }
    onGlassesDisconnected(e: BLEConnectionEventData) {
        this.connectedGlasses = null;
        this.glassesBattery = -1;
    }
    onGlassesConnected(e: BLEConnectionEventData) {
        const glasses = (this.connectedGlasses = e.data as GlassesDevice);
    }

    // handleDevModeTap() {
    //     this.nbDevModeTap += 1;
    //     if (this.devModeClearTimer) {
    //         clearTimeout(this.devModeClearTimer);
    //         this.devModeClearTimer = null;
    //     }
    //     if (this.nbDevModeTap === 6) {
    //         this.$switchDevMode();
    //         this.devMode = this.$getDevMode();
    //         this.nbDevModeTap = 0;
    //         return;
    //     }
    //     this.devModeClearTimer = setTimeout(() => {
    //         this.devModeClearTimer = null;
    //         this.nbDevModeTap = 0;
    //     }, 500);
    // }
}
</script>
