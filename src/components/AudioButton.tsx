import { playAudio } from '../lib/audio';
import './AudioButton.css';

interface AudioButtonProps {
  audioFile?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function AudioButton({ audioFile, size = 'medium' }: AudioButtonProps) {
  if (!audioFile) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playAudio(audioFile);
  };

  return (
    <button
      className={`audio-btn audio-btn-${size}`}
      onClick={handleClick}
      title="播放发音"
      type="button"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    </button>
  );
}
