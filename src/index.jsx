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
        title: 'Chronicles Preview',
        narration: 'This is a preview of the Chronicles channel video system.',
        audioDuration: 50,
        channelName: 'Chronicles',
        genre: 'stoic',
        hookText: 'MOST PEOPLE NEVER LEARN THIS',
        imagePaths: [],
        scenes: [],
      }}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.ceil((props.audioDuration + 1) * FPS),
      })}
    />
  );
};

registerRoot(RemotionRoot);
