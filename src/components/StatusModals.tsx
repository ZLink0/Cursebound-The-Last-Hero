import React from 'react';
import { getSwordDef } from '../game/rpgLogic';
import { MAX_EFFECT_POTIONS, MAX_HP_POTIONS, PotionKind, RunSummary, SaveState } from '../game/types';

interface PauseModalProps {
  stage: number;
  onResume: () => void;
  onOptions: () => void;
  onRestart: () => void;
  onHub: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  stage,
  onResume,
  onOptions,
  onRestart,
  onHub,
  onTitle,
}) => {
  const resumeBtnRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    resumeBtnRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#070a12]/85 p-4">
      <div
        role="dialog"
        aria-label="Game Paused"
        className="w-full max-w-[270px] bg-[#111827] border-2 border-[#facc15] p-4 text-center shadow-[0_4px_0_#000]"
      >
        <h2 className="font-pixel-title text-xs text-[#facc15] mb-1">PAUSED</h2>
        <p className="text-[10px] text-[#94a3b8] mb-3 tabular-nums">Stage {stage}</p>
        <div className="flex flex-col gap-2">
          <button
            ref={resumeBtnRef}
            type="button"
            data-start="true"
            onClick={onResume}
            className="w-full py-2 bg-[#1d4ed8] hover:bg-[#2563eb] border-2 border-[#facc15] font-pixel-title text-[10px] text-white cursor-pointer"
          >
            Resume
          </button>
          <button
            type="button"
            data-testid="pause-option-btn"
            onClick={onOptions}
            className="w-full py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#38bdf8] text-[10px] text-[#38bdf8] cursor-pointer font-bold"
          >
            Option
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[10px] text-[#e2e8f0] cursor-pointer"
          >
            Restart Stage
          </button>
          <button
            type="button"
            onClick={onHub}
            className="w-full py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[10px] text-[#e2e8f0] cursor-pointer"
          >
            RPG Hub
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="w-full py-1.5 bg-[#0f172a] hover:bg-[#1e293b] border border-[#334155] text-[10px] text-[#94a3b8] cursor-pointer"
          >
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
};

interface RunSummaryModalProps {
  summary: RunSummary;
  onNextStage: (nextStage: number) => void;
  onRetry: () => void;
  onHub: () => void;
}

export const RunSummaryModal: React.FC<RunSummaryModalProps> = ({
  summary,
  onNextStage,
  onRetry,
  onHub,
}) => {
  const isWin = summary.outcome === 'victory';
  const nextStage = Math.min(100, summary.stage + 1);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const firstBtn = dialogRef.current?.querySelector<HTMLButtonElement>('[data-start="true"], button');
    firstBtn?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#070a12]/90 p-3">
      <div
        ref={dialogRef}
        role="dialog"
        aria-label={isWin ? 'Stage Clear' : 'Game Over'}
        className={`w-full max-w-[300px] bg-[#111827] border-2 p-3.5 text-center shadow-[0_4px_0_#000] ${
          isWin ? 'border-[#22c55e]' : 'border-[#ef4444]'
        }`}
      >
        <h2
          className={`font-pixel-title text-xs mb-1 ${
            isWin ? 'text-[#4ade80]' : 'text-[#f87171]'
          }`}
        >
          {isWin ? `STAGE ${summary.stage} CLEAR!` : 'GAME OVER'}
        </h2>
        <p className="text-[10px] text-[#cbd5e1] mb-2.5">
          {isWin
            ? `Auto-saved · +${summary.expGained} EXP · +${summary.goldGained}G`
            : `Defeated on Stage ${summary.stage}`}
        </p>

        <div className="grid grid-cols-3 gap-1.5 bg-[#0b101b] border border-[#1e293b] p-2 mb-3 text-[9px] tabular-nums">
          <div>
            <div className="text-[#94a3b8]">SCORE</div>
            <div className="text-[#facc15] font-bold">{summary.score}</div>
          </div>
          <div>
            <div className="text-[#94a3b8]">BEST</div>
            <div className="text-[#38bdf8] font-bold">{summary.bestScore}</div>
          </div>
          <div>
            <div className="text-[#94a3b8]">{isWin ? 'TIME' : summary.bossHpRemainingPct !== undefined ? 'BOSS HP' : 'KILLS'}</div>
            <div className="text-[#f8fafc] font-bold">
              {isWin
                ? `${Math.round(summary.clearTimeSec)}s`
                : summary.bossHpRemainingPct !== undefined
                  ? `${summary.bossHpRemainingPct}%`
                  : summary.enemiesDefeated}
            </div>
          </div>
        </div>

        {summary.foundSword && (
          <div className="mb-2.5 text-[10px] text-[#fde047] bg-[#1e293b] border border-[#eab308] py-1 px-2">
            Found Sword: {getSwordDef(summary.foundSword).name}!
          </div>
        )}

        <div className="flex flex-col gap-2">
          {isWin && summary.stage < 100 ? (
            <button
              type="button"
              data-start="true"
              onClick={() => onNextStage(nextStage)}
              className="w-full py-2 bg-[#16a34a] hover:bg-[#22c55e] border-2 border-[#fde047] font-pixel-title text-[10px] text-white cursor-pointer"
            >
              Next Stage ({nextStage})
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRetry}
              className="w-full py-2 bg-[#1d4ed8] hover:bg-[#2563eb] border-2 border-[#facc15] font-pixel-title text-[10px] text-white cursor-pointer"
            >
              Try Again
            </button>
          )}
          <button
            type="button"
            onClick={onHub}
            className="w-full py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[10px] text-[#e2e8f0] cursor-pointer"
          >
            RPG Hub
          </button>
        </div>
      </div>
    </div>
  );
};

