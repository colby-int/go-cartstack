<img width="52" height="52" alt="logo" src="https://github.com/user-attachments/assets/f4f203e2-efc1-4f6a-b658-e6f83b282ddf" />

# go-cartstack
#### browser-based radio-style cart player with hotkeyed queues and a waveform editor.

![Untitled 2](https://github.com/user-attachments/assets/89f0c0b3-5fe1-43eb-bb4e-9d294229898b)


## Features
### Cart Stacks
- Three stacks live in `src/App.tsx` (`STACKS`), with hotkeys `1`, `2`, `3` and labels `STACK A/B/C`.
- Each stack uses `CartStack` in `src/components/CartStack.tsx` and manages playback with `playCart`, `stopCart`, and the `handleEnded` listener.
- The top item is always the active cart; pressing the hotkey plays `carts[0]` even if it was previously played.
- When a cart stops or ends, it is marked `played` and moved to the bottom so it scrolls out of view.
- Played carts render greyed out, show the `RotateCcw` re-activate icon, and re-enable automatically when dragged to the top.
- Drag-and-drop file loading adds carts to a stack and fills durations after metadata loads.
- Reorder within a stack uses the drag handle and `moveCartWithinStack`.
- Cross-stack drag and drop uses a payload keyed by `CART_MIME` and `onMoveAcross` (defined in `src/App.tsx`).

### Audio Editor
- `AudioEditor` in `src/components/AudioEditor.tsx` uses WaveSurfer with `RegionsPlugin` to render and edit audio.
- Space toggles play/pause for the editor; Delete/Backspace performs ripple delete via `rippleDeleteSelection`.
- Selection export uses `exportSelectionBlob` and `bufferToWave` to create a WAV file.
- “Add to stack” uses `addSelectionToStack` and `onAddSelection` to insert the selection into a chosen stack.
- Loopback recording uses `startRecording` and `stopRecording` with `getDisplayMedia`, capturing audio-only tracks.
- The editor header displays `public/logo.png` next to the “EDITOR” label.

### Layout
- The editor visibility toggle sits at the bottom-right of the window and is driven by `showEditor` state in `src/App.tsx`.

## Code Map
- `src/App.tsx` wires the stack registry, cross-stack moves, editor visibility, and selection-to-stack flow.
- `src/components/CartStack.tsx` owns cart playback, drag/drop reorder, and per-stack hotkeys.
- `src/components/AudioEditor.tsx` owns waveform rendering, selection editing, and loopback recording.
- `src/types.ts` defines `CartItem` and editor selection types.
- `src/lib/time.ts` formats time displays.
- `src/lib/utils.ts` provides the `cn` class merge helper.
- `public/logo.png` is the editor header icon.

# Running Locally
1. `npm install`
2. `npm run dev`

# Browser Permissions
- Autoplay requires a user gesture before audio plays.
- Loopback recording requires selecting “Share audio” in the screen-share prompt.
