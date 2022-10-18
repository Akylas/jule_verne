<template>
    <GridLayout @tap="$emit('tap', $event)" :rippleColor="accentColor">
        <GridLayout margin="20" columns="auto,*">
            <Image borderRadius="8" :src="story.cover" stretch="aspectFill" />
            <Label col="1" margin="0 0 0 14" verticalTextAlignment="center">
                <Span fontSize="18" fontWeight="800" :text="story.title" />
                <Span fontSize="16" :text="'\n' + story.description" />
                <Span fontSize="14" :text="'\n' + '\n' + formatDuration(story.audioDuration)" />
            </Label>
            <Label col="1" verticalAlignment="bottom" horizontalAlignment="right" :backgroundColor="accentColor" height="24" fontSize="14" borderRadius="12" marginRight="10" padding="3 2 0 8">
                <Span :text="$tc('play') + ' '" fontWeight="500" verticalAlignment="center" />
                <Span :fontFamily="mdiFontFamily" text="mdi-play" fontSize="22" verticalAlignment="center" />
            </Label>
        </GridLayout>
        <AbsoluteLayout height="1" :backgroundColor="borderColor" margin="0 80 0 70" verticalAlignment="bottom" />
    </GridLayout>
</template>

<script lang="ts">
import dayjs from 'dayjs';
import { Component, Prop } from 'vue-property-decorator';
import Vue from 'nativescript-vue';
import { accentColor, borderColor, mdiFontFamily } from '~/variables';
import StoryListItem from './StoryListItem';

@Component({})
export default class StoryListItemComponent extends Vue {
    mdiFontFamily = mdiFontFamily;
    accentColor = accentColor;
    borderColor = borderColor;
    @Prop({}) story: StoryListItem;

    formatDuration(data = 0) {
        return dayjs.duration(data).format('m [minutes]');
    }
}
</script>
