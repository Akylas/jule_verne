<template>
    <Page ref="page" id="history" :navigateUrl="navigateUrl">
        <GridLayout rows="auto,*,auto,auto,auto">
            <CActionBar showMenuIcon>
                <Image slot="center" col="1" src="~/assets/images/logos/fabrique.png" margin="10" horizontalAlignment="center" />
                <MDButton variant="text" class="actionBarButton" text="mdi-alpha-c-circle-outline" @tap="showPartners" />
            </CActionBar>
            <Image row="1" src="res://grenoble_full" stretch="aspectFill" height="70%" />
            <MDButton row="2" variant="outline" horizontalAlignment="center" width="80%" :text="$tc('still_adventure')" @tap="onTap('still_adventure')" />
            <MDButton row="3" variant="outline" horizontalAlignment="center" width="80%" :text="$tc('jules_verne_adventure')" @tap="onTap('jules_verne_adventure')" />
            <GridLayout row="4" height="80" marginTop="10">
                <GridLayout width="90%" rows="30,50" columns="*,*,*">
                    <Image src="res://activelook_logo" margin="2" :tintColor="textColor" />
                    <Image col="1" src="res://activemotion_logo" margin="2 6 2 6" :tintColor="textColor" />
                    <Image col="2" src="res://akylas_logo" margin="8" :tintColor="textColor" />
                    <Image row="1" colSpan="3" horizontalAlignment="left" marginLeft="20%" src="~/assets/images/logos/CEA-Grenoble.png" />
                    <Image row="1" colSpan="3" horizontalAlignment="right" marginRight="20%" src="~/assets/images/logos/logo-hexagone-22.png"/>
                </GridLayout>
            </GridLayout>
        </GridLayout>
    </Page>
</template>

<script lang="ts">
import { confirm } from '@nativescript-community/ui-material-dialogs';
import { Component } from 'vue-property-decorator';
import BgServiceComponent, { BgServiceMethodParams } from '~/components/BgServiceComponent';
import { GlassesDevice } from '~/handlers/bluetooth/GlassesDevice';
import { BLEBatteryEventData, BLEConnectionEventData, GlassesBatteryEvent, GlassesConnectedEvent, GlassesDisconnectedEvent } from '~/handlers/BluetoothHandler';
import { Catch } from '~/utils';
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
                const result = await this.$showModal((await import('~/components/Onboarding.vue')).default, { fullscreen: true, props: { forMap: false, canSkip: !PRODUCTION } });
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

    @Catch()
    async showPartners() {
        const component = (await import('~/components/Partners.vue')).default;
        return this.$navigateTo(component);
    }
}
</script>
