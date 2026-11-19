import { useEffect, useRef, useState } from 'react';
import type { AnimationEvent, CSSProperties, ReactNode, Ref } from 'react';
import { LENS_BODY, LENS_HANDLE, LENS_VIEWBOX } from './Logo';

// Official Discord "Clyde" mark (viewBox 0 0 127.14 96.36). Eyes are holes (evenodd).
const CLYDE =
  'M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z';

export type Spin = 'none' | 'once' | 'loop';

type Props = {
  /** Width of the mark in px; everything else (depth, perspective, edge) scales with it. */
  size: number;
  /** 'once' = one smooth turn (hover); 'loop' = loading spin; 'none' = at rest. */
  spin: Spin;
  onTurnEnd?: () => void;
  stageRef?: Ref<HTMLSpanElement>;
  className?: string;
  style?: CSSProperties;
};

function makeSlices(size: number) {
  // Thick enough to read as a solid object, slices close enough that the stack never looks combed.
  const depth = size * (size > 60 ? 0.12 : 0.15);
  const count = Math.max(13, Math.min(40, Math.round(depth / 0.36)));
  return {
    depth,
    slices: Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1); // 0 = back, 1 = front
      return { z: (t - 0.5) * depth, kind: i === count - 1 ? 'front' : i === 0 ? 'back' : 'side' };
    }),
  };
}

function Extruded({ face, slices, children }: { face: 'clyde' | 'lens'; slices: ReturnType<typeof makeSlices>['slices']; children: ReactNode }) {
  const viewBox = face === 'clyde' ? '0 0 127.14 96.36' : LENS_VIEWBOX;
  return (
    <span className={`logo3d-face face-${face}`}>
      {slices.map((s, i) => (
        <svg key={i} className={`logo3d-slice slice-${s.kind}`} viewBox={viewBox} style={{ '--z': `${s.z}px` } as CSSProperties}>
          {children}
        </svg>
      ))}
    </span>
  );
}

/** Extruded 3D Discord mark; its back face is the GirlScan magnifier. */
export default function Logo3D({ size, spin, onTurnEnd, stageRef, className, style }: Props) {
  const { depth, slices } = makeSlices(size);
  const spinRef = useRef<HTMLSpanElement>(null);

  // Keep the loading-loop class on until we've captured the current angle, then ease to rest.
  const [looping, setLooping] = useState(spin === 'loop');
  if (spin === 'loop' && !looping) setLooping(true);

  useEffect(() => {
    const el = spinRef.current;
    if (!el || spin === 'loop' || !looping) return;
    const angle = parseFloat(getComputedStyle(el).getPropertyValue('--a')) || 0;
    // Just past a full turn: ease back; otherwise finish the turn forwards.
    const rest = angle % 360 < 25 ? angle - (angle % 360) : Math.ceil(angle / 360) * 360;
    el.style.setProperty('--a', `${angle}deg`);
    el.classList.remove('is-looping');
    const finish = () => {
      el.style.transition = 'none';
      el.style.removeProperty('--a');
      setLooping(false);
    };
    if (Math.abs(rest - angle) < 0.5) {
      finish();
      return;
    }
    void el.offsetWidth;
    el.style.transition = `--a ${0.35 + (Math.abs(rest - angle) / 360) * 0.6}s cubic-bezier(0.22, 1, 0.36, 1)`;
    el.style.setProperty('--a', `${rest}deg`);
    const timer = window.setTimeout(finish, 1100);
    el.addEventListener('transitionend', finish, { once: true });
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener('transitionend', finish);
    };
  }, [spin, looping]);

  const onAnimationEnd = (e: AnimationEvent<HTMLSpanElement>) => {
    if (e.target === e.currentTarget && e.animationName === 'logo-turn') onTurnEnd?.();
  };

  const cls = ['logo3d', spin === 'once' ? 'is-spinning' : '', looping ? 'is-looping' : ''].filter(Boolean).join(' ');

  return (
    <span
      ref={stageRef}
      className={`logo3d-stage ${className ?? ''}`}
      style={{ '--s': `${size}px`, '--depth': `${depth}px`, ...style } as CSSProperties}
      aria-hidden="true"
    >
      <span ref={spinRef} className={cls} onAnimationEnd={onAnimationEnd}>
        <Extruded face="clyde" slices={slices}>
          <path d={CLYDE} fillRule="evenodd" fill="currentColor" />
        </Extruded>
        <Extruded face="lens" slices={slices}>
          <path d={LENS_BODY} fillRule="evenodd" fill="currentColor" />
          <path d={LENS_HANDLE} stroke="currentColor" strokeWidth="18" strokeLinecap="round" fill="none" />
        </Extruded>
        {/* Solid side wall shown while edge-on: hides the slice stack and the face swap. */}
        <span className="logo3d-edge" />
      </span>
    </span>
  );
}
