import { motion, useReducedMotion } from 'framer-motion';
import { useId, useRef, useState } from 'react';
import type { AnimationEvent } from 'react';

type Props = {
  label: string;
  ariaLabel?: string;
  onClick: () => void;
};

// Official Discord "Clyde" mark (viewBox 0 0 127.14 96.36). Eyes are holes (evenodd).
const CLYDE =
  'M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z';
const VIEWBOX = '0 0 127.14 96.36';
const MID = 63.57;

/** One half of Clyde, extruded into a few stacked layers so it has thickness while spinning. */
function Half({ side, clipId }: { side: 'l' | 'r'; clipId: string }) {
  return (
    <span className={`clyde-half half-${side}`}>
      {(['back', 'edge', 'front'] as const).map((layer) => (
        <svg key={layer} className={`clyde-layer layer-${layer}`} viewBox={VIEWBOX}>
          <path d={CLYDE} fillRule="evenodd" clipPath={`url(#${clipId}-${side})`} />
        </svg>
      ))}
    </span>
  );
}

export default function DiscordButton({ label, ariaLabel, onClick }: Props) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const [spinning, setSpinning] = useState(false);
  const stopAfterTurn = useRef(false);

  const startSpin = () => {
    if (reduceMotion) return;
    stopAfterTurn.current = false;
    setSpinning(true);
  };
  // Let the current turn finish so the logo never snaps back mid-rotation.
  const requestStop = () => {
    stopAfterTurn.current = true;
  };
  const onIteration = (e: AnimationEvent<HTMLSpanElement>) => {
    if (e.target === e.currentTarget && stopAfterTurn.current) setSpinning(false);
  };

  return (
    <motion.button
      className="discord"
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      onHoverStart={startSpin}
      onHoverEnd={requestStop}
      onFocus={startSpin}
      onBlur={requestStop}
      whileHover={reduceMotion ? undefined : { scale: 1.06 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18, mass: 0.9 }}
    >
      <span className="discord-body" aria-hidden="true">
        <span className="discord-shine" />
      </span>
      <span className="discord-content">
        <span className="clyde-wrap" aria-hidden="true">
          <svg className="clyde-defs" width="0" height="0" aria-hidden="true">
            <defs>
              <clipPath id={`${uid}-l`}>
                <rect x="0" y="0" width={MID} height="96.36" />
              </clipPath>
              <clipPath id={`${uid}-r`}>
                <rect x={MID} y="0" width={MID} height="96.36" />
              </clipPath>
            </defs>
          </svg>
          <span className={`clyde3d ${spinning ? 'is-spinning' : ''}`} onAnimationIteration={onIteration}>
            <Half side="l" clipId={uid} />
            <Half side="r" clipId={uid} />
            <svg className="clyde-eyes3d" viewBox={VIEWBOX}>
              <ellipse cx="42.45" cy="53" rx="11.6" ry="12.9" />
              <ellipse cx="84.69" cy="53" rx="11.6" ry="12.9" />
            </svg>
          </span>
        </span>
        <span className="discord-label">{label}</span>
      </span>
    </motion.button>
  );
}
