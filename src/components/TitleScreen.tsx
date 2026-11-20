import React, { useEffect, useRef, useState } from 'react';
import { gameAudio } from '../game/audio';
import { SaveSlotId, SaveSlotInfo } from '../game/types';

interface TitleScreenProps {
  saveSlots: SaveSlotInfo[];
  activeSlot: SaveSlotId;
  onSelectNewGameSlot: (slot: SaveSlotId) => void;
  onSelectContinueSlot: (slot: SaveSlotId) => void;
  onOpenOptions: () => void;
  onOpenHowToPlay: () => void;
}

type SlotModalMode = 'none' | 'new_slot' | 'continue_slot' | 'warn1' | 'warn2';

export const TitleScreen: React.FC<TitleScreenProps> = ({
  saveSlots,
  activeSlot,
  onSelectNewGameSlot,
  onSelectContinueSlot,
  onOpenOptions,
  onOpenHowToPlay,
}) => {
  const startBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogFirstBtnRef = useRef<HTMLButtonElement | null>(null);
  const [modalMode, setModalMode] = useState<SlotModalMode>('none');
  const [pendingSlot, setPendingSlot] = useState<SaveSlotId | null>(null);

  const hasAnySave = saveSlots.some((s) => s.save !== null);
  const pendingSlotInfo = saveSlots.find((s) => s.slot === pendingSlot) ?? null;

  useEffect(() => {
    if (modalMode === 'none') {
      startBtnRef.current?.focus({ preventScroll: true });
    } else {
      dialogFirstBtnRef.current?.focus({ preventScroll: true });
    }
  }, [modalMode]);

  useEffect(() => {
    if (modalMode === 'none') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Backspace') {
        e.preventDefault();
        gameAudio.playMenuSelect();
        if (modalMode === 'warn2') {
          setModalMode('warn1');
        } else if (modalMode === 'warn1') {
          setModalMode('new_slot');
        } else {
          setModalMode('none');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalMode]);

  const handleChooseNewSlot = (slotInfo: SaveSlotInfo) => {
    gameAudio.playMenuSelect();
    if (!slotInfo.save) {
      setModalMode('none');
      setPendingSlot(null);
      onSelectNewGameSlot(slotInfo.slot);
      return;
    }
    setPendingSlot(slotInfo.slot);
    setModalMode('warn1');
  };

  return (
    <div
      data-menu-root="true"
      className="absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-5 pointer-events-none select-none"
    >
      {/* Top 40% Calm Sky Space: Bespoke Inline SVG Title Emblem */}
      <div className="flex flex-col items-center pt-2 sm:pt-3">
        <svg
          viewBox="0 0 220 74"
          className="w-[88%] max-w-[300px] drop-shadow-[0_3px_0_#090d16]"
          aria-label="Sword & Gun RPG"
        >
          {/* Retro GBC Crest Shield & Crossed Sword/Buster */}
          <g transform="translate(94, 0)">
            <rect x="8" y="2" width="16" height="16" fill="#0f172a" stroke="#facc15" strokeWidth="1.5" />
            <path d="M10 15 L22 4 M19 4 L22 4 L22 7" stroke="#38bdf8" strokeWidth="2" strokeLinecap="square" />
            <rect x="11" y="9" width="9" height="4" fill="#facc15" />
          </g>
          {/* Main Title Typography */}
          <text
            x="110"
            y="42"
            textAnchor="middle"
            fill="#facc15"
            stroke="#0f172a"
            strokeWidth="4"
            paintOrder="stroke fill"
            fontFamily="'Press Start 2P', monospace"
            fontSize="15"
            fontWeight="700"
          >
            SWORD &amp; GUN
          </text>
          <text
            x="110"
            y="62"
            textAnchor="middle"
            fill="#38bdf8"
            stroke="#0f172a"
            strokeWidth="3.5"
            paintOrder="stroke fill"
            fontFamily="'Press Start 2P', monospace"
            fontSize="11"
            fontWeight="700"
            letterSpacing="2"
          >
            ACTION RPG
          </text>
        </svg>
      </div>

      {/* Menu Actions */}
      <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
        <button
          ref={startBtnRef}
          type="button"
          data-start="true"
          onClick={() => {
            gameAudio.playMenuSelect();
            setModalMode('new_slot');
          }}
          className="w-48 sm:w-52 py-1.5 px-4 bg-[#1d4ed8] hover:bg-[#2563eb] active:translate-y-0.5 border-2 border-[#facc15] text-white font-pixel-title text-[10px] sm:text-[11px] tracking-wide shadow-[0_3px_0_#090d16] cursor-pointer whitespace-nowrap"
        >
          NEW GAME
        </button>

        <button
          type="button"
          disabled={!hasAnySave}
          onClick={() => {
            gameAudio.playMenuSelect();
            setModalMode('continue_slot');
          }}
          className={`w-48 sm:w-52 py-1.5 px-4 border-2 font-pixel-title text-[10px] sm:text-[11px] tracking-wide shadow-[0_3px_0_#090d16] whitespace-nowrap ${
            hasAnySave
              ? 'bg-[#0f172a]/90 hover:bg-[#1e293b] border-[#38bdf8] text-[#e2e8f0] cursor-pointer'
              : 'bg-[#0f172a]/60 border-[#334155] text-[#64748b] cursor-not-allowed'
          }`}
        >
          CONTINUE
        </button>

        <button
          type="button"
          onClick={() => {
            gameAudio.playMenuSelect();
            onOpenOptions();
          }}
          className="w-48 sm:w-52 py-1.5 px-4 bg-[#0f172a]/90 hover:bg-[#1e293b] border-2 border-[#475569] text-[#cbd5e1] font-pixel-title text-[10px] sm:text-[11px] tracking-wide shadow-[0_3px_0_#090d16] cursor-pointer whitespace-nowrap"
        >
          OPTION
        </button>

        <button
          type="button"
          onClick={() => {
            gameAudio.playMenuSelect();
            onOpenHowToPlay();
          }}
          className="w-48 sm:w-52 py-1.5 px-4 bg-[#0f172a]/90 hover:bg-[#1e293b] border-2 border-[#38bdf8]/70 text-[#7dd3fc] font-pixel-title text-[10px] sm:text-[11px] tracking-wide shadow-[0_3px_0_#090d16] cursor-pointer whitespace-nowrap"
        >
          HOW TO PLAY
        </button>

        <p className="mt-0.5 font-pixel-title text-[8.5px] text-[#fde047] tracking-widest animate-pulse drop-shadow-[0_1px_0_#000]">
          PRESS START
        </p>
      </div>

      {/* Flat bottom control hint line */}
      <div className="text-center text-[8px] sm:text-[9px] text-[#e2e8f0] bg-[#090d16]/75 px-2 py-1 rounded border border-[#1e293b]">
        Y: Dodge · Y+Fwd: Dash · SELECT: Potion · Hold A/X: Charge · R: 360° Hook · L: Block/Parry
      </div>

      {/* New Game / Continue 3-Save-Slot Picker Modal */}
      {(modalMode === 'new_slot' || modalMode === 'continue_slot') && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={modalMode === 'new_slot' ? 'Select Save Slot - New Game' : 'Select Save Slot - Continue'}
          className="absolute inset-0 z-30 bg-[#050811]/90 flex items-center justify-center p-3 pointer-events-auto"
        >
          <div className="w-full max-w-[300px] bg-[#0f172a] border-2 border-[#38bdf8] p-3 shadow-[0_4px_0_#000] space-y-2">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-1.5">
              <h2 className="font-pixel-title text-[10px] text-[#facc15]">
                {modalMode === 'new_slot' ? 'NEW GAME · PILIH SLOT' : 'CONTINUE · PILIH SLOT'}
              </h2>
              <span className="text-[9px] text-[#94a3b8]">3 SLOTS</span>
            </div>

            <div className="space-y-1.5">
              {saveSlots.map((slotInfo, idx) => {
                const isOccupied = slotInfo.save !== null;
                const isDisabled = modalMode === 'continue_slot' && !isOccupied;
                const isActive = slotInfo.slot === activeSlot;
                return (
                  <button
                    key={slotInfo.slot}
                    ref={idx === 0 ? dialogFirstBtnRef : undefined}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (modalMode === 'new_slot') {
                        handleChooseNewSlot(slotInfo);
                      } else if (slotInfo.save) {
                        gameAudio.playMenuSelect();
                        setModalMode('none');
                        onSelectContinueSlot(slotInfo.slot);
                      }
                    }}
                    className={`w-full text-left px-2.5 py-2 border-2 transition ${
                      isDisabled
                        ? 'bg-[#090d16]/70 border-[#1e293b] text-[#475569] cursor-not-allowed'
                        : isOccupied
                          ? 'bg-[#111827] hover:bg-[#1e293b] border-[#38bdf8] text-white cursor-pointer'
                          : 'bg-[#0b1324] hover:bg-[#172554] border-[#facc15] text-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-pixel-title text-[9px] text-[#facc15]">
                        SLOT {slotInfo.slot}
                      </span>
                      {isActive && isOccupied && (
                        <span className="text-[8px] font-bold px-1 py-0.5 bg-[#1d4ed8] text-[#fde047] border border-[#38bdf8]">
                          ACTIVE
                        </span>
                      )}
                      {!isOccupied && (
                        <span className="text-[8px] text-[#94a3b8]">KOSONG</span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#cbd5e1] mt-0.5">
                      {slotInfo.save
                        ? `Lv.${slotInfo.save.level} · Stage ${slotInfo.save.highestUnlockedStage} · ${slotInfo.save.gold}G`
                        : 'Belum ada save data'}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                gameAudio.playMenuSelect();
                setModalMode('none');
              }}
              className="w-full py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#64748b] text-[#e2e8f0] font-pixel-title text-[9px] cursor-pointer"
            >
              KEMBALI
            </button>
          </div>
        </div>
      )}

      {/* Overwrite Warning 1 of 2 */}
      {modalMode === 'warn1' && pendingSlot !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Overwrite Warning 1"
          className="absolute inset-0 z-40 bg-[#050811]/92 flex items-center justify-center p-3 pointer-events-auto"
        >
          <div className="w-full max-w-[290px] bg-[#1a0f0a] border-2 border-[#f97316] p-3 shadow-[0_4px_0_#000] space-y-2.5">
            <h2 className="font-pixel-title text-[10px] text-[#fb923c]">
              PERINGATAN 1 / 2
            </h2>
            <p className="text-[11px] leading-snug text-[#fed7aa]">
              Slot {pendingSlot} sudah memiliki save data (
              {pendingSlotInfo?.save
                ? `Lv.${pendingSlotInfo.save.level}, Stage ${pendingSlotInfo.save.highestUnlockedStage}`
                : 'Occupied'}
              ). Save data lama akan tertimpa!
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                ref={dialogFirstBtnRef}
                type="button"
                onClick={() => {
                  gameAudio.playMenuSelect();
                  setPendingSlot(null);
                  setModalMode('new_slot');
                }}
                className="py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#94a3b8] text-white font-pixel-title text-[9px] cursor-pointer"
              >
                BATAL
              </button>
              <button
                type="button"
                onClick={() => {
                  gameAudio.playMenuSelect();
                  setModalMode('warn2');
                }}
                className="py-1.5 bg-[#c2410c] hover:bg-[#ea580c] border border-[#fdba74] text-white font-pixel-title text-[9px] cursor-pointer"
              >
                LANJUT (1/2)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite Warning 2 of 2 (Final Confirmation) */}
      {modalMode === 'warn2' && pendingSlot !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Overwrite Warning 2"
          className="absolute inset-0 z-40 bg-[#050811]/95 flex items-center justify-center p-3 pointer-events-auto"
        >
          <div className="w-full max-w-[290px] bg-[#1f090d] border-2 border-[#ef4444] p-3 shadow-[0_4px_0_#000] space-y-2.5">
            <h2 className="font-pixel-title text-[10px] text-[#f87171]">
              PERINGATAN TERAKHIR 2 / 2
            </h2>
            <p className="text-[11px] leading-snug text-[#fecaca]">
              Yakin ingin menimpa Slot {pendingSlot}? Semua level, item, dan progress lama di Slot {pendingSlot} akan hilang permanen!
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                ref={dialogFirstBtnRef}
                type="button"
                onClick={() => {
                  gameAudio.playMenuSelect();
                  setPendingSlot(null);
                  setModalMode('new_slot');
                }}
                className="py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#94a3b8] text-white font-pixel-title text-[9px] cursor-pointer"
              >
                BATAL
              </button>
              <button
                type="button"
                onClick={() => {
                  gameAudio.playMenuSelect();
                  const chosen = pendingSlot;
                  setPendingSlot(null);
                  setModalMode('none');
                  onSelectNewGameSlot(chosen);
                }}
                className="py-1.5 bg-[#b91c1c] hover:bg-[#dc2626] border border-[#fca5a5] text-white font-pixel-title text-[9px] cursor-pointer"
              >
                TIMPA SAVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

