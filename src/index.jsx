import { Composition, registerRoot } from 'remotion';
import { ShortsVideo } from './video/ShortsVideo';

const FPS = 30;

export const RemotionRoot = () => {
  return (
    <Composition
      id="ShortsVideo"
      component={ShortsVideo}
      durationInFrames={1800}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{
        title: 'How WiFi Actually Works #Shorts',
        narration: 'WiFi is sigma physics no cap.',
        audioDuration: 60,
        channelName: 'HowItWorks'
      }}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.ceil((props.audioDuration + 1) * FPS)
      })}
    />
  );
};

registerRoot(RemotionRoot);
