import { Sequence } from 'remotion';
import { Background } from './components/Background';
import { TitleScene } from './components/TitleScene';
import { ChapterScene } from './components/ChapterScene';
import { OutroScene } from './components/OutroScene';

const FPS = 30;
const TITLE_FRAMES = 4 * FPS;
const OUTRO_FRAMES = 6 * FPS;

export const DarkHistoryVideo = ({ title, chapters, chapterDurations, channelName }) => {
  // Build chapter timing
  const chapterSequences = chapters.reduce((acc, chapter, i) => {
    const prev = acc[acc.length - 1];
    const startFrame = prev ? prev.startFrame + prev.durationFrames : TITLE_FRAMES;
    const durationFrames = Math.ceil(((chapterDurations[i] || 5) + 0.5) * FPS);
    return [...acc, { chapter, i, startFrame, durationFrames }];
  }, []);

  const totalChapterFrames = chapterSequences.reduce((s, c) => s + c.durationFrames, 0);
  const outroStart = TITLE_FRAMES + totalChapterFrames;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#080404' }}>
      <Background />

      <Sequence from={0} durationInFrames={TITLE_FRAMES}>
        <TitleScene title={title} channelName={channelName} />
      </Sequence>

      {chapterSequences.map(({ chapter, i, startFrame, durationFrames }) => (
        <Sequence key={i} from={startFrame} durationInFrames={durationFrames}>
          <ChapterScene
            chapter={chapter}
            chapterIndex={i}
            totalChapters={chapters.length}
            audioSrc={`audio/chapter_${i}.mp3`}
          />
        </Sequence>
      ))}

      <Sequence from={outroStart} durationInFrames={OUTRO_FRAMES}>
        <OutroScene channelName={channelName} />
      </Sequence>
    </div>
  );
};
