/**
 * GirlScan mark: a classic magnifier drawn in the Discord visual language —
 * a chunky ring lens and a soft rounded handle. viewBox 0 0 100 100, one colour.
 */
export const LENS_VIEWBOX = '0 0 100 100';

// Ring lens: outer r=33, inner r=20 around (41,43); evenodd makes the glass a hole.
export const LENS_BODY = 'M41,10a33,33 0 1,0 0.001,0Z' + 'M41,23a20,20 0 1,0 0.001,0Z';

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
