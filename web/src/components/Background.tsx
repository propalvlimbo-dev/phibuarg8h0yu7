import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';

type AnyProps = Record<string, unknown>;
const load = (factory: () => Promise<{ default: unknown }>) =>
  lazy(factory as () => Promise<{ default: ComponentType<AnyProps> }>);

// Animated WebGL backgrounds from React Bits (https://github.com/DavidHDev/react-bits).
// Loaded lazily so only the selected one is downloaded.
const Threads = load(() => import('../backgrounds/Threads.jsx'));
const SoftAurora = load(() => import('../backgrounds/SoftAurora.jsx'));
const LineWaves = load(() => import('../backgrounds/LineWaves.jsx'));

export type BackgroundId = 'threads' | 'aurora' | 'waves';

export const BACKGROUNDS: { id: BackgroundId; label: string }[] = [
  { id: 'threads', label: 'Threads' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'waves', label: 'Waves' },
];

function Scene({ id }: { id: BackgroundId }) {
  switch (id) {
    case 'aurora':
      return (
        <SoftAurora
          color1="#dfe4ff"
          color2="#5865f2"
          speed={0.35}
          brightness={0.55}
          scale={1.4}
          enableMouseInteraction
          mouseInfluence={0.15}
          clickPulse={false}
          opacity={0.85}
        />
      );
    case 'waves':
      return (
        <LineWaves
          color1="#aab4ff"
          color2="#ffffff"
          color3="#7f8cff"
          speed={0.22}
          lineCount={56}
          lineWidth={1}
          glow={0.25}
          brightness={0.55}
          enableMouseInteraction
          mouseInfluence={1.2}
          clickRipple={false}
          opacity={0.55}
        />
      );
    default:
      return (
        <Threads
          color={[0.74, 0.79, 1]}
          amplitude={1.3}
          distance={0.3}
          lineCount={70}
          thickness={0.5}
          brightness={1}
          speed={0.45}
          enableMouseInteraction
          opacity={0.55}
        />
      );
  }
}

export default function Background({ id }: { id: BackgroundId }) {
  return (
    <div className="bg-layer" aria-hidden="true">
      <Suspense fallback={null}>
        <Scene key={id} id={id} />
      </Suspense>
    </div>
  );
}
