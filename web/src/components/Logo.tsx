/**
 * GirlScan mark: a magnifier drawn in the Discord visual language —
 * a chunky rounded lens with Clyde-style eye cut-outs and a soft handle.
 * viewBox 0 0 100 100. The eyes are holes (evenodd), so the mark is one colour.
 */
export const LENS_VIEWBOX = '0 0 100 100';

// Lens disc (c=41,43 r=33) with two eye holes (rx 6.6, ry 7.8).
export const LENS_BODY =
  'M41,10a33,33 0 1,0 0.001,0Z' +
  'M29.6,36.2a6.6,7.8 0 1,0 0.001,0Z' +
  'M52.4,36.2a6.6,7.8 0 1,0 0.001,0Z';

// Handle: a 45° capsule, 18 units thick, from the rim down to the bottom-right.
export const LENS_HANDLE = 'M62,64L85,87';

export function LensGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={LENS_VIEWBOX} aria-hidden="true">
      <path d={LENS_BODY} fill="currentColor" fillRule="evenodd" />
      <path d={LENS_HANDLE} stroke="currentColor" strokeWidth="18" strokeLinecap="round" fill="none" />
    </svg>
  );
}
