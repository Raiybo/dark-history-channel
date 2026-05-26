import { Composition, registerRoot } from 'remotion';
import { SlideshowVideo } from './video/SlideshowVideo';

const FPS = 30;

export const RemotionRoot = () => {
  return (
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
        channelName:   'Did You Know',
        genre:         'didyouknow',
        hookText:      'DID YOU KNOW HONEY NEVER SPOILS',
        clips:         [],
        scenes:        [],
        hasMusic:      false,
      }}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.ceil((props.audioDuration + 1) * FPS),
      })}
    />
  );
};

registerRoot(RemotionRoot);