interface PotionMenuModalProps {
  save: SaveState;
  feedback: string | null;
  onUsePotion: (kind: PotionKind) => void;
  onClose: () => void;
}

export const PotionMenuModal: React.FC<PotionMenuModalProps> = ({
  save,
  feedback,
  onUsePotion,
  onClose,
}) => {
  const firstBtnRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    firstBtnRef.current?.focus({ preventScroll: true });
  }, []);

  const items: {
    kind: PotionKind;
    label: string;
    effect: string;
    count: number;
    max: number;
    accent: string;
  }[] = [
    {
      kind: 'hp_potion',
      label: 'HP POT',
      effect: '+45% HP',
      count: save.hpPotions,
      max: MAX_HP_POTIONS,
      accent: 'border-[#22c55e] text-[#4ade80]',
    },
    {
      kind: 'str_potion',
      label: 'STR+ POT',
      effect: '+35% ATK 25s',
      count: save.strPotions ?? 0,
      max: MAX_EFFECT_POTIONS,
      accent: 'border-[#f97316] text-[#fb923c]',
    },
    {
      kind: 'spd_potion',
      label: 'SPD+ POT',
      effect: '+35% SPD 25s',
      count: save.spdPotions ?? 0,
      max: MAX_EFFECT_POTIONS,
      accent: 'border-[#38bdf8] text-[#38bdf8]',
    },
    {
      kind: 'def_potion',
      label: 'DEF+ POT',
      effect: '+50% DEF 25s',
      count: save.defPotions ?? 0,
      max: MAX_EFFECT_POTIONS,
      accent: 'border-[#facc15] text-[#facc15]',
    },
  ];

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 p-2 pointer-events-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Potion Menu"
        data-testid="potion-menu-modal"
        className="w-full bg-[#0b101d]/95 border-2 border-[#facc15] p-2 shadow-[0_-4px_12px_rgba(0,0,0,0.85)]"
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-pixel-title text-[8px] text-[#facc15]">POTION BAG</span>
            <span className="text-[8px] px-1 py-0.5 bg-[#1e293b] border border-[#475569] text-[#94a3b8]">
              PAUSED
            </span>
          </div>
          {feedback ? (
            <span className="text-[8px] text-[#fde047] font-bold truncate">{feedback}</span>
          ) : (
            <span className="text-[8px] text-[#cbd5e1] truncate">Pilih item</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          {items.map((item, idx) => (
            <button
              key={item.kind}
              ref={idx === 0 ? firstBtnRef : undefined}
              type="button"
              data-start={idx === 0 ? 'true' : undefined}
              data-testid={`potion-item-${item.kind}`}
              onClick={() => onUsePotion(item.kind)}
              className={`flex items-center justify-between gap-1 bg-[#111827] hover:bg-[#1e293b] focus:bg-[#1e3a8a] border px-1.5 py-1 text-left cursor-pointer outline-none focus:ring-1 focus:ring-[#facc15] ${item.accent}`}
            >
              <div className="min-w-0">
                <div className="font-pixel-title text-[7px] text-white truncate">{item.label}</div>
                <div className="text-[7px] opacity-90 truncate">{item.effect}</div>
              </div>
              <span className="text-[8px] font-bold tabular-nums shrink-0 text-white">
                {item.count}/{item.max}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1e293b] text-[8px]">
          <span className="text-[#94a3b8]">A:Use · B/SELECT:Back</span>
          <button
            type="button"
            data-testid="potion-menu-back"
            onClick={onClose}
            className="px-2 py-0.5 bg-[#1e293b] hover:bg-[#334155] focus:bg-[#334155] border border-[#64748b] text-[#e2e8f0] cursor-pointer outline-none focus:ring-1 focus:ring-[#facc15]"
          >
            BACK [B]
          </button>
        </div>
      </div>
    </div>
  );
};
