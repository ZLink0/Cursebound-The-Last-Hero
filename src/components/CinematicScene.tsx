import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import endingSunriseImg from '../assets/images/ending_sunrise_castle_1795214998006.jpg';
import endingThroneImg from '../assets/images/ending_throne_golden_1795214998886.jpg';
import prologueCurseImg from '../assets/images/prologue_dark_curse_1795214997559.jpg';
import prologuePeacefulImg from '../assets/images/prologue_peaceful_castle_1795214998186.jpg';
import { gameAudio } from '../game/audio';

export type CinematicMode = 'prologue' | 'ending';

interface CinematicSceneProps {
  mode: CinematicMode;
  onPrologueDone: () => void;
  onEndingContinue: () => void;
  onEndingReturnTitle: () => void;
}

interface SlideDef {
  text: string;
  image: string;
  alt: string;
  badge: string;
  aura: 'peace' | 'curse' | 'golden' | 'sunrise';
}

const PROLOGUE_SLIDES: SlideDef[] = [
  {
    text: 'Dahulu, seorang ksatria muda hidup dengan damai.',
    image: prologuePeacefulImg,
    alt: 'Ksatria muda berambut biru memakai Iron Armor dan jubah merah di kastil damai',
    badge: 'PROLOG · KERAJAAN DAHULU',
    aura: 'peace',
  },
  {
    text: 'Namun, monster kegelapan mengutuknya menjadi Skeleton.',
    image: prologueCurseImg,
    alt: 'Kastil hancur gelap dengan monster kegelapan menyihir ksatria menjadi Skeleton',
    badge: 'PROLOG · THE CURSE',
    aura: 'curse',
  },
  {
    text: 'Meski tubuhnya berubah, armor dan jubah merahnya tetap melekat.',
    image: prologueCurseImg,
    alt: 'Skeleton Knight berarmor besi dan jubah merah bertahan dari kutukan',
    badge: 'PROLOG · SKELETON KNIGHT',
    aura: 'curse',
  },
  {
    text: 'Kini, ia memulai perjalanan untuk mengalahkan kegelapan dan mendapatkan kembali tubuh manusianya.',
    image: prologueCurseImg,
    alt: 'Awal perjalanan Skeleton Knight melawan kegelapan',
    badge: 'PROLOG · AWAL PERJALANAN',
    aura: 'curse',
  },
];

const ENDING_SLIDES: SlideDef[] = [
  {
    text: 'Dark Lord akhirnya berhasil dikalahkan.',
    image: endingThroneImg,
    alt: 'Ruang singgasana Dark Lord yang telah hancur setelah dikalahkan',
    badge: 'ENDING · DARK LORD KALAH',
    aura: 'golden',
  },
  {
    text: 'Kutukan yang mengikat tubuhnya perlahan menghilang.',
    image: endingThroneImg,
    alt: 'Cahaya keemasan menyelimuti Skeleton Knight mematahkan kutukan',
    badge: 'ENDING · THE CURSE IS BROKEN',
    aura: 'golden',
  },
  {
    text: 'Sang Skeleton Knight kembali menjadi manusia.',
    image: endingSunriseImg,
    alt: 'Pemuda berambut biru dengan Iron Armor dan jubah merah di kastil matahari terbit',
    badge: 'ENDING · KEMBALI MANUSIA',
    aura: 'sunrise',
  },
  {
    text: 'Perjalanannya akhirnya berakhir.',
    image: endingSunriseImg,
    alt: 'Kastil kerajaan bermandikan cahaya matahari terbit yang damai',
    badge: 'ENDING · FAJAR BARU',
    aura: 'sunrise',
  },
  {
    text: 'THE END',
    image: endingSunriseImg,
    alt: 'Akhir petualangan sang ksatria berarmor besi dan jubah merah',
    badge: 'ENDING · TAMAT',
    aura: 'sunrise',
  },
];

