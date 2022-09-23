<template>
    <Page ref="page" :actionBarHidden="true">
        <GridLayout backgroundColor="#000000" rows="auto,*, auto,auto,auto,auto">
            <CActionBar showMenuIcon modal backgroundColor="transparent" />
            <GridLayout row="1">
                <Image ref="imageView" stretch="aspectFit" backgroundColor="black" :colorMatrix="colorMatrix" />
            </GridLayout>

            <Label row="2" margin="10" :text="playingInfo && playingInfo.name" fontSize="15" color="white" fontWeight="800" />

            <MDProgress row="3" margin="5" :value="progress" maxValue=" 100" verticalAlignment="bottom" color="white" />
            <CanvasLabel row="4" margin="10" fontSize="10" color="lightgray" height="14">
                <CSpan :text="formatDuration(currentTime)" verticalAlignment="bottom" />
                <CSpan :text="playingInfo && formatDuration(playingInfo.duration)" textAlignment="right" verticalAlignment="bottom" />
            </CanvasLabel>
            <StackLayout row="5" orientation="horizontal" horizontalAlignment="center" marginBottom="10">
                <MDButton
                    variant="text"
                    color="white"
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
                    horizontalAlignment="right"
                    verticalAlignment="center"
                    class="actionBarButton"
                    v-show="playingInfo && playingInfo.canStop === true"
                    text="mdi-stop"
                    @tap="stopPlayback"
                />
            </StackLayout>
        </GridLayout>
    </Page>
</template>
<script lang="ts">
import { Component } from 'vue-property-decorator';
import AudioPlayerWidget from './AudioPlayerWidget';

@Component({})
export default class BarAudioPlayerWidget extends AudioPlayerWidget {
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
}
</script>
