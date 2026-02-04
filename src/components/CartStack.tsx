import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, Play, Square, RotateCcw, GripVertical, Pencil } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatTime, formatDuration } from '../lib/time';
import type { CartItem } from '../types';

type CartStackProps = {
  stackId: string;
  label: string;
  hotkey: string;
  carts: CartItem[];
  setCarts: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onAddFiles: (stackId: string, files: File[]) => void;
  onMoveAcross: (
    fromStackId: string,
    toStackId: string,
    cartId: string,
    targetId: string | null
  ) => void;
  className?: string;
};

const CART_MIME = 'application/x-go-ddo-cart';

export const CartStack: React.FC<CartStackProps> = ({
  stackId,
  label,
  hotkey,
  carts,
  setCarts,
  onAddFiles,
  onMoveAcross,
  className,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const setCartsRef = useRef(setCarts);

  useEffect(() => {
    setCartsRef.current = setCarts;
  }, [setCarts]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
      setCartsRef.current(prev => {
        const playingIndex = prev.findIndex(c => c.status === 'playing');
        if (playingIndex === -1) return prev;
        const next = [...prev];
        const playedCart: CartItem = { ...next[playingIndex], status: 'played' };
        next.splice(playingIndex, 1);
        next.push(playedCart);
        return next;
      });
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  const getActiveIndex = useCallback(() => {
    const playingIndex = carts.findIndex(c => c.status === 'playing');
    if (playingIndex !== -1) return playingIndex;
    return carts.length > 0 ? 0 : -1;
  }, [carts]);

  const activeIndex = getActiveIndex();
  const activeCart = activeIndex !== -1 ? carts[activeIndex] : null;

  const requeueCart = (id: string) => {
    setCarts(prev => prev.map(c => (c.id === id ? { ...c, status: 'queued' } : c)));
  };

  const playCart = async (cart: CartItem) => {
    if (!audioRef.current) return;

    try {
      const audio = audioRef.current;

      if (audio.src !== cart.url) {
        audio.src = cart.url;
        audio.load();
      }

      audio.currentTime = 0;
      setCurrentTime(0);

      await audio.play();
      setIsPlaying(true);
      setCarts(prev =>
        prev.map(c => {
          if (c.id === cart.id) return { ...c, status: 'playing' };
          if (c.status === 'playing') return { ...c, status: 'played' };
          return c;
        })
      );
    } catch (e) {
      console.error('Playback failed', e);
    }
  };

  const stopCart = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setCarts(prev => {
      const playingIndex = prev.findIndex(c => c.status === 'playing');
      if (playingIndex === -1) return prev;
      const next = [...prev];
      const playedCart: CartItem = { ...next[playingIndex], status: 'played' };
      next.splice(playingIndex, 1);
      next.push(playedCart);
      return next;
    });
  };

  const startEditing = (cart: CartItem) => {
    setEditingId(cart.id);
    setDraftTitle(cart.title);
  };

  const commitEditing = () => {
    if (!editingId) return;
    const nextTitle = draftTitle.trim() || 'Untitled';
    setCarts(prev => prev.map(c => (c.id === editingId ? { ...c, title: nextTitle } : c)));
    setEditingId(null);
    setDraftTitle('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftTitle('');
  };

  const moveCartWithinStack = (fromId: string, toId: string | null) => {
    setCarts(prev => {
      if (fromId === toId) return prev;
      const fromIndex = prev.findIndex(c => c.id === fromId);
      if (fromIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);

      let insertIndex = toId ? next.findIndex(c => c.id === toId) : next.length;
      if (insertIndex === -1) insertIndex = next.length;

      const shouldReenable = insertIndex === 0 && moved.status === 'played';
      const cartToInsert: CartItem = shouldReenable
        ? { ...moved, status: 'queued' }
        : moved;

      next.splice(insertIndex, 0, cartToInsert);
      return next;
    });
  };

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== hotkey) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      if (isPlaying) {
        stopCart();
        return;
      }

      if (carts.length === 0) return;

      const topCart = carts[0];
      if (topCart) {
        playCart(topCart);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [carts, isPlaying, hotkey]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(stackId, Array.from(e.dataTransfer.files));
      return;
    }

    const payload = e.dataTransfer.getData(CART_MIME);
    if (payload) {
      try {
        const data = JSON.parse(payload) as { cartId: string; sourceStackId: string };
        if (data.sourceStackId === stackId) {
          moveCartWithinStack(data.cartId, null);
        } else {
          onMoveAcross(data.sourceStackId, stackId, data.cartId, null);
        }
      } catch (err) {
        console.error('Invalid drag payload', err);
      }
    }

    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const remaining =
    activeCart && isPlaying
      ? Math.max(0, activeCart.duration - currentTime)
      : activeCart?.duration || 0;

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-broadcast-panel border-r border-neutral-800 min-w-[300px]',
        className
      )}
    >
      {/* Header / Timer */}
      <div className="bg-black p-4 border-b border-neutral-800 sticky top-0 z-10">
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="text-xs font-bold text-broadcast-muted uppercase tracking-wider">
              NEXT / ON AIR
            </span>
            <div className="text-xs font-semibold text-neutral-400 mt-1">{label}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-300 bg-neutral-800/80 px-2 py-1 rounded">
              KEY {hotkey}
            </span>
            {isPlaying && (
              <span className="animate-pulse text-xs font-bold text-broadcast-accent bg-red-900/30 px-2 py-1 rounded">
                ON AIR
              </span>
            )}
          </div>
        </div>

        <div className="text-5xl font-mono font-bold text-broadcast-text tabular-nums tracking-tighter">
          {activeCart ? formatTime(remaining) : '--:--'}
        </div>

        <div className="mt-2 text-broadcast-highlight truncate font-medium h-6">
          {activeCart?.title || 'No Cart Loaded'}
        </div>
      </div>

      {/* Stack List */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {carts.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-broadcast-muted border-2 border-dashed border-neutral-700 rounded-lg">
            <p>Drag audio files here</p>
            <p className="text-sm mt-2">Press '{hotkey}' to play/stop</p>
          </div>
        )}

        {carts.map((cart, index) => {
          const isPlayed = cart.status === 'played';
          const isActive = cart.id === activeCart?.id;
          const isDragging = cart.id === draggingId;
          const isDragOver = cart.id === dragOverId;
          const progress = cart.duration ? Math.min(100, (currentTime / cart.duration) * 100) : 0;
          const isPlayingCart = cart.status === 'playing';

          return (
            <div
              key={cart.id}
              className={cn(
                'relative p-3 rounded bg-neutral-800 border transition-all select-none group',
                isPlayed ? 'opacity-40' : 'border-neutral-700',
                isActive ? 'ring-2 ring-broadcast-highlight bg-neutral-700' : 'hover:bg-neutral-750',
                isDragging ? 'opacity-60' : '',
                isDragOver ? 'border-broadcast-highlight' : ''
              )}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingId && draggingId !== cart.id) {
                  setDragOverId(cart.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverId === cart.id) setDragOverId(null);
              }}
              onDrop={(e) => {
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddFiles(stackId, Array.from(e.dataTransfer.files));
                  return;
                }

                e.preventDefault();
                e.stopPropagation();
                const payload = e.dataTransfer.getData(CART_MIME);
                if (!payload) return;
                try {
                  const data = JSON.parse(payload) as { cartId: string; sourceStackId: string };
                  if (data.sourceStackId === stackId) {
                    if (data.cartId && data.cartId !== cart.id) {
                      moveCartWithinStack(data.cartId, cart.id);
                    }
                  } else {
                    onMoveAcross(data.sourceStackId, stackId, data.cartId, cart.id);
                  }
                } catch (err) {
                  console.error('Invalid drag payload', err);
                }

                setDraggingId(null);
                setDragOverId(null);
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-hidden">
                  <button
                    type="button"
                    draggable={!isPlayingCart}
                    onDragStart={(e) => {
                      if (isPlayingCart) return;
                      e.dataTransfer.setData(
                        CART_MIME,
                        JSON.stringify({ cartId: cart.id, sourceStackId: stackId })
                      );
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingId(cart.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                    className={cn(
                      'p-1 text-neutral-500 hover:text-neutral-200 cursor-grab active:cursor-grabbing',
                      isPlayingCart ? 'opacity-40 cursor-not-allowed' : ''
                    )}
                    title={isPlayingCart ? 'Cannot move while playing' : 'Drag to reorder'}
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>

                  <div
                    className={cn(
                      'w-6 h-6 flex items-center justify-center rounded text-xs font-bold',
                      isActive ? 'bg-broadcast-highlight text-white' : 'bg-neutral-600 text-neutral-400'
                    )}
                  >
                    {isActive ? '1' : index + 1}
                  </div>

                  <div className="truncate flex-1">
                    {editingId === cart.id ? (
                      <input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onBlur={commitEditing}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitEditing();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelEditing();
                          }
                        }}
                        className="w-full bg-neutral-900/60 border border-neutral-700 rounded px-2 py-1 text-sm text-broadcast-text focus:outline-none focus:ring-2 focus:ring-broadcast-highlight"
                        autoFocus
                      />
                    ) : (
                      <div className="text-sm font-medium truncate" title={cart.title}>
                        {cart.title}
                      </div>
                    )}
                    <div className="text-xs text-broadcast-muted font-mono">
                      {formatDuration(cart.duration)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isActive && isPlaying ? (
                    <Square className="w-4 h-4 fill-current text-broadcast-accent" />
                  ) : isActive ? (
                    <Play className="w-4 h-4 fill-current text-broadcast-highlight" />
                  ) : null}

                  {isPlayed && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        requeueCart(cart.id);
                      }}
                      className="p-1 text-neutral-300 hover:text-broadcast-highlight"
                      title="Re-activate cart"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(cart);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-broadcast-highlight transition-opacity"
                    title="Edit cart title"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editingId === cart.id) cancelEditing();
                      setCarts(prev => prev.filter(c => c.id !== cart.id));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                    title="Remove cart"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar for active item */}
              {isActive && (
                <div
                  className="absolute bottom-0 left-0 h-1 bg-broadcast-highlight transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
