import { Screen } from '@nativescript/core';
import dayjs from 'dayjs';
import { Component } from 'vue-property-decorator';
import { DrawBitmapEvent, PlaybackEvent, PlaybackStartEvent, PlayingInfo } from '~/handlers/StoryHandler';
import { IMAGE_COLORMATRIX } from '~/vue.views';
import BgServiceComponent, { BgServiceMethodParams } from './BgServiceComponent';

const screenWidth = Screen.mainScreen.widthDIPs;

@Component({})
export default class AudioPlayerWidget extends BgServiceComponent {
    colorMatrix = IMAGE_COLORMATRIX;
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
    playingInfo: PlayingInfo = null;

    get progress() {
        return this.playingInfo ? (this.currentTime / (this.playingInfo.duration || 1)) * 100 : 0;
    }

    getTimeFromProgress(progress: number) {
        return this.playingInfo ? (this.playingInfo.duration || 1) * progress : 0;
    }
    setup(handlers: BgServiceMethodParams) {
        if (!handlers.storyHandler) {
            return;
        }
        this.storyHandlerOn(DrawBitmapEvent, this.onDrawImage);
        this.storyHandlerOn(PlaybackEvent, this.onPlayerState);
        this.storyHandlerOn(PlaybackStartEvent, this.onPlayerStart);

        this.playingInfo = handlers.storyHandler.playingInfo;
        this.onDrawImage({ bitmap: handlers.storyHandler.currentSentImageToDraw });
        this.onPlayerState({ data: handlers.storyHandler.playerState });
    }
    unsetup() {
        this.stopPlayerInterval();
        this.state = 'stopped';
    }

    formatDuration(data = 0) {
        return dayjs.duration(data).format('mm:ss');
    }

    playerStateInterval;

    onPlayerProgressInterval() {
        this.currentTime = this.storyHandler.playerCurrentTime;
    }
    startPlayerInterval() {
        if (!this.playerStateInterval) {
            this.playerStateInterval = setInterval(this.onPlayerProgressInterval.bind(this), 1000);
        }
        this.onPlayerProgressInterval();
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
            this.storyHandler.resumeStory();
        } else {
            this.storyHandler.pauseStory();
        }
    }
    stopPlayback() {
        this.storyHandler.stopPlayingLoop({ fade: true });
    }
}
