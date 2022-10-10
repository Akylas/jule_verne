<template>
    <GridLayout height="70" columns="90,*,auto,auto" backgroundColor="#000000dd" margin="5" borderRadius="4">
        <Image ref="imageView" stretch="aspectFill" backgroundColor="black" @tap="showFullscreenPlayer" borderRadius="4 0 0 4"/>
        <CanvasLabel margin="10"  row="1" col="1" fontSize="17" color="white">
            <CSpan :fontFamily="mdiFontFamily" text="mdi-music" paddingTop="3"/>
            <CSpan :text="playingInfo && playingInfo.name" paddingLeft="20" />
        </CanvasLabel>
        <CanvasLabel margin="10 10 15 10"  col="1" fontSize="12" color="lightgray">
            <CSpan :text="formatDuration(currentTime)" verticalAlignment="bottom" />
            <CSpan :text="playingInfo && formatDuration(playingInfo.duration)" textAlignment="right" verticalAlignment="bottom" />
        </CanvasLabel>
        <MDButton
            variant="text"
            color="white"
            rippleColor="white"
            col="2"
            horizontalAlignment="right"
            verticalAlignment="bottom"
            class="actionBarButton"
            v-show="playingInfo && playingInfo.canPause !== false"
            :text="state === 'play' ? 'mdi-pause' : 'mdi-play'"
            @tap="togglePlayState"
        />
        <MDButton
            variant="text"
            color="white"
            col="3"
            horizontalAlignment="right"
            verticalAlignment="bottom"
            rippleColor="white"
            class="actionBarButton"
            v-show="playingInfo && playingInfo.canStop === true"
            text="mdi-stop"
            @tap="stopPlayback"
        />
        <MDProgress margin="0" padding="0" colSpan="4" :value="progress" maxValue=" 100" verticalAlignment="bottom" color="white"/>
    </GridLayout>
</template>
<script lang="ts">
import { Component } from 'vue-property-decorator';
import { Catch } from '~/utils';
import { mdiFontFamily } from '~/variables';
import AudioPlayerWidget from './AudioPlayerWidget';

@Component({})
export default class BarAudioPlayerWidget extends AudioPlayerWidget {
    mdiFontFamily = mdiFontFamily
    show() {}
    hide() {}

    @Catch()
    async showFullscreenPlayer() {
        const component = (await import('~/components/FullScreenPlayer.vue')).default;
        this.$showModal(component, {
            fullscreen: true
        });
    }
}
</script>
