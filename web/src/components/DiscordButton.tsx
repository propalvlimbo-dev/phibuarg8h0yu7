import { motion } from 'framer-motion';
import { useState } from 'react';
import type { AnimationEvent, CSSProperties, ReactNode } from 'react';
import { LENS_BODY, LENS_HANDLE, LENS_VIEWBOX } from './Logo';

type Props = {
  label: string;
  ariaLabel?: string;
  onClick: () => void;
};

// Official Discord "Clyde" mark (viewBox 0 0 127.14 96.36). Eyes are holes (evenodd).
const CLYDE =
  'M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z';

/** Extrusion: identical slices stacked along Z give the flat mark real thickness. */
const DEPTH = 4.5; // px
const SLICES = 13;
const slices = Array.from({ length: SLICES }, (_, i) => {
  const t = i / (SLICES - 1); // 0 = back, 1 = front
  return { z: (t - 0.5) * DEPTH, kind: i === SLICES - 1 ? 'front' : i === 0 ? 'back' : 'side' };
});

function Extruded({ face, children }: { face: 'clyde' | 'lens'; children: ReactNode }) {
  const viewBox = face === 'clyde' ? '0 0 127.14 96.36' : LENS_VIEWBOX;
  return (
    <span className={`logo3d-face face-${face}`}>
      {slices.map((s, i) => (
        <svg
          key={i}
          className={`logo3d-slice slice-${s.kind}`}
          viewBox={viewBox}
          style={{ '--z': `${s.z}px` } as CSSProperties}
        >
          {children}
        </svg>
      ))}
    </span>
  );
}

export default function DiscordButton({ label, ariaLabel, onClick }: Props) {
  const [spinning, setSpinning] = useState(false);

  // One full turn per hover; a turn in progress always finishes (never restarts mid-way).
  const startSpin = () => setSpinning(true);
  const onTurnEnd = (e: AnimationEvent<HTMLSpanElement>) => {
    if (e.target === e.currentTarget) setSpinning(false);
  };

  return (
    <motion.button
      className="discord"
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      onHoverStart={startSpin}
      onFocus={startSpin}
      whileHover={{ scale: 1.05, transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] } }}
      whileTap={{ scale: 0.98, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="discord-body" aria-hidden="true">
        <span className="discord-shine" />
      </span>
      <span className="discord-content">
        <span className="logo3d-stage" aria-hidden="true">
          <span className={`logo3d ${spinning ? 'is-spinning' : ''}`} onAnimationEnd={onTurnEnd}>
            {/* Front: Discord. Back (revealed mid-turn): the GirlScan magnifier. */}
            <Extruded face="clyde">
              <path d={CLYDE} fillRule="evenodd" fill="currentColor" />
            </Extruded>
            <Extruded face="lens">
              <path d={LENS_BODY} fillRule="evenodd" fill="currentColor" />
              <path d={LENS_HANDLE} stroke="currentColor" strokeWidth="18" strokeLinecap="round" fill="none" />
            </Extruded>
            {/* Solid side wall shown while edge-on: hides the layer stack and the face swap. */}
            <span className="logo3d-edge" />
          </span>
        </span>
        <span className="discord-label">{label}</span>
      </span>
    </motion.button>
  );
}
