import { Audio, staticFile } from 'remotion';
import { ShortsBackground } from './components/ShortsBackground';
import { ShortsSubtitles } from './components/ShortsSubtitles';
import { ShortsHeader } from './components/ShortsHeader';
import { ShortsFooter } from './components/ShortsFooter';

export const ShortsVideo = ({ title, narration, audioDuration, channelName }) => {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#080808' }}>
      <ShortsBackground />
      <Audio src={staticFile('audio/narration.mp3')} />
      <ShortsHeader channelName={channelName} />
      <ShortsSubtitles narration={narration} audioDuration={audioDuration} />
      <ShortsFooter title={title} />
    </div>
  );
};
