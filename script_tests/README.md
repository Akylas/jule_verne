## Building openCV

Once you've run `yarn install` you need to build opencv for `@u4/opencv4nodejs` by doing:
`./node_modules/.bin/build-opencv rebuild`

## Building a dataset

### Prepare story data set

You need to prepare the story data first in `jules_verne/glasses_images/stories`
* create a new story folder
* create images in `images` folder. Images should be in jpg with size around 976x824
* put the story audio `audio.mp3`
* put the lottie composition `composition.json`

### building

Simply run `npm run buildDataSet -- --compress --crop --width=228 --id ${story_id}` from `script_tests` folder