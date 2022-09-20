<template>
    <GridLayout height="70" columns="70,*,auto,auto" backgroundColor="#000000dd">
        <Image ref="imageView" stretch="aspectFill" backgroundColor="black" :colorMatrix="colorMatrix" @tap="showFullscreenPlayer" />
        <Label margin="10" :text="playingInfo && playingInfo.name" row="1" col="1" fontSize="15" color="white" />

        <CanvasLabel margin="10" col="1" fontSize="10" color="lightgray">
            <CSpan :text="formatDuration(currentTime)" verticalAlignment="bottom" />
            <CSpan :text="playingInfo && formatDuration(playingInfo.duration)" textAlignment="right" verticalAlignment="bottom" />
        </CanvasLabel>
        <MDButton
            variant="text"
            color="white"
            col="2"
            horizontalAlignment="right"
            verticalAlignment="center"
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
            verticalAlignment="center"
            class="actionBarButton"
            v-show="playingInfo && playingInfo.canStop === true"
            text="mdi-stop"
            @tap="stopPlayback"
        />
        <MDProgress margin="0" padding="0" colSpan="4" :value="progress" maxValue=" 100" verticalAlignment="bottom" color="white" />
    </GridLayout>
</template>
<script lang="ts">
import { Component } from 'vue-property-decorator';
import { Catch } from '~/utils';
import { IMAGE_COLORMATRIX } from '~/vue.views';
import AudioPlayerWidget from './AudioPlayerWidget';

@Component({})
export default class BarAudioPlayerWidget extends AudioPlayerWidget {
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
