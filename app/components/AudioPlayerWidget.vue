<template>
    <GridLayout :translateX="-screenWidth" margin="10" padding="10" height="110" borderRadius="4" rows="*,auto,auto" columns="106,*" backgroundColor="#00000088">
        <Image ref="imageView" stretch="aspectFill" rowSpan="4" backgroundColor="black" borderRadius="4" />
        <Label margin="5" :text="playingInfo.name" row="0" col="1" fontSize="15" color="white" />
        <MDProgress margin="5" row="1" col="1" :value="progress" maxValue=" 100" />
        <MDButton
            variant="text"
            color="white"
            col="1"
            horizontalAlignment="right"
            verticalAlignment="top"
            class="actionBarButton"
            v-show="playingInfo && playingInfo.canPause !== false"
            :text="state === 'play' ? 'mdi-pause' : 'mdi-play'"
            @tap="togglePlayState"
        />
        <CanvasLabel margin="5" col="1" row="2" fontSize="10" color="white" height="14">
            <CSpan :text="formatDuration(currentTime)" verticalAlignment="bottom" />
            <CSpan :text="formatDuration(playingInfo.duration)" textAlignment="right" verticalAlignment="bottom" />
        </CanvasLabel>
    </GridLayout>
</template>
<script lang="ts">
import { Screen } from '@nativescript/core';
import dayjs from 'dayjs';
import { Component } from 'vue-property-decorator';
import BgServiceComponent, { BgServiceMethodParams } from './BgServiceComponent';

const screenWidth = Screen.mainScreen.widthDIPs;

@Component({})
export default class AudioPlayerWidget extends BgServiceComponent {
    state: 'play' | 'pause' | 'stopped' = 'stopped';
    screenWidth = screenWidth;
    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }
    visible = false;
    currentTime = 0;
    playingInfo: { duration: number; name: string; cover?: string; canPause?: boolean } = { name: 'Story 4', duration: 2341 } as any;

    get progress() {
        return (this.currentTime / (this.playingInfo.duration || 1)) * 100;
    }
    setup(handlers: BgServiceMethodParams) {
        if (!handlers.geoHandler) {
            return;
        }
        this.bluetoothHandlerOn('drawBitmap', this.onDrawImage);
        this.bluetoothHandlerOn('playback', this.onPlayerState);
        this.bluetoothHandlerOn('playbackStart', this.onPlayerStart);

        this.playingInfo = handlers.bluetoothHandler.playingInfo;
        this.onPlayerState({ data: handlers.bluetoothHandler.playerState });
    }
    unsetup() {
        this.stopPlayerInterval();
        this.state = 'stopped';
    }

    formatDuration(data = 0) {
        return dayjs.duration(data).format('mm:ss');
    }

    playerStateInterval;

    startPlayerInterval() {
        if (!this.playerStateInterval) {
            this.playerStateInterval = setInterval(() => {
                this.currentTime = this.bluetoothHandler.playerCurrentTime;
            }, 1000);
        }
    }
    stopPlayerInterval() {
        if (this.playerStateInterval) {
            clearInterval(this.playerStateInterval);
            this.playerStateInterval = null;
        }
    }

    onPlayerStart(event) {
        this.state = 'play';
        this.playingInfo = event.data;
        this.$refs.imageView.nativeView.src = this.playingInfo.cover;
        console.log('onPlayerStart', this.playingInfo);
        this.startPlayerInterval();
        this.show();
    }
    onPlayerState(event) {
        if (event.data !== this.state) {
            this.state = event.data;
            if (this.state === 'play') {
                this.show();
                this.startPlayerInterval();
            } else {
                this.stopPlayerInterval();
            }
            if (this.state === 'stopped') {
                this.hide();
            }
        }
    }

    show() {
        if (this.visible) {
            return;
        }
        this.visible = true;
        this.nativeView.animate({
            translate: {
                x: 0,
                y: 0
            },
            duration: 200
        });
    }
    hide() {
        if (!this.visible) {
            return;
        }
        this.visible = false;
        this.nativeView.animate({
            translate: {
                x: -screenWidth,
                y: 0
            },
            duration: 200
        });
    }

    onDrawImage(event) {
        this.$refs.imageView.nativeView.src = event.bitmap;
    }

    togglePlayState() {
        if (this.state === 'pause') {
            this.bluetoothHandler.resumeStory();
        } else {
            this.bluetoothHandler.pauseStory();
        }
    }
}
</script>