export const CinematicScene: React.FC<CinematicSceneProps> = ({
  mode,
  onPrologueDone,
  onEndingContinue,
  onEndingReturnTitle,
}) => {
  const slides = useMemo(() => (mode === 'prologue' ? PROLOGUE_SLIDES : ENDING_SLIDES), [mode]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [imgError, setImgError] = useState(false);
  const continueBtnRef = useRef<HTMLButtonElement | null>(null);

  const curSlide = slides[Math.min(slideIdx, slides.length - 1)];
  const isTyping = charCount < curSlide.text.length;
  const isLastSlide = slideIdx === slides.length - 1;
  const showEndingChoices = mode === 'ending' && isLastSlide && !isTyping;

  // Reset when mode switches
  useEffect(() => {
    setSlideIdx(0);
    setCharCount(0);
    setImgError(false);
  }, [mode]);

  // Focus Continue on ending final menu
  useEffect(() => {
    if (showEndingChoices) {
      continueBtnRef.current?.focus({ preventScroll: true });
    }
  }, [showEndingChoices]);

  // Typewriter character reveal
  useEffect(() => {
    if (charCount >= curSlide.text.length) return;
    const t = window.setTimeout(() => {
      setCharCount((c) => Math.min(curSlide.text.length, c + 1));
    }, 26);
    return () => window.clearTimeout(t);
  }, [charCount, curSlide.text]);

  // Brief reading pause then auto-advance (except Ending final THE END menu)
  useEffect(() => {
    if (isTyping) return;
    if (mode === 'ending' && isLastSlide) return;
    const delay = mode === 'prologue' && isLastSlide ? 2300 : 2100;
    const t = window.setTimeout(() => {
      if (isLastSlide) {
        if (mode === 'prologue') onPrologueDone();
      } else {
        setSlideIdx((idx) => idx + 1);
        setCharCount(0);
      }
    }, delay);
    return () => window.clearTimeout(t);
  }, [isTyping, isLastSlide, mode, onPrologueDone]);

  const handleAdvance = useCallback(() => {
    if (showEndingChoices) return;
    if (isTyping) {
      setCharCount(curSlide.text.length);
      return;
    }
    gameAudio.playMenuMove();
    if (isLastSlide) {
      if (mode === 'prologue') onPrologueDone();
    } else {
      setSlideIdx((idx) => idx + 1);
      setCharCount(0);
    }
  }, [curSlide.text.length, isLastSlide, isTyping, mode, onPrologueDone, showEndingChoices]);

  const handleSkip = useCallback(() => {
    gameAudio.playMenuSelect();
    if (mode === 'prologue') {
      onPrologueDone();
    } else {
      setSlideIdx(slides.length - 1);
      setCharCount(slides[slides.length - 1].text.length);
    }
  }, [mode, onPrologueDone, slides]);

  // Keyboard support during cinematics (Enter/Space/A advances when not on final buttons; Esc skips)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showEndingChoices) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        handleSkip();
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyZ') {
        e.preventDefault();
        handleAdvance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleAdvance, handleSkip, showEndingChoices]);

  const displayedText = curSlide.text.slice(0, charCount);

  return (
    <div
      data-menu-root="true"
      data-testid={`cinematic-${mode}`}
      onClick={() => {
        if (!showEndingChoices) handleAdvance();
      }}
      className="absolute inset-0 z-30 bg-[#05070e] text-[#f8fafc] flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Background GBC Pixel Art Illustration */}
      <div className="absolute inset-0">
        {!imgError ? (
          <img
            src={curSlide.image}
            alt={curSlide.alt}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover pixelated transition-opacity duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-[#1e1b4b] via-[#0f172a] to-[#020617]" />
        )}

        {/* Cinematic atmospheric tint overlay */}
        {curSlide.aura === 'curse' && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_32%,rgba(46,16,101,0.58)_100%)]" />
        )}
        {curSlide.aura === 'golden' && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(250,204,21,0.30),rgba(9,13,22,0.55)_75%)]" />
        )}
        {curSlide.aura === 'sunrise' && (
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,14,0.82)_0%,rgba(251,191,36,0.12)_55%,transparent_100%)]" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-t from-[#05070e] via-[#05070e]/80 to-transparent" />
      </div>

      {/* Top Chapter Tag & SKIP Button */}
      <div className="relative z-10 flex items-center justify-between px-2.5 pt-2">
        <span className="px-2 py-0.5 bg-[#090d16]/85 border border-[#38bdf8]/70 font-pixel-title text-[7.5px] sm:text-[8px] text-[#fde047] shadow-[0_2px_0_#000]">
          {curSlide.badge}
        </span>

        {!showEndingChoices && (
          <button
            type="button"
            data-testid="cinematic-skip-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleSkip();
            }}
            className="px-2.5 py-1 bg-[#0f172a]/90 hover:bg-[#1e293b] border border-[#facc15] font-pixel-title text-[8px] text-[#facc15] shadow-[0_2px_0_#000] cursor-pointer"
          >
            SKIP &raquo;
          </button>
        )}
      </div>

      {/* Center / Bottom RPG Dialogue Box & Ending Choices */}
      <div className="relative z-10 p-2.5 sm:p-3 space-y-2">
        {showEndingChoices && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ending Menu"
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col items-center gap-2 pb-1"
          >
            <button
              ref={continueBtnRef}
              type="button"
              data-start="true"
              onClick={() => {
                gameAudio.playMenuSelect();
                onEndingContinue();
              }}
              className="w-48 py-2 px-3 bg-[#1d4ed8] hover:bg-[#2563eb] border-2 border-[#facc15] font-pixel-title text-[10px] text-white shadow-[0_3px_0_#000] cursor-pointer"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => {
                gameAudio.playMenuSelect();
                onEndingReturnTitle();
              }}
              className="w-48 py-1.5 px-3 bg-[#0f172a]/95 hover:bg-[#1e293b] border-2 border-[#38bdf8] font-pixel-title text-[9px] text-[#e2e8f0] shadow-[0_3px_0_#000] cursor-pointer"
            >
              Return to Title
            </button>
          </div>
        )}

        {/* Classic RPG Bottom Dialogue Frame */}
        <div className="bg-[#090d16]/94 border-2 border-[#e2e8f0] shadow-[0_0_0_2px_#0f172a,0_4px_0_#000] px-3 py-2.5 min-h-[76px] flex flex-col justify-between">
          <p
            className={`font-pixel-title leading-relaxed ${
              curSlide.text === 'THE END'
                ? 'text-center text-sm sm:text-base text-[#fde047] tracking-widest py-1'
                : 'text-[9px] sm:text-[10px] text-[#f8fafc]'
            }`}
          >
            {displayedText}
            {isTyping && <span className="inline-block w-1.5 h-2.5 bg-[#fde047] ml-1 animate-pulse align-middle" />}
          </p>

          <div className="flex items-center justify-between pt-1.5 text-[7.5px] text-[#94a3b8]">
            <span>
              {slideIdx + 1} / {slides.length}
            </span>
            {!showEndingChoices && (
              <span className="text-[#38bdf8] font-pixel-title text-[7px]">
                {isTyping ? 'TEKAN A / TAP...' : 'LANJUT ▼'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
