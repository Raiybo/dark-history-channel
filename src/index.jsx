import { Composition, registerRoot } from 'remotion';
import { SlideshowVideo } from './video/SlideshowVideo';
import { SplitScreenVideo } from './video/SplitScreenVideo';

const FPS = 30;

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="SlideshowVideo"
        component={SlideshowVideo}
        durationInFrames={1800}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          title:         'Did You Know Preview',
          narration:     'Did you know honey never spoils. Archaeologists found edible honey in ancient tombs.',
          audioDuration: 50,
          wordTimings:   [],
          beats:         [],
          channelName:   'Did You Know',
          genre:         'didyouknow',
          hookText:      'DID YOU KNOW HONEY NEVER SPOILS',
          clips:         [],
          scenes:        [],
          hasMusic:      false,
          logo:          null,
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.ceil((props.audioDuration + 1) * FPS),
        })}
      />
      <Composition
        id="SplitScreenVideo"
        component={SplitScreenVideo}
        durationInFrames={900}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          topClips:        [],
          satisfyingClips: [],
          hookText:        'THE MOST INSANE SOCCER MOMENTS',
          captionLines:    ['Wait for number 3', 'This one is unreal'],
          channelName:     'Distoir',
          logo:            null,
          hasMusic:        false,
          durationSec:     30,
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.round((props.durationSec || 30) * FPS),
        })}
      />
    </>
  );
};

registerRoot(RemotionRoot);
