import { Composition, registerRoot } from 'remotion';
import { SlideshowVideo } from './video/SlideshowVideo';
import { SplitScreenVideo } from './video/SplitScreenVideo';
import { SplitSludge } from './video/SplitSludge';
import { KingsRanks } from './video/KingsRanks';
import { VersusVideo } from './video/VersusVideo';

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
      <Composition
        id="SplitSludge"
        component={SplitSludge}
        durationInFrames={1200}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          title:         'Consumer Awareness Preview',
          narration:     'The FTC just banned the hidden fee on car rentals. Here is what to do.',
          audioDuration: 40,
          wordTimings:   [],
          beats:         [],
          channelName:   'Distoir',
          hookText:      'THE FTC JUST BANNED THIS SCAM',
          clips:         [],
          sludgeClip:    null,
          hasMusic:      false,
          logo:          null,
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.ceil((props.audioDuration + 1) * FPS),
        })}
      />
      <Composition
        id="KingsRanks"
        component={KingsRanks}
        durationInFrames={960}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          items:        [],
          clips:        [],
          titleCard:    'TOP 5 FASTEST ANIMALS',
          channelName:  'Kings of Ranks',
          logo:         null,
          hasMusic:     false,
          durationSec:  32,
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.round((props.durationSec || 32) * FPS),
        })}
      />
      <Composition
        id="VersusVideo"
        component={VersusVideo}
        durationInFrames={900}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          question:    'WHICH IS STRONGER?',
          hook:        'HAVE YOU EVER THOUGHT…',
          a:           { name: 'Gorilla', fact: 'Lifts 10x its body weight.' },
          b:           { name: 'Grizzly Bear', fact: 'Bites through a bowling ball.' },
          winner:      'b',
          answer:      'The grizzly wins — pure size and bite force.',
          clips:       [],
          channelName: 'Kings of Ranks',
          logo:        null,
          hasMusic:    false,
          durationSec: 30,
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.round((props.durationSec || 30) * FPS),
        })}
      />
    </>
  );
};

registerRoot(RemotionRoot);
