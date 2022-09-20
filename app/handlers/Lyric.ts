const getNow = Date.now.bind(Date);

const timeoutTools = {
    invokeTime: 0,
    animationFrameId: null,
    timeoutId: null,
    callback: null,
    thresholdTime: 200,

    run() {
        this.animationFrameId = requestAnimationFrame(() => {
            this.animationFrameId = null;
            const diff = this.invokeTime - getNow();
            if (diff > 0) {
                if (diff < this.thresholdTime) return this.run();
                return (this.timeoutId = setTimeout(() => {
                    this.timeoutId = null;
                    this.run();
                }, diff - this.thresholdTime));
            }

            this.callback(diff);
        });
    },
    start(callback = () => {}, timeout = 0) {
        this.callback = callback;
        this.invokeTime = getNow() + timeout;

        this.run();
    },
    clear() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
};

export default class Lyric {
    // lyric: string;
    delay = 0;
    // tags = {};
    lines: { time: number; text: string }[] = null;
    onPlay: Function;
    onSetLyric: Function;
    isPlay = false;
    curLineNum = 0;
    maxLine = 0;
    offset: number;
    isOffseted = false;
    _performanceTime = 0;
    _performanceOffsetTime = 0;
    constructor({ lines = [], offset = 0, onPlay = function (line: number, text: string) {}, onSetLyric = function () {} } = {}) {
        // this.lyric = lyric;
        this.onPlay = onPlay;
        this.onSetLyric = onSetLyric;
        this.offset = offset;
        this.setLines(lines);
    }
    // _initTag() {
    //     for (const tag in tagRegMap) {
    //         const matches = this.lyric.match(new RegExp(`\\[${tagRegMap[tag]}:([^\\]]*)]`, 'i'));
    //         this.tags[tag] = (matches && matches[1]) || '';
    //     }
    // }
    // _initLines() {
    //     this.lines = [];
    //     const lines = this.lyric.split('\n');
    //     for (let i = 0; i < lines.length; i++) {
    //         const line = lines[i].trim();
    //         const result = timeExp.exec(line);
    //         if (result) {
    //             const text = line.replace(timeExp, '').trim();
    //             if (text) {
    //                 const timeArr = RegExp.$1.split(':');
    //                 //@ts-ignore
    //                 if (timeArr.length < 3) timeArr.unshift(0);
    //                 if (timeArr[2].indexOf('.') > -1) {
    //                     timeArr.push(...timeArr[2].split('.'));
    //                     timeArr.splice(2, 1);
    //                 }
    //                 this.lines.push({
    //                     //@ts-ignore
    //                     time: parseInt(timeArr[0], 10) * 60 * 60 * 1000 + parseInt(timeArr[1], 10) * 60 * 1000 + parseInt(timeArr[2], 10) * 1000 + parseInt(timeArr[3] || 0, 10),
    //                     text
    //                 });
    //             }
    //         }
    //     }
    //     this.lines.sort((a, b) => a.time - b.time);
    //     this.maxLine = this.lines.length - 1;
    // }
    _currentTime() {
        return getNow() - this._performanceTime + this._performanceOffsetTime;
    }
    _findCurLineNum(curTime) {
        const length = this.lines.length;
        for (let index = 0; index < length; index++) if (curTime <= this.lines[index].time) return index === 0 ? 0 : index - 1;
        return length - 1;
    }

    _handleMaxLine() {
        this.onPlay(this.curLineNum, this.lines[this.curLineNum].text);
        this.pause();
    }

    _refresh() {
        this.curLineNum++;
        const curLine = this.lines[this.curLineNum];
        const nextLine = this.lines[this.curLineNum + 1];
        const currentTime = this._currentTime();
        const driftTime = currentTime - curLine.time;

        if (driftTime >= 0 || this.curLineNum === 0) {
            if (this.curLineNum === this.maxLine) return this._handleMaxLine();
            this.delay = nextLine.time - curLine.time - driftTime;
            if (this.delay > 0) {
                if (!this.isOffseted && this.delay >= this.offset) {
                    this._performanceOffsetTime += this.offset;
                    this.delay -= this.offset;
                    this.isOffseted = true;
                }
                timeoutTools.start(() => {
                    this._refresh();
                }, this.delay);
                this.onPlay(this.curLineNum, curLine.text);
                return;
            }
        }

        this.curLineNum = this._findCurLineNum(currentTime) - 1;
        this._refresh();
    }

    play(curTime = 0) {
        if (!this.lines.length) return;
        this.pause();
        this.isPlay = true;

        this._performanceOffsetTime = 0;
        this._performanceTime = getNow() - curTime;
        if (this._performanceTime < 0) {
            this._performanceOffsetTime = -this._performanceTime;
            this._performanceTime = 0;
        }

        this.curLineNum = this._findCurLineNum(curTime) - 1;

        this._refresh();
    }

    pause() {
        if (!this.isPlay) return;
        this.isPlay = false;
        this.isOffseted = false;
        timeoutTools.clear();
        // if (this.curLineNum === this.maxLine) return;
        // const curLineNum = this._findCurLineNum(this._currentTime());
        // if (this.curLineNum !== curLineNum) {
        //     this.curLineNum = curLineNum;
        //     this.onPlay(curLineNum, this.lines[curLineNum].text);
        // }
        return this._currentTime();
    }
    // setLyric(lyric) {
    //     if (this.isPlay) this.pause();
    //     this.lyric = lyric;
    //     this._init();
    // }
    setLines(lines) {
        if (this.isPlay) this.pause();
        this.lines = lines;
        this.maxLine = lines.length - 1;
        this.onSetLyric(this.lines);
    }
}
