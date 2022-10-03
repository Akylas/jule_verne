<template>
    <Page ref="page" :actionBarHidden="true">
        <GridLayout rows="auto,auto,*, auto,auto,auto,auto">
            <CActionBar showMenuIcon modal textAlignment="center" :title="playingInfo && playingInfo.name" />
            <Label row="2" margin="10" :text="playingInfo && playingInfo.description" fontSize="20" textAlignment="center" />
            <!-- <GridLayout row="2" verticalAlignment="center"> -->
            <Image ref="imageView" stretch="aspectFit" backgroundColor="black" borderRadius="20" width="80%" row="2" verticalAlignment="bottom" marginBottom="30" :height="0.8 * screenWidth * 0.86" />
            <!-- </GridLayout> -->

            <MDSlider row="3" margin="10" :value="progress" minValue="0" maxValue=" 100" verticalAlignment="bottom" @valueChange="onSliderChange" />
            <CanvasLabel row="4" margin="0 20 20 20" fontSize="14" height="18">
                <CSpan :text="formatDuration(currentTime)" verticalAlignment="bottom" />
                <CSpan :text="playingInfo && formatDuration(playingInfo.duration)" textAlignment="right" verticalAlignment="bottom" paddingRight="2" />
            </CanvasLabel>
            <StackLayout row="5" orientation="horizontal" horizontalAlignment="center" marginBottom="10">
                <MDButton
                    horizontalAlignment="right"
                    verticalAlignment="center"
                    class="playerButton"
                    v-show="playingInfo && playingInfo.canPause !== false"
                    :text="state === 'play' ? 'mdi-pause' : 'mdi-play'"
                    @tap="togglePlayState"
                />
                <MDButton horizontalAlignment="right" verticalAlignment="center" class="playerButton" v-show="playingInfo && playingInfo.canStop === true" text="mdi-stop" @tap="stopPlayback" />
            </StackLayout>
        </GridLayout>
    </Page>
</template>
<script lang="ts">
import { Screen } from '@nativescript/core/platform';
import { throttle } from 'helpful-decorators';
import { Component } from 'vue-property-decorator';
import AudioPlayerWidget from './AudioPlayerWidget';

@Component({})
export default class BarAudioPlayerWidget extends AudioPlayerWidget {
    screenWidth = Screen.mainScreen.widthDIPs;
    screenHeight = Screen.mainScreen.heightDIPs;
    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }
    show() {}
    hide() {}
    stopPlayback() {
        this.bluetoothHandler.stopPlayingLoop({ fade: true });
        this.$modal.close();
    }

    @throttle(500)
    onSliderChange(e) {
        const value = e.value;
        const actualProgress = Math.round(this.getTimeFromProgress(value / 100));
        if (Math.floor(value) === Math.floor(this.progress)) {
            return;
        }
        this.bluetoothHandler.setPlayerTimestamp(actualProgress);

        this.onPlayerProgressInterval();
    }
}
</script>
