<template>
    <GridLayout :translateX="-screenWidth" margin="10" padding="10" height="110" borderRadius="4" rows="*,auto,auto" columns="106,*" backgroundColor="#00000088">
        <Image ref="imageView" stretch="aspectFill" rowSpan="4" backgroundColor="black" borderRadius="4" />
        <Label margin="5" :text="playingInfo && playingInfo.name" row="0" col="1" fontSize="15" color="white" />
        <MDProgress margin="5" row="1" col="1" :value="progress" maxValue=" 100" />
        <MDButton
            variant="text"
            color="white"
            rippleColor="white"
            col="1"
            horizontalAlignment="right"
            verticalAlignment="top"
            class="actionBarButton"
            v-show="playingInfo && playingInfo.canPause !== false"
            :text="state === 'play' ? 'mdi-pause' : 'mdi-play'"
            @tap="stopPlayback"
        />
        <CanvasLabel margin="5" col="1" row="2" fontSize="10" color="white" height="14">
            <Span :text="formatDuration(currentTime)" verticalAlignment="bottom" />
            <Span :text="playingInfo && formatDuration(playingInfo.duration)" textAlignment="right" verticalAlignment="bottom" />
        </CanvasLabel>
    </GridLayout>
</template>
<script lang="ts" src="./AudioPlayerWidget.ts" />
