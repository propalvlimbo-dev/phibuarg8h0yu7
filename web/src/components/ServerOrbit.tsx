import { useCallback, useEffect, useRef } from 'react';
import type { Server } from '../servers';
import ServerCard from './ServerCard';

type Props = {
  servers: Server[];
  active: number;
  onActiveChange: (index: number) => void;
  revealed: boolean;
};

/*
 * 3D cover-flow of servers. Position is measured in "cards" (float): card i sits at offset d = i - pos.
 * The front card faces the viewer; neighbours turn towards the centre and stack behind each other on
 * parallel planes, so cards never cut through one another however many servers there are.
 */
const SPRING_K = 60;
const SPRING_C = 2 * Math.sqrt(SPRING_K) * 0.95;
const LOOP_FROM = 5; // with this many servers the flow wraps around endlessly
const AUTOPLAY_MS = 5200; // gentle auto-advance…
const IDLE_MS = 7000; // …once the user hasn't touched it for this long

// Layout, in card widths.
const NEAR_X = 1.04; // centre → first neighbour
const FAR_X = 0.3; // spacing of the stacked cards further out
const NEAR_Z = 0.55;
const FAR_Z = 0.32;
const TURN = 34; // degrees the neighbours turn towards the centre
const VISIBLE = 3; // the stack fades out between VISIBLE - 1 and VISIBLE cards from the centre

const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function ServerOrbit({ servers, active, onActiveChange, revealed }: Props) {
  const count = servers.length;
  const loop = count >= LOOP_FROM;

  const indexAt = useCallback(
    (pos: number) => (loop ? mod(Math.round(pos), count) : clamp(Math.round(pos), 0, count - 1)),
    [loop, count],
  );
  const clampPos = useCallback((pos: number) => (loop ? pos : clamp(pos, 0, Math.max(0, count - 1))), [loop, count]);

  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const slabRefs = useRef<(HTMLElement | null)[]>([]);
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

  // Card width drives the layout.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const slab = slabRefs.current[0];
      if (slab) sim.current.width = slab.offsetWidth;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [count]);

  // Animation loop: spring physics + direct DOM transforms (no React re-render per frame).
  useEffect(() => {
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
      for (let i = 0; i < count; i++) {
        const el = slabRefs.current[i];
        if (!el) continue;
        let d = i - s.pos;
        if (loop) d = mod(d + count / 2, count) - count / 2;
        const a = Math.abs(d);
        const sgn = Math.sign(d);
        const near = Math.min(a, 1);
        const far = Math.max(0, a - 1);
        const x = sgn * (near * NEAR_X + far * FAR_X) * W;
        const z = -(near * NEAR_Z + far * FAR_Z) * W;
        const ry = -sgn * near * TURN;
        // Cards stay opaque (so stacked ones never show through); side cards are darkened instead,
        // and only the far end of the stack fades out.
        const opacity = clamp(VISIBLE - a, 0, 1);
        const dim = Math.min(0.85, near * 0.5 + far * 0.2);
        const hidden = opacity <= 0.01;

        el.style.transform = `translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(2)}px) rotateY(${ry.toFixed(2)}deg)`;
        el.style.opacity = opacity.toFixed(3);
        el.style.visibility = hidden ? 'hidden' : 'visible';
        el.style.setProperty('--dim', dim.toFixed(3));
      }

      if (sceneRef.current) {
        sceneRef.current.style.transform = `rotateX(${(-3 - s.tiltY * 2).toFixed(2)}deg) rotateY(${(s.tiltX * 3).toFixed(2)}deg)`;
      }

      const nearest = indexAt(s.pos);
      if (nearest !== activeRef.current) {
        activeRef.current = nearest;
        onActiveRef.current(nearest);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [count, loop, indexAt]);

  const goTo = useCallback(
    (index: number) => {
      const s = sim.current;
      s.lastInput = performance.now();
      if (!loop) {
        s.target = clampPos(index);
        return;
      }
      const laps = Math.round((s.target - index) / count);
      s.target = index + laps * count;
    },
    [loop, count, clampPos],
  );

  // External selection (pagination) → move.
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
      s.target = clampPos(Math.round(s.target) + n);
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
      const perCard = s.width * 0.95;
      // Rubber-band past the first / last server when the flow doesn't loop.
      const out = !loop && (s.pos < 0 || s.pos > count - 1);
      const dPos = (-dx / perCard) * (out ? 0.3 : 1);
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
        const hit = downTarget instanceof Element ? downTarget.closest<HTMLElement>('[data-index]') : null;
        if (hit) goTo(Number(hit.dataset.index));
        else s.target = clampPos(Math.round(s.pos));
        return;
      }
      // Flick inertia: a fast swipe can skip up to two servers.
      const here = Math.round(s.pos);
      const projected = Math.round(s.pos + s.vel * 0.25);
      s.target = clampPos(clamp(projected, here - 2, here + 2));
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
      wheelLock = now + 320;
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
  }, [goTo, loop, count, clampPos]);

  // Gentle auto-advance while nobody is interacting (pauses on hover, input, hidden tab, login overlay).
  useEffect(() => {
    if (count < 2) return;
    const id = window.setInterval(() => {
      const s = sim.current;
      const idle = performance.now() - s.lastInput > IDLE_MS;
      if (!idle || s.dragging || s.hovering || document.hidden || document.querySelector('.login-veil')) return;
      const next = Math.round(s.target) + 1;
      // Without looping, run back to the first server after the last one.
      s.target = loop ? next : next > count - 1 ? 0 : next;
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, loop]);

  return (
    <div className="orbit">
      <div
        ref={stageRef}
        className="orbit-stage"
        role="listbox"
        aria-label="Серверы и голосовые румы"
        aria-activedescendant={servers[active] ? `server-${servers[active].id}` : undefined}
      >
        <div ref={sceneRef} className="orbit-scene">
          {servers.map((server, i) => (
            <article
              key={server.id}
              id={`server-${server.id}`}
              ref={(el) => {
                slabRefs.current[i] = el;
              }}
              className={`slab server ${i === active ? 'is-active' : ''}`}
              data-index={i}
              role="option"
              aria-selected={i === active}
              aria-label={server.name}
            >
              <ServerCard server={server} />
            </article>
          ))}
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
