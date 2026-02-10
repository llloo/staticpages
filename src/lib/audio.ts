let currentAudio: HTMLAudioElement | null = null;

export function playAudio(audioFile: string): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  const url = `${import.meta.env.BASE_URL}data/audio/${audioFile}`;
  currentAudio = new Audio(url);
  currentAudio.play().catch(() => {
    // Audio playback failed (file not found or not allowed)
  });
}

export function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}
