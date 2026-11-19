import Threads from '../backgrounds/Threads.jsx';

/** Full-screen animated "Threads" background from React Bits (https://github.com/DavidHDev/react-bits). */
export default function Background() {
  return (
    <div className="bg-layer" aria-hidden="true">
      <Threads
        color={[0.74, 0.79, 1]}
        amplitude={1.3}
        distance={0.3}
        lineCount={70}
        thickness={0.5}
        brightness={1}
        speed={0.45}
        enableMouseInteraction
        mouseInfluence={0.18}
        opacity={0.55}
      />
    </div>
  );
}
