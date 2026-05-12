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
        title:         'Distoir Preview',
        narration:     'This is Distoir. Where history meets optimization.',
        audioDuration: 50,
        channelName:   'Distoir',
        genre:         'future',
        hookText:      'HISTORY CHANGED EVERYTHING',
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
