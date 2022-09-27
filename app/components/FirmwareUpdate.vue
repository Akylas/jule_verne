<template>
    <Page ref="page" :navigateUrl="navigateUrl" :enableSwipeBackNavigation="!updatingFirmware" @navigatingTo="onNavigatingTo" @navigatingFrom="onNavigatingFrom">
        <StackLayout>
            <CActionBar :title="$t('update')" :disableBackButton="updatingFirmware" :glasses="connectedGlasses" :battery="glassesBattery" />
            <GridLayout rows="auto, *, auto, auto" height="100%" backgroundColor="#EDEDED">
                <StackLayout row="0">
                    <StackLayout class="settings-section">
                        <GridLayout class="settings-section-holder" columns="*,auto" rows="30,20">
                            <Label col="0" row="0" class="settings-section-title" :text="$t('glasses') | uppercase" />
                            <Label col="0" row="1" class="settings-section-desc" :text="glassesName" />
                        </GridLayout>
                    </StackLayout>
                    <StackLayout class="settings-section">
                        <GridLayout class="settings-section-holder" columns="*,auto" rows="30,20">
                            <Label col="0" row="0" class="settings-section-title" :text="$t('file') | uppercase" />
                            <Label col="0" row="1" class="settings-section-desc" :text="fileName" />
                            <Label col="1" row="1" class="settings-section-desc" :text="fileSize" horizontalAlignment="right" />
                        </GridLayout>
                    </StackLayout>
                    <Label margin="10 20 0 10" fontSize="16" color="#696969" :text="$t('firmware_update_desc')" textAlignment="center" verticalAlignment="center" textWrap />
                    <StackLayout margin="0 10 0 10">
                        <Label marginTop="10" fontSize="24" :color="accentColor" :text="Math.round(currentProgress) + '%'" textAlignment="center" verticalAlignment="center" />
                        <MDProgress marginTop="10" :value="currentProgress" maxValue="100" :color="accentColor" />
                    </StackLayout>
                </StackLayout>
                <TextView row="1" :text="firmwareRunLog" fontSize="10" editable="false" backgroundColor="#EDEDED" v-if="devMode" />
                <MDButton :isEnabled="!updatingFirmware" marginBottom="20" row="2" :text="$t('update_glasses')" @tap="onTap('sendUpdate')" />
                <MDButton v-if="devMode" marginBottom="20" row="3" :text="$t('reboot_glasses')" @tap="onTap('reboot')" />
            </GridLayout>
        </StackLayout>
    </Page>
</template>
<script lang="ts">
import { ReadResult } from '@nativescript-community/ble';
import * as application from '@nativescript/core/application';
import { File } from '@nativescript/core/file-system';
import { Component, Prop } from 'vue-property-decorator';
import BgServiceComponent, { BgServiceMethodParams } from '~/components/BgServiceComponent';
import { GlassesDevice } from '~/handlers/bluetooth/GlassesDevice';
import {
    BLEBatteryEventData,
    BLEConnectionEventData,
    BluetoothHandler,
    GlassesBatteryEvent,
    GlassesConnectedEvent,
    GlassesDisconnectedEvent,
    SPOTA_GPIO_MAP_UUID,
    SPOTA_MEM_DEV_UUID,
    SPOTA_PATCH_DATA_UUID,
    SPOTA_SERVICE_UUID,
    SPOTA_SERV_STATUS_UUID,
    SUOTA_L2CAP_PSM_UUID,
    SUOTA_MTU_UUID,
    SUOTA_PATCH_DATA_CHAR_SIZE_UUID,
    SUOTA_VERSION_UUID,
    bluetooth
} from '~/handlers/BluetoothHandler';
import { GeoHandler } from '~/handlers/GeoHandler';
import { confirm } from '~/utils/dialogs';
import { SuotaCharacteristic, getUint32 } from '../handlers/bluetooth/SuotaCharacteristic';
import filesize from 'filesize';
import { ComponentIds } from '~/vue.prototype';
import { concatBuffers } from '~/handlers/Message';
import { Catch } from '~/utils';
import FirmwareUpdateComponent from './FirmwareUpdateComponent';

const TAG = '[FirmwareUpdate]';

@Component({})
export default class FirmwareUpdate extends FirmwareUpdateComponent {
    navigateUrl = ComponentIds.Firmware;
    @Prop({}) firmwareFile: File;

    get glassesName() {
        return this.connectedGlasses && this.connectedGlasses.localName;
    }
    get fileName() {
        return this.firmwareFile && this.firmwareFile.name;
    }
    get fileSize() {
        return this.firmwareFile && filesize(this.firmwareFile.size);
    }
    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }
    setup(handlers: BgServiceMethodParams) {
        super.setup(handlers);
        if (!handlers.geoHandler || !handlers.bluetoothHandler) {
            return;
        }
        this.bluetoothHandlerOn(GlassesDisconnectedEvent, this.onGlassesDisconnected);
        this.bluetoothHandlerOn(GlassesConnectedEvent, this.onGlassesConnected);
    }
    onGlassesConnected(e: BLEConnectionEventData) {
        super.onGlassesConnected(e);
        this.close();
    }
    onGlassesDisconnected(e: BLEConnectionEventData) {
        super.onGlassesDisconnected(e);
        this.close();
    }

    @Catch()
    onTap(command: string, event?) {
        switch (command) {
            case 'sendUpdate':
                this.updateFirmware(this.firmwareFile);
                break;
            case 'reboot':
                this.rebootGlasses();
                break;
        }
    }
    close() {
        this.$navigateBackIfUrl(this.navigateUrl);
    }
}
</script>
