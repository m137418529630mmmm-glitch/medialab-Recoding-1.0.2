export type CaptureMode = 'fullscreen' | 'region' | 'window';

export type AspectRatioPreset = '16:9' | '9:16' | '1:1' | 'free';

export interface RegionCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResolutionOption = 'native' | '4k' | '1080p' | '720p';

export type FpsOption = 60 | 30 | 24;

export type SharpnessMode = 'ultra' | 'high' | 'balanced';

export type VideoFormat = 'mp4' | 'mkv' | 'mov';

export interface AudioSettings {
  systemAudio: boolean;
  micAudio: boolean;
  systemVolume: number;
  micVolume: number;
  noiseSuppression: boolean;
}

export interface ToggleSettings {
  hideCursor: boolean;
  highlightClicks: boolean;
  systemAudio: boolean;
  micAudio: boolean;
  countdown3s: boolean;
  countdownDuration: 3 | 5;
  autoStopEnabled: boolean;
  autoStopHours: number;
  autoStopMinutes: number;
  autoStopSeconds: number;
}

export interface StorageSettings {
  savePath: string;
  autoSequential: boolean;
  startIndex: number;
  currentIndex: number;
  prefix: string; // empty string for '0.mp4' or 'clip_' for 'clip_0.mp4'
  format: VideoFormat;
}

export interface SavedRecording {
  id: string;
  fileName: string;
  fullPath: string;
  durationSeconds: number;
  durationFormatted: string;
  resolution: string;
  fps: number;
  sizeMb: number;
  mode: CaptureMode;
  modeName: string;
  createdAt: string;
  thumbnailUrl?: string;
}

export interface AppWindowState {
  id: string;
  title: string;
  appName: string;
  icon: string;
  width: number;
  height: number;
}

/** idle -> (countdown) -> starting -> recording <-> paused -> saving -> idle */
export type RecordingStatus = 'idle' | 'countdown' | 'starting' | 'recording' | 'paused' | 'saving';
