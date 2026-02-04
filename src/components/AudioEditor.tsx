import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Mic, Scissors, Square, Download } from 'lucide-react';
import { cn } from '../lib/utils';

type AudioEditorProps = {
  stackTargets?: Array<{ id: string; label: string }>;
  onAddSelection?: (stackId: string, file: File) => void;
};

export const AudioEditor: React.FC<AudioEditorProps> = ({
  stackTargets = [],
  onAddSelection,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const regions = useRef<any>(null); // Type definition for regions plugin is tricky in strict mode sometimes
  const [status, setStatus] = useState<string>('Ready');
  const [isRecording, setIsRecording] = useState(false);
  const [hasRegion, setHasRegion] = useState(false);
  const [selectedStackId, setSelectedStackId] = useState<string>(stackTargets[0]?.id ?? '');

  // Recording refs
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const recordingStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    regions.current = RegionsPlugin.create();

    wavesurfer.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4b5563',
      progressColor: '#3b82f6',
      cursorColor: '#ef4444',
      barWidth: 2,
      barGap: 3,
      height: 300,
      plugins: [regions.current],
    });

    wavesurfer.current.on('ready', () => {
      setStatus('Ready to edit');
      regions.current.enableDragSelection({
        color: 'rgba(59, 130, 246, 0.3)',
      });
    });

    wavesurfer.current.on('play', () => {
      setStatus('Playing');
    });

    wavesurfer.current.on('pause', () => {
      setStatus('Paused');
    });

    wavesurfer.current.on('finish', () => {
      setStatus('Finished');
    });

    regions.current.on('region-created', (region: any) => {
      // Ensure only one region exists for simplicity
      regions.current.getRegions().forEach((r: any) => {
        if (r.id !== region.id) r.remove();
      });
      setHasRegion(true);
    });

    regions.current.on('region-removed', () => {
      if (regions.current.getRegions().length === 0) setHasRegion(false);
    });

    return () => {
      wavesurfer.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!selectedStackId && stackTargets.length > 0) {
      setSelectedStackId(stackTargets[0].id);
    }
  }, [selectedStackId, stackTargets]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!wavesurfer.current || isRecording) return;
      if (!wavesurfer.current.getDuration()) return;

      e.preventDefault();
      wavesurfer.current.playPause();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  useEffect(() => {
    const handleDelete = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!hasRegion || isRecording) return;
      e.preventDefault();
      rippleDeleteSelection();
    };

    window.addEventListener('keydown', handleDelete);
    return () => window.removeEventListener('keydown', handleDelete);
  }, [hasRegion, isRecording]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      loadAudio(file);
    }
  };

  const loadAudio = (blob: Blob) => {
    if (!wavesurfer.current) return;
    setStatus('Loading...');
    const url = URL.createObjectURL(blob);
    wavesurfer.current.load(url);
  };

  // Recording Logic (Tab Loopback)
  const startRecording = async () => {
    try {
      // getDisplayMedia is used for capturing system/tab audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required to get audio in getDisplayMedia
        audio: true,
      });

      recordingStream.current = displayStream;

      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        alert("No audio track found. Please ensure you share 'Tab Audio' or 'System Audio'.");
        displayStream.getTracks().forEach(t => t.stop());
        recordingStream.current = null;
        return;
      }

      const audioStream = new MediaStream(audioTracks);

      recordedChunks.current = [];

      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType = mimeCandidates.find(type => MediaRecorder.isTypeSupported(type)) || '';

      const recorder = mimeType
        ? new MediaRecorder(audioStream, { mimeType })
        : new MediaRecorder(audioStream);

      mediaRecorder.current = recorder;
      setStatus('Recording...');
      setIsRecording(true);

      const stopAllTracks = () => {
        displayStream.getTracks().forEach(track => track.stop());
        recordingStream.current = null;
      };

      displayStream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
            mediaRecorder.current.stop();
          }
        });
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: mimeType || 'audio/webm' });
        loadAudio(blob);
        setIsRecording(false);
        setStatus('Recording finished. Loaded into editor.');
        stopAllTracks();
      };

      recorder.onerror = () => {
        setIsRecording(false);
        setStatus('Recording error');
        stopAllTracks();
      };

      recorder.start();
    } catch (err) {
      console.error('Error starting record:', err);
      setStatus('Error starting recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      return;
    }

    if (recordingStream.current) {
      recordingStream.current.getTracks().forEach(track => track.stop());
      recordingStream.current = null;
    }
    setIsRecording(false);
  };

  const exportSelectionBlob = async (): Promise<Blob | null> => {
    if (!wavesurfer.current) return null;
    const region = regions.current.getRegions()[0];
    if (!region) return null;

    const decodedBuffer = wavesurfer.current.getDecodedData();
    if (!decodedBuffer) return null;

    const startSample = Math.floor(region.start * decodedBuffer.sampleRate);
    const endSample = Math.floor(region.end * decodedBuffer.sampleRate);
    const length = endSample - startSample;

    if (length <= 0) return null;

    // Create new buffer
    const newBuffer = new AudioContext().createBuffer(
      decodedBuffer.numberOfChannels,
      length,
      decodedBuffer.sampleRate
    );

    for (let i = 0; i < decodedBuffer.numberOfChannels; i++) {
      const channelData = decodedBuffer.getChannelData(i);
      const newChannelData = newBuffer.getChannelData(i);
      // Copy data
      for (let j = 0; j < length; j++) {
        newChannelData[j] = channelData[startSample + j];
      }
    }

    return bufferToWave(newBuffer, length);
  };

  const rippleDeleteSelection = async () => {
    if (!wavesurfer.current) return;
    const region = regions.current.getRegions()[0];
    if (!region) return;

    const decodedBuffer = wavesurfer.current.getDecodedData();
    if (!decodedBuffer) return;

    const startSample = Math.floor(region.start * decodedBuffer.sampleRate);
    const endSample = Math.floor(region.end * decodedBuffer.sampleRate);
    const cutLength = endSample - startSample;

    if (cutLength <= 0) return;
    if (cutLength >= decodedBuffer.length) {
      regions.current.getRegions().forEach((r: any) => r.remove());
      setHasRegion(false);
      wavesurfer.current.empty();
      setStatus('Selection removed (empty)');
      return;
    }

    const newLength = decodedBuffer.length - cutLength;
    const newBuffer = new AudioContext().createBuffer(
      decodedBuffer.numberOfChannels,
      newLength,
      decodedBuffer.sampleRate
    );

    for (let i = 0; i < decodedBuffer.numberOfChannels; i++) {
      const channelData = decodedBuffer.getChannelData(i);
      const newChannelData = newBuffer.getChannelData(i);
      newChannelData.set(channelData.subarray(0, startSample), 0);
      newChannelData.set(channelData.subarray(endSample), startSample);
    }

    regions.current.getRegions().forEach((r: any) => r.remove());
    setHasRegion(false);
    setStatus('Ripple delete applied');

    const wavBlob = await bufferToWave(newBuffer, newLength);
    await wavesurfer.current.loadBlob(wavBlob);
  };

  // Slicing Logic
  const saveSelection = async () => {
    const wavBlob = await exportSelectionBlob();
    if (!wavBlob) {
      alert('Please highlight a region first.');
      return;
    }

    // Trigger download
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clip_${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addSelectionToStack = async () => {
    if (!onAddSelection || !selectedStackId) return;
    const wavBlob = await exportSelectionBlob();
    if (!wavBlob) {
      alert('Please highlight a region first.');
      return;
    }

    const fileName = `clip_${Date.now()}.wav`;
    const file = new File([wavBlob], fileName, { type: wavBlob.type || 'audio/wav' });
    onAddSelection(selectedStackId, file);

    const stackLabel = stackTargets.find(target => target.id === selectedStackId)?.label;
    if (stackLabel) {
      setStatus(`Selection added to ${stackLabel}`);
    }
  };

  const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-900 overflow-hidden">
      <div className="p-4 border-b border-neutral-800 flex flex-col gap-3 bg-black sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <img src={logoUrl} alt="Go DDO" className="h-6 w-6 object-contain" />
          <h2 className="font-bold text-broadcast-text">EDITOR</h2>
          <span className="text-xs sm:text-sm text-broadcast-muted font-mono truncate max-w-full sm:max-w-[320px]">
            {status}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end w-full sm:w-auto">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-red-900/50 hover:bg-red-900 text-red-200 rounded border border-red-800 transition-colors text-xs sm:text-sm font-medium"
            >
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">REC LOOPBACK</span>
              <span className="sm:hidden">REC</span>
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded border border-neutral-600 transition-colors text-xs sm:text-sm font-medium animate-pulse"
            >
              <Square className="w-4 h-4 fill-current" />
              <span className="hidden sm:inline">STOP REC</span>
              <span className="sm:hidden">STOP</span>
            </button>
          )}

          {stackTargets.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedStackId}
                onChange={(e) => setSelectedStackId(e.target.value)}
                className="px-2 py-1.5 text-xs uppercase tracking-wide bg-neutral-900 border border-neutral-700 text-neutral-200 rounded"
              >
                {stackTargets.map(target => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))}
              </select>
              <button
                onClick={addSelectionToStack}
                disabled={!hasRegion || !selectedStackId}
                className={cn(
                  'flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded border transition-colors text-xs sm:text-sm font-medium',
                  hasRegion && selectedStackId
                    ? 'bg-neutral-800 text-neutral-100 border-neutral-600 hover:bg-neutral-700'
                    : 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed'
                )}
              >
                <span className="hidden sm:inline">ADD TO STACK</span>
                <span className="sm:hidden">ADD</span>
              </button>
            </div>
          )}

          <button
            onClick={saveSelection}
            disabled={!hasRegion}
            className={cn(
              'flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded border transition-colors text-xs sm:text-sm font-medium',
              hasRegion
                ? 'bg-broadcast-highlight text-white border-blue-600 hover:bg-blue-600'
                : 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed'
            )}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">SAVE SELECTION</span>
            <span className="sm:hidden">SAVE</span>
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex flex-col justify-center p-8 bg-neutral-900 relative"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={handleDrop}
      >
        <div id="waveform" ref={containerRef} className="w-full"></div>

        {!wavesurfer.current?.getDuration() && !isRecording && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="text-center">
              <Scissors className="w-16 h-16 mx-auto mb-4" />
              <p className="text-2xl font-bold">DROP AUDIO TO EDIT</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-2 bg-neutral-950 text-xs text-neutral-500 font-mono text-center border-t border-neutral-900">
        DRAG TO SELECT REGION • DELETE = RIPPLE CUT • SPACE TO PREVIEW
      </div>
    </div>
  );
};

// Helper to convert AudioBuffer to WAV Blob
// Copied/Simplified from standard implementations
function bufferToWave(abuffer: AudioBuffer, len: number) {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, intSample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
