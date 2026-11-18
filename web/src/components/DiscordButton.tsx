type Props = {
  label: string;
  ariaLabel?: string;
  onClick: () => void;
};

// Official Discord "Clyde" mark (viewBox 0 0 127.14 96.36). Eyes are holes (evenodd),
// so the light layer underneath can shine through them on hover.
const CLYDE =
  'M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z';

export default function DiscordButton({ label, ariaLabel, onClick }: Props) {
  return (
    <button className="discord" type="button" onClick={onClick} aria-label={ariaLabel ?? label}>
      <span className="discord-body" aria-hidden="true">
        <span className="discord-shine" />
      </span>
      <span className="discord-content">
        <span className="clyde-wrap" aria-hidden="true">
          <svg className="clyde" viewBox="0 0 127.14 96.36">
            <g className="clyde-eyes">
              <ellipse cx="42.45" cy="53" rx="12.2" ry="13.4" />
              <ellipse cx="84.69" cy="53" rx="12.2" ry="13.4" />
            </g>
            <path className="clyde-body" d={CLYDE} fillRule="evenodd" />
          </svg>
        </span>
        <span className="discord-label">{label}</span>
      </span>
    </button>
  );
}
