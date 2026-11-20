import React, { useEffect, useRef, useState } from 'react';
import { gameAudio } from '../game/audio';

interface HowToPlayModalProps {
  onClose: () => void;
}

type GuideTab = 'keyboard' | 'gamepad' | 'touch';

interface ControlRow {
  input: string;
  action: string;
  accent?: string;
}

const KEYBOARD_ROWS: ControlRow[] = [
  { input: 'A / D / ← / →', action: 'Gerak Kiri / Kanan & Dash Arah' },
  { input: 'W / S / ↑ / ↓', action: 'Tangga, Bidik Atas, Bawah (Udara)' },
  { input: 'SPACE / C', action: 'Loncat / Berenang' },
  { input: 'J / Z (A)', action: 'Combo Pedang · Tahan ≥0.55s: Skill Slash', accent: '#fde047' },
  { input: 'Loncat + ↓ + J/Z', action: 'Jurus Tancap Pedang AoE (Area Damage)', accent: '#f97316' },
  { input: 'K / X (Gun)', action: 'Tembak · Tahan ≥0.55s: Charged Shot', accent: '#38bdf8' },
  { input: 'SHIFT / L (Y)', action: 'Y: Dodge Mundur · Y+Maju: Forward Dash' },
  { input: 'F / V (L Block)', action: 'Block 3 Bar · Timing Tepat: Parry Batu Boss', accent: '#4ade80' },
  { input: 'R / E (Hook)', action: 'Grappling Hook 360° & Tarik Tuas [R]' },
  { input: 'H / ESC / P', action: 'H: Menu Potion · ESC/P: Pause Game' },
];

const GAMEPAD_ROWS: ControlRow[] = [
  { input: 'D-Pad / L-Stick', action: 'Gerak, Panjat Tangga, Arah Serangan' },
  { input: 'Cross / A (Btn 0)', action: 'Loncat (B) / Konfirmasi Menu' },
  { input: 'Square / X (Btn 2)', action: 'Serangan Pedang (A) · Tahan: Skill Slash', accent: '#fde047' },
  { input: 'Loncat + ↓ + Pedang', action: 'Jurus Tancap Pedang AoE ke Tanah', accent: '#f97316' },
  { input: 'Circle / B (Btn 1)', action: 'Tembak Gun (X) · Tahan: Charged Shot', accent: '#38bdf8' },
  { input: 'Triangle / Y (Btn 3)', action: 'Dodge Mundur / Y+Maju: Forward Dash' },
  { input: 'LB / L1 (Btn 4)', action: 'Guard 3 Bar & Parry Batu Boss', accent: '#4ade80' },
  { input: 'RB / R1 (Btn 5)', action: 'Grappling Hook & Tarik Tuas' },
  { input: 'SELECT (Btn 8)', action: 'Buka Menu Potion (Pause)' },
  { input: 'START (Btn 9)', action: 'Pause / Lanjutkan Game' },
];

const TOUCH_ROWS: ControlRow[] = [
  { input: 'D-Pad Sentuh', action: 'Gerak, Tangga, & Arahkan Jurus' },
  { input: 'Tombol B', action: 'Loncat / Keluar Menu Potion & Modal' },
  { input: 'Tombol A', action: 'Combo Pedang · Tahan: Skill Slash 3 Blok', accent: '#fde047' },
  { input: 'Loncat + ↓ + A', action: 'Jurus Tancap Pedang AoE (Damage Area)', accent: '#f97316' },
  { input: 'Tombol X', action: 'Tembak Gun · Tahan: Charged Shot', accent: '#38bdf8' },
  { input: 'Tombol Y', action: 'Dodge Mundur · Y+Maju: Forward Dash' },
  { input: 'Tombol L', action: 'Block 3 Bar · Parry Serangan Batu Boss', accent: '#4ade80' },
  { input: 'Tombol R · HOOK', action: 'Sentuh / Drag 360° ke Arah Hook & Tuas' },
  { input: 'SELECT / START', action: 'SELECT: Menu Potion · START: Pause / OK' },
];

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  const [tab, setTab] = useState<GuideTab>('keyboard');
  const firstTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    firstTabRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Backspace') {
        e.preventDefault();
        gameAudio.playMenuSelect();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = tab === 'keyboard' ? KEYBOARD_ROWS : tab === 'gamepad' ? GAMEPAD_ROWS : TOUCH_ROWS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How To Play"
      className="absolute inset-0 z-30 bg-[#070b14]/95 flex items-center justify-center p-2.5 sm:p-3 text-[#f8fafc] select-none"
    >
      <div className="w-full h-full max-w-[330px] max-h-[340px] bg-[#111827] border-2 border-[#38bdf8] flex flex-col p-2.5 shadow-[0_4px_0_#000]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-1.5 shrink-0">
          <h2 className="font-pixel-title text-[10px] text-[#facc15]">HOW TO PLAY</h2>
          <button
            type="button"
            data-back="true"
            onClick={() => {
              gameAudio.playMenuSelect();
              onClose();
            }}
            className="px-2 py-0.5 bg-[#1e293b] hover:bg-[#334155] border border-[#64748b] text-[8px] font-pixel-title text-[#e2e8f0] cursor-pointer"
          >
            CLOSE
          </button>
        </div>

        {/* 3 Controller Method Tabs */}
        <div className="grid grid-cols-3 gap-1 my-1.5 shrink-0">
          <button
            ref={firstTabRef}
            type="button"
            onClick={() => {
              gameAudio.playMenuMove();
              setTab('keyboard');
            }}
            className={`py-1 px-1 border text-[8px] font-bold cursor-pointer truncate ${
              tab === 'keyboard'
                ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                : 'bg-[#0b1220] border-[#26324d] text-[#94a3b8] hover:text-white'
            }`}
          >
            Keyboard
          </button>
          <button
            type="button"
            onClick={() => {
              gameAudio.playMenuMove();
              setTab('gamepad');
            }}
            className={`py-1 px-1 border text-[8px] font-bold cursor-pointer truncate ${
              tab === 'gamepad'
                ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                : 'bg-[#0b1220] border-[#26324d] text-[#94a3b8] hover:text-white'
            }`}
          >
            Gamepad Eks.
          </button>
          <button
            type="button"
            onClick={() => {
              gameAudio.playMenuMove();
              setTab('touch');
            }}
            className={`py-1 px-1 border text-[8px] font-bold cursor-pointer truncate ${
              tab === 'touch'
                ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                : 'bg-[#0b1220] border-[#26324d] text-[#94a3b8] hover:text-white'
            }`}
          >
            Touch Button
          </button>
        </div>

        {/* Controls List */}
        <div className="flex-1 overflow-y-auto gbc-scroll space-y-1 pr-0.5">
          {rows.map((r) => (
            <div
              key={r.input}
              className="bg-[#0b1220] border border-[#1e293b] px-2 py-1 flex items-center justify-between gap-2 text-[8.5px] leading-tight"
            >
              <span
                className="font-bold shrink-0"
                style={{ color: r.accent ?? '#fde047' }}
              >
                {r.input}
              </span>
              <span className="text-right text-[#cbd5e1]">{r.action}</span>
            </div>
          ))}
        </div>

        {/* Quick Tips Footer */}
        <div className="mt-1.5 pt-1 border-t border-[#1e293b] text-[8px] text-[#94a3b8] text-center shrink-0">
          {tab === 'gamepad'
            ? 'Colok USB / hubungkan Bluetooth Gamepad — otomatis aktif!'
            : 'Tips Boss: Parry batu [L] saat merah tepat waktu -> Stun Boss!'}
        </div>
      </div>
    </div>
  );
};
