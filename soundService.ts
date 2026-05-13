
export enum ChessSound {
  MOVE = 'MOVE',
  CAPTURE = 'CAPTURE',
  CHECK = 'CHECK',
  CHECKMATE = 'CHECKMATE',
  GAME_START = 'GAME_START'
}

const SOUND_URLS: Record<ChessSound, string> = {
  [ChessSound.MOVE]: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3',
  [ChessSound.CAPTURE]: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3',
  [ChessSound.CHECK]: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3',
  [ChessSound.CHECKMATE]: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3',
  [ChessSound.GAME_START]: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-start.mp3',
};

class SoundService {
  private sounds: Map<ChessSound, HTMLAudioElement> = new Map();
  private enabled: boolean = true;

  constructor() {
    // Preload sounds
    Object.entries(SOUND_URLS).forEach(([key, url]) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.sounds.set(key as ChessSound, audio);
    });
  }

  play(sound: ChessSound) {
    if (!this.enabled) return;
    
    const audio = this.sounds.get(sound);
    if (audio) {
      // Reset sound before playing to allow rapid fire
      audio.currentTime = 0;
      audio.play().catch(e => console.warn('Audio play failed:', e));
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }
}

export const soundService = new SoundService();
