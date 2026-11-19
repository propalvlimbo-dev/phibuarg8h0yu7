import { useCallback, useEffect, useRef, useState } from 'react';
import type { Server } from '../servers';
import ServerCard from './ServerCard';

type Props = {
  servers: Server[];
  active: number;
  onActiveChange: (index: number) => void;
  revealed: boolean;
};

/*
 * Endless 3D cylinder of servers.
 * Position `pos` is measured in slots (float). Slot k shows server k mod N, so the cylinder is always full
 * and can be spun forever in either direction, however few servers there are. Only the front half is
 * rendered; cards fade and blur smoothly as they turn away to the sides.
 */
const SPRING_K = 52;
const SPRING_C = 2 * Math.sqrt(SPRING_K) * 0.9;
const RADIUS = 1.9; // cylinder radius, in card widths
const GAP = 1.1; // distance between neighbouring card centres along the surface, in card widths
const MAX_ANGLE = 84; // cards beyond this angle (towards the back) are hidden
const SLOTS_EACH_SIDE = 4; // rendered slots left and right of the front one
const AUTOPLAY_MS = 5200;
const IDLE_MS = 7000;

const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export default function ServerOrbit({ servers, active, onActiveChange, revealed }: Props) {
  const count = servers.length;

  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef(new Map<number, HTMLElement>());
  const [base, setBase] = useState(0); // front slot (integer)
  const baseRef = useRef(0);
  const activeRef = useRef(active);
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;

  const sim = useRef({
    pos: -0.45,
    target: -0.45,
    vel: 0,
    dragging: false,
    pointerId: -1,
    startX: 0,
    lastX: 0,
    lastT: 0,
    moved: 0,
    width: 320,
    tiltX: 0,
    tiltY: 0,
    aimX: 0,
    aimY: 0,
    lastInput: performance.now(),
    hovering: false,
  });

  // Settle into place once revealed.
  useEffect(() => {
    if (revealed) sim.current.target = 0;
  }, [revealed]);

  // Card width drives the cylinder size.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const first = slotRefs.current.values().next().value as HTMLElement | undefined;
      if (first) sim.current.width = first.offsetWidth;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [count]);

  // Animation loop: spring physics + direct DOM transforms (React only re-renders when the front slot changes).
  useEffect(() => {
    if (!count) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = sim.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!s.dragging) {
        const sub = 3;
        const h = dt / sub;
        for (let i = 0; i < sub; i++) {
          const acc = SPRING_K * (s.target - s.pos) - SPRING_C * s.vel;
          s.vel += acc * h;
          s.pos += s.vel * h;
        }
      }

      s.tiltX += (s.aimX - s.tiltX) * (1 - Math.exp(-dt * 4));
      s.tiltY += (s.aimY - s.tiltY) * (1 - Math.exp(-dt * 4));

      const W = s.width;
      const R = W * RADIUS;
      const step = 2 * Math.asin(Math.min(0.95, (W * GAP) / (2 * R))); // radians between slots

      slotRefs.current.forEach((el, k) => {
        const theta = (k - s.pos) * step;
        const deg = (theta * 180) / Math.PI;
        const t = Math.abs(deg) / MAX_ANGLE; // 0 front … 1 edge
        const x = Math.sin(theta) * R;
        const z = (Math.cos(theta) - 1) * R;
        const opacity = 1 - smoothstep(0.3, 1, t);
        const blur = t < 0.32 ? 0 : Math.round(Math.pow((t - 0.32) / 0.68, 1.6) * 7 * 2) / 2;
        el.style.transform = `translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(2)}px) rotateY(${deg.toFixed(2)}deg)`;
        el.style.opacity = opacity.toFixed(3);
        el.style.filter = blur ? `blur(${blur}px)` : '';
        el.style.visibility = t >= 1 ? 'hidden' : 'visible';
      });

      if (sceneRef.current) {
        sceneRef.current.style.transform = `rotateX(${(-3 - s.tiltY * 2).toFixed(2)}deg) rotateY(${(s.tiltX * 3).toFixed(2)}deg)`;
      }

      const front = Math.round(s.pos);
      if (front !== baseRef.current) {
        baseRef.current = front;
        setBase(front);
      }
      const idx = mod(front, count);
      if (idx !== activeRef.current) {
        activeRef.current = idx;
        onActiveRef.current(idx);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [count]);

  /** Spin to the nearest slot that shows server `index`. */
  const goTo = useCallback(
    (index: number) => {
      const s = sim.current;
      s.lastInput = performance.now();
      const from = Math.round(s.target);
      let delta = mod(index - from, count);
      if (delta > count / 2) delta -= count;
      s.target = from + delta;
    },
    [count],
  );

  // External selection (pagination) → spin.
  useEffect(() => {
    if (active !== activeRef.current) {
      activeRef.current = active;
      goTo(active);
    }
  }, [active, goTo]);

  // Drag, swipe, wheel, click and arrow keys work across the whole page, not just the stage.
  useEffect(() => {
    const s = sim.current;
    let downTarget: EventTarget | null = null;
    const interactive = (t: EventTarget | null) =>
      t instanceof Element && Boolean(t.closest('button, a, input, textarea, select, [data-no-drag]'));
    const overlayOpen = () => Boolean(document.querySelector('.login-veil'));
    const stepBy = (n: number) => {
      s.lastInput = performance.now();
      s.target = Math.round(s.target) + n;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || interactive(e.target)) return;
      s.dragging = true;
      s.pointerId = e.pointerId;
      s.startX = s.lastX = e.clientX;
      s.lastT = performance.now();
      s.moved = 0;
      s.vel = 0;
      s.lastInput = s.lastT;
      downTarget = e.target;
      document.documentElement.classList.add('is-dragging');
    };

    const onMove = (e: PointerEvent) => {
      s.aimX = (e.clientX / window.innerWidth - 0.5) * 2;
      s.aimY = (e.clientY / window.innerHeight - 0.5) * 2;
      s.hovering = e.target instanceof Element && Boolean(e.target.closest('.slab'));
      if (!s.dragging || e.pointerId !== s.pointerId) return;
      const now = performance.now();
      const dx = e.clientX - s.lastX;
      const dtt = Math.max(1, now - s.lastT) / 1000;
      const dPos = -dx / (s.width * GAP);
      s.pos += dPos;
      s.vel = s.vel * 0.6 + (dPos / dtt) * 0.4;
      s.moved = Math.max(s.moved, Math.abs(e.clientX - s.startX));
      s.lastX = e.clientX;
      s.lastT = now;
      s.lastInput = now;
    };

    const onUp = (e: PointerEvent) => {
      if (!s.dragging || e.pointerId !== s.pointerId) return;
      s.dragging = false;
      document.documentElement.classList.remove('is-dragging');
      if (performance.now() - s.lastT > 80) s.vel = 0;
      if (s.moved < 6) {
        // A click on a side card brings it to the front.
        const hit = downTarget instanceof Element ? downTarget.closest<HTMLElement>('[data-slot]') : null;
        s.target = hit ? Number(hit.dataset.slot) : Math.round(s.pos);
        return;
      }
      // Flick inertia: a fast swipe keeps the cylinder spinning for a few servers.
      const here = Math.round(s.pos);
      const projected = Math.round(s.pos + s.vel * 0.3);
      s.target = clamp(projected, here - 4, here + 4);
    };

    const onLeave = () => {
      s.aimX = 0;
      s.aimY = 0;
      s.hovering = false;
    };

    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (overlayOpen() || (t instanceof Element && t.closest('input, textarea, select'))) return;
      if (e.key === 'ArrowRight') {
        stepBy(1);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        stepBy(-1);
        e.preventDefault();
      }
    };

    // Mouse wheel / trackpad: one server per notch, throttled so a trackpad swipe doesn't race through.
    let wheelAcc = 0;
    let wheelLock = 0;
    const onWheel = (e: WheelEvent) => {
      if (overlayOpen()) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const now = performance.now();
      wheelAcc += delta;
      if (now < wheelLock || Math.abs(wheelAcc) < 40) return;
      stepBy(wheelAcc > 0 ? 1 : -1);
      wheelAcc = 0;
      wheelLock = now + 260;
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
      document.documentElement.classList.remove('is-dragging');
    };
  }, []);

  // Gentle auto-spin while nobody is interacting (pauses on hover, input, hidden tab, login overlay).
  useEffect(() => {
    if (count < 2) return;
    const id = window.setInterval(() => {
      const s = sim.current;
      const idle = performance.now() - s.lastInput > IDLE_MS;
      if (!idle || s.dragging || s.hovering || document.hidden || document.querySelector('.login-veil')) return;
      s.target = Math.round(s.target) + 1;
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count]);

  const slots: number[] = [];
  if (count) for (let k = base - SLOTS_EACH_SIDE; k <= base + SLOTS_EACH_SIDE; k++) slots.push(k);
  const frontServer = count ? servers[mod(base, count)] : undefined;

  return (
    <div className="orbit">
      <div
        ref={stageRef}
        className="orbit-stage"
        role="listbox"
        aria-label="Серверы и голосовые румы"
        aria-activedescendant={frontServer ? `slot-${base}` : undefined}
      >
        <div ref={sceneRef} className="orbit-scene">
          {slots.map((k) => {
            const server = servers[mod(k, count)];
            const isFront = k === base;
            return (
              <article
                key={k}
                id={`slot-${k}`}
                ref={(el) => {
                  if (el) slotRefs.current.set(k, el);
                  else slotRefs.current.delete(k);
                }}
                className={`slab server ${isFront ? 'is-active' : ''}`}
                data-slot={k}
                role="option"
                aria-selected={isFront}
                aria-hidden={isFront ? undefined : true}
                aria-label={server.name}
                style={{ visibility: 'hidden' }}
              >
                <ServerCard server={server} />
              </article>
            );
          })}
        </div>
      </div>

      <div className="pager" role="tablist" aria-label="Выбор сервера">
        {servers.map((server, i) => (
          <button
            key={server.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={server.name}
            className={i === active ? 'is-active' : ''}
            onClick={() => goTo(i)}
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}
