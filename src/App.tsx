import { useCallback, useMemo, useState, type SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CartStack } from './components/CartStack';
import { AudioEditor } from './components/AudioEditor';
import type { CartItem } from './types';

const STACKS = [
  { id: 'stack-a', label: 'STACK A', hotkey: '1' },
  { id: 'stack-b', label: 'STACK B', hotkey: '2' },
  { id: 'stack-c', label: 'STACK C', hotkey: '3' },
];

function App() {
  const [stackState, setStackState] = useState<Record<string, CartItem[]>>(() =>
    STACKS.reduce((acc, stack) => {
      acc[stack.id] = [];
      return acc;
    }, {} as Record<string, CartItem[]>)
  );
  const [showEditor, setShowEditor] = useState(true);

  const setStackCarts = useCallback(
    (stackId: string, updater: SetStateAction<CartItem[]>) => {
      setStackState(prev => {
        const current = prev[stackId] ?? [];
        const next = typeof updater === 'function' ? updater(current) : updater;
        if (next === current) return prev;
        return { ...prev, [stackId]: next };
      });
    },
    []
  );

  const addFilesToStack = useCallback(
    (stackId: string, files: File[]) => {
      const audioFiles = files.filter(f => f.type.startsWith('audio/'));
      if (audioFiles.length === 0) return;

      const newCarts: CartItem[] = audioFiles.map(file => ({
        id: uuidv4(),
        file,
        url: URL.createObjectURL(file),
        title: file.name,
        duration: 0,
        status: 'queued',
        addedAt: Date.now(),
      }));

      setStackState(prev => {
        const current = prev[stackId] ?? [];
        return { ...prev, [stackId]: [...current, ...newCarts] };
      });

      newCarts.forEach(cart => {
        const audio = new Audio(cart.url);
        audio.onloadedmetadata = () => {
          setStackState(prev => {
            const current = prev[stackId] ?? [];
            return {
              ...prev,
              [stackId]: current.map(c =>
                c.id === cart.id ? { ...c, duration: audio.duration } : c
              ),
            };
          });
        };
      });
    },
    []
  );

  const moveCartAcrossStacks = useCallback(
    (
      fromStackId: string,
      toStackId: string,
      cartId: string,
      targetId: string | null
    ) => {
      if (fromStackId === toStackId) return;
      setStackState(prev => {
        const fromCarts = prev[fromStackId] ?? [];
        const toCarts = prev[toStackId] ?? [];
        const fromIndex = fromCarts.findIndex(cart => cart.id === cartId);
        if (fromIndex === -1) return prev;

        const nextFrom = [...fromCarts];
        const [movedCart] = nextFrom.splice(fromIndex, 1);

        const nextTo = [...toCarts];
        let insertIndex = targetId
          ? nextTo.findIndex(cart => cart.id === targetId)
          : nextTo.length;

        if (insertIndex === -1) insertIndex = nextTo.length;

        const shouldReenable = insertIndex === 0 && movedCart.status === 'played';
        const cartToInsert: CartItem = shouldReenable
          ? { ...movedCart, status: 'queued' }
          : movedCart;

        nextTo.splice(insertIndex, 0, cartToInsert);

        return {
          ...prev,
          [fromStackId]: nextFrom,
          [toStackId]: nextTo,
        };
      });
    },
    []
  );

  const stackTargets = useMemo(
    () => STACKS.map(stack => ({ id: stack.id, label: stack.label })),
    []
  );

  const handleAddSelection = useCallback(
    (stackId: string, file: File) => {
      addFilesToStack(stackId, [file]);
    },
    [addFilesToStack]
  );

  return (
    <div className="relative flex h-screen w-screen bg-broadcast-bg text-broadcast-text overflow-hidden font-sans">
      <button
        type="button"
        onClick={() => setShowEditor(prev => !prev)}
        className="absolute bottom-3 right-3 z-30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded border border-neutral-800 bg-neutral-950/90 text-neutral-300 hover:bg-neutral-900"
      >
        {showEditor ? 'Hide Editor' : 'Show Editor'}
      </button>

      <div className={showEditor ? 'flex h-full flex-[1.15] min-w-[960px]' : 'flex h-full flex-1'}>
        {STACKS.map(stack => (
          <CartStack
            key={stack.id}
            stackId={stack.id}
            label={stack.label}
            hotkey={stack.hotkey}
            carts={stackState[stack.id] ?? []}
            setCarts={(updater) => setStackCarts(stack.id, updater)}
            onAddFiles={addFilesToStack}
            onMoveAcross={moveCartAcrossStacks}
            className="flex-1 min-w-[300px]"
          />
        ))}
      </div>
      {showEditor && (
        <AudioEditor stackTargets={stackTargets} onAddSelection={handleAddSelection} />
      )}
    </div>
  );
}

export default App;
