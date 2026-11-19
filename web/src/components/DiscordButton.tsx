import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
import type { Ref } from 'react';
import Logo3D from './Logo3D';

type Props = {
  label: string;
  ariaLabel?: string;
  /** Receives the on-screen rect of the logo so the login transition can fly it from there. */
  onClick: (logoRect: DOMRect) => void;
  /** Hide the button's own logo while the flying copy is on screen. */
  logoHidden?: boolean;
  logoRef?: Ref<HTMLSpanElement>;
};

export default function DiscordButton({ label, ariaLabel, onClick, logoHidden, logoRef }: Props) {
  const [spinning, setSpinning] = useState(false);
  const localLogo = useRef<HTMLSpanElement | null>(null);

  const setLogo = (el: HTMLSpanElement | null) => {
    localLogo.current = el;
    if (typeof logoRef === 'function') logoRef(el);
    else if (logoRef) (logoRef as { current: HTMLSpanElement | null }).current = el;
  };

  // One full turn per hover; a turn in progress always finishes (never restarts mid-way).
  const startSpin = () => setSpinning(true);

  return (
    <motion.button
      className="discord"
      type="button"
      onClick={() => {
        if (!localLogo.current) return;
        setSpinning(false);
        onClick(localLogo.current.getBoundingClientRect());
      }}
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
        <Logo3D
          size={30}
          spin={spinning && !logoHidden ? 'once' : 'none'}
          onTurnEnd={() => setSpinning(false)}
          stageRef={setLogo}
          style={{ opacity: logoHidden ? 0 : 1 }}
        />
        <span className="discord-label">{label}</span>
      </span>
    </motion.button>
  );
}
