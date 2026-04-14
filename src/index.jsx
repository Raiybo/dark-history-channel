import { Composition } from 'remotion';
import { DarkHistoryVideo } from './video/DarkHistoryVideo';

const FPS = 30;
const TITLE_FRAMES = 4 * FPS;
const OUTRO_FRAMES = 6 * FPS;

export const RemotionRoot = () => {
  return (
    <Composition
      id="DarkHistoryVideo"
      component={DarkHistoryVideo}
      durationInFrames={300}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{
        title: 'Dark Chronicles',
        chapters: [{ heading: 'Preview', narration: 'Preview narration text.' }],
        chapterDurations: [5],
        channelName: 'Dark Chronicles'
      }}
      calculateMetadata={({ props }) => {
        const chapterFrames = (props.chapterDurations || []).reduce(
          (sum, d) => sum + Math.ceil((d + 0.5) * FPS),
          0
        );
        return {
          durationInFrames: TITLE_FRAMES + chapterFrames + OUTRO_FRAMES
        };
      }}
    />
  );
};
