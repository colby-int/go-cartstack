export interface CartItem {
  id: string;
  file: File;
  url: string; // Blob URL
  title: string;
  duration: number;
  status: 'queued' | 'playing' | 'paused' | 'played';
  addedAt: number;
}

export interface EditorSelection {
  start: number;
  end: number;
}
