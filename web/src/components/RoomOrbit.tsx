import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import type { Room } from '../rooms';

type Props = {
  rooms: Room[];
  active: number;
  onActiveChange: (index: number) => void;
  revealed: boolean;
};

const BARS = 34;
const DRAG_SENSITIVITY = 0.32; // degrees per pixel
const SPRING_K = 58;
const SPRING_C = 2 * Math.sqrt(SPRING_K) * 0.92;

const mod = (n: number, m: number) => ((n % m) + m) % m;
const wrap180 = (deg: number) => mod(deg + 180, 360) - 180;

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function VoiceBars({ room }: { room: Room }) {
  const bars = useMemo(() => {
    const rand = seeded(room.id);
    const level = Math.min(1, 0.35 + room.members / 30);
    return Array.from({ length: BARS }, (_, i) => {
      const envelope = Math.sin((i / (BARS - 1)) * Math.PI) * 0.7 + 0.3;
      const hi = Math.max(0.12, Math.min(1, envelope * level * (0.55 + rand() * 0.6)));
      return {
        '--hi': hi.toFixed(3),
        '--lo': (hi * (0.12 + rand() * 0.25)).toFixed(3),
        '--dur': `${(0.7 + rand() * 0.9).toFixed(2)}s`,
        '--delay': `${(-rand() * 1.6).toFixed(2)}s`,
      } as CSSProperties;
    });
  }, [room.id, room.members]);

  return (
    <div className="voice" aria-hidden="true">
      {bars.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
}

export default function RoomOrbit({ rooms, active, onActiveChange, revealed }: Props) {
  const count = rooms.length;
  const step = 360 / Math.max(count, 1);

  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const slabRefs = useRef<(HTMLElement | null)[]>([]);
  const activeRef = useRef(active);
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;

  const sim = useRef({
    rot: -step * 1.6,
    target: -step * 1.6,
    vel: 0,
    dragging: false,
    pointerId: -1,
    startX: 0,
    lastX: 0,
    lastT: 0,
    moved: 0,
    radius: 300,
    tiltX: 0,
    tiltY: 0,
    aimX: 0,
    aimY: 0,
  });

  // Spin in once the console is revealed.
  useEffect(() => {
    if (revealed) sim.current.target = 0;
  }, [revealed]);

  // Keep orbit radius in sync with slab size.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const slab = slabRefs.current[0];
      if (slab) sim.current.radius = slab.offsetWidth * 1.3;
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
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const s = sim.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!s.dragging) {
        const sub = 3;
        const h = dt / sub;
        for (let i = 0; i < sub; i++) {
          const acc = SPRING_K * (s.target - s.rot) - SPRING_C * s.vel;
          s.vel += acc * h;
          s.rot += s.vel * h;
        }
      }

      s.tiltX += (s.aimX - s.tiltX) * (1 - Math.exp(-dt * 4));
      s.tiltY += (s.aimY - s.tiltY) * (1 - Math.exp(-dt * 4));

      const R = s.radius;
      for (let i = 0; i < count; i++) {
        const el = slabRefs.current[i];
        if (!el) continue;
        const theta = wrap180(i * step - s.rot);
        const rad = (theta * Math.PI) / 180;
        const x = Math.sin(rad) * R;
        const z = (Math.cos(rad) - 1) * R;
        const focus = (Math.cos(rad) + 1) / 2;
        el.style.transform = `translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(2)}px) rotateY(${(theta * 0.3).toFixed(2)}deg)`;
        el.style.setProperty('--focus', focus.toFixed(3));
        el.style.zIndex = String(Math.round(focus * 100));
      }

      if (dialRef.current) {
        dialRef.current.style.setProperty('--spin', `${s.rot.toFixed(2)}deg`);
      }
      if (sceneRef.current) {
        sceneRef.current.style.transform = `rotateX(${(-7 - s.tiltY * 3).toFixed(2)}deg) rotateY(${(s.tiltX * 6).toFixed(2)}deg)`;
      }

      const nearest = mod(Math.round(s.rot / step), count);
      if (nearest !== activeRef.current) {
        activeRef.current = nearest;
        onActiveRef.current(nearest);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [count, step]);

  const goTo = useCallback(
    (index: number) => {
      const s = sim.current;
      const base = index * step;
      const turns = Math.round((s.rot - base) / 360);
      s.target = base + turns * 360;
    },
    [step],
  );

  // External selection (pagination) → rotate.
  useEffect(() => {
    if (active !== activeRef.current) {
      activeRef.current = active;
      goTo(active);
    }
  }, [active, goTo]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const s = sim.current;
    s.dragging = true;
    s.pointerId = e.pointerId;
    s.startX = s.lastX = e.clientX;
    s.lastT = performance.now();
    s.moved = 0;
    s.vel = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    const stage = stageRef.current;
    if (stage) {
      const r = stage.getBoundingClientRect();
      s.aimX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      s.aimY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }
    if (!s.dragging || e.pointerId !== s.pointerId) return;
    const now = performance.now();
    const dx = e.clientX - s.lastX;
    const dtt = Math.max(1, now - s.lastT) / 1000;
    s.rot -= dx * DRAG_SENSITIVITY;
    s.vel = s.vel * 0.6 + ((-dx * DRAG_SENSITIVITY) / dtt) * 0.4;
    s.moved = Math.max(s.moved, Math.abs(e.clientX - s.startX));
    s.lastX = e.clientX;
    s.lastT = now;
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (!s.dragging || e.pointerId !== s.pointerId) return;
    s.dragging = false;
    if (performance.now() - s.lastT > 80) s.vel = 0;

    if (s.moved < 6) {
      // Treat as a click: focus the slab under the pointer.
      const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-index]');
      if (hit) goTo(Number(hit.dataset.index));
      return;
    }
    const projected = s.rot + s.vel * 0.22;
    s.target = Math.round(projected / step) * step;
  };

  const onPointerLeave = () => {
    sim.current.aimX = 0;
    sim.current.aimY = 0;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      sim.current.target += step;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      sim.current.target -= step;
      e.preventDefault();
    }
  };

  return (
    <div className="orbit">
      <div
        ref={stageRef}
        className="orbit-stage"
        role="listbox"
        tabIndex={0}
        aria-label="Голосовые румы"
        aria-activedescendant={rooms[active] ? `room-${rooms[active].id}` : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        <div ref={sceneRef} className="orbit-scene">
          <div ref={dialRef} className="dial" aria-hidden="true">
            <div className="dial-rotor">
              {rooms.map((room, i) => (
                <span key={room.id} className="dial-mark" style={{ '--a': `${90 - i * step}deg` } as CSSProperties} />
              ))}
            </div>
            <div className="dial-focus" />
          </div>

          {rooms.map((room, i) => {
            const capacity = room.capacity ?? Math.max(room.members, 1);
            const fill = Math.min(1, room.members / capacity);
            return (
              <article
                key={room.id}
                id={`room-${room.id}`}
                ref={(el) => {
                  slabRefs.current[i] = el;
                }}
                className={`slab ${i === active ? 'is-active' : ''}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                aria-label={`${room.name}, ${room.members} в эфире`}
              >
                <div className="face front">
                  <div className="slab-top">
                    <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                    <span className="pulse" />
                  </div>
                  <h2 className="slab-name">{room.name}</h2>
                  <VoiceBars room={room} />
                  <div className="slab-foot">
                    <div className="count mono">
                      <b>{room.members}</b>
                      {room.capacity ? <span>/{room.capacity}</span> : null}
                    </div>
                    <span className="label">в эфире</span>
                    <div className="meter">
                      <i style={{ transform: `scaleX(${fill})` }} />
                    </div>
                  </div>
                </div>
                <div className="face edge edge-l" />
                <div className="face edge edge-r" />
                <div className="face edge edge-t" />
                <div className="face edge edge-b" />
                <div className="face back" />
              </article>
            );
          })}
        </div>
      </div>

      <div className="pager" role="tablist" aria-label="Выбор рума">
        {rooms.map((room, i) => (
          <button
            key={room.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={room.name}
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
