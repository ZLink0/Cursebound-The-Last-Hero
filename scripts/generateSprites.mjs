import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_DIR = path.resolve(process.cwd(), 'public', 'sprites');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---- Pure Node PNG Encoder (RGBA 8-bit) ----
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

class PixelSurface {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.buf = Buffer.alloc(width * height * 4);
  }

  set(x, y, hex) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const idx = (iy * this.w + ix) * 4;
    if (typeof hex === 'string') {
      const clean = hex.startsWith('#') ? hex.slice(1) : hex;
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      const a = clean.length === 8 ? parseInt(clean.slice(6, 8), 16) : 255;
      if (a === 0) return;
      this.buf[idx] = r;
      this.buf[idx + 1] = g;
      this.buf[idx + 2] = b;
      this.buf[idx + 3] = a;
    } else if (Array.isArray(hex)) {
      if (hex[3] === 0) return;
      this.buf[idx] = hex[0];
      this.buf[idx + 1] = hex[1];
      this.buf[idx + 2] = hex[2];
      this.buf[idx + 3] = hex[3] ?? 255;
    }
  }

  rect(x, y, w, h, hex) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(x + dx, y + dy, hex);
      }
    }
  }

  circle(cx, cy, r, hex) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r + 0.3) {
          this.set(cx + dx, cy + dy, hex);
        }
      }
    }
  }

  line(x0, y0, x1, y1, hex) {
    let ix0 = Math.round(x0), iy0 = Math.round(y0);
    const ix1 = Math.round(x1), iy1 = Math.round(y1);
    const dx = Math.abs(ix1 - ix0), sx = ix0 < ix1 ? 1 : -1;
    const dy = -Math.abs(iy1 - iy0), sy = iy0 < iy1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      this.set(ix0, iy0, hex);
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; ix0 += sx; }
      if (e2 <= dx) { err += dx; iy0 += sy; }
    }
  }

  save(filename) {
    const outPath = path.join(OUT_DIR, filename);
    fs.writeFileSync(outPath, encodePNG(this.w, this.h, this.buf));
    console.log(`Generated ${filename} (${this.w}x${this.h})`);
  }
}

// ---- 1. HERO SPRITE SHEET (192 x 640 -> 6 cols x 20 rows of 32x32) ----
// Skull Head + Iron Armor + Red Cape, Right-hand Sword + Left-hand Gun with visible hands
// Row 17 = hangClimb (4 frames), Row 18 = block (3 frames), Row 19 = back (4 frames back-facing)
const HERO_PAL = {
  O: '#090d16',
  // Skull Bone
  SK1: '#94a3b8', // Skull shadow / cheekbone
  SK2: '#e2e8f0', // Skull bone mid
  SK3: '#ffffff', // Skull highlight
  EYE: '#ef4444', // Glowing crimson skull eyes
  EY2: '#fef08a', // Eye spark
  // Iron Armor
  I1: '#334155', // Dark iron shadow
  I2: '#64748b', // Iron mid
  I3: '#cbd5e1', // Iron edge highlight
  I4: '#f8fafc', // Metallic glint
  S1: '#1e293b', // Dark undersuit
  S2: '#475569', // Gauntlet / joint
  // Red Cape ("jubah merah")
  C1: '#7f1d1d', // Cape deep shadow
  C2: '#dc2626', // Cape crimson mid
  C3: '#ef4444', // Cape highlight
  // Accents & Weapons
  G1: '#facc15', // Gold belt buckle / hilt
  P1: '#334155', // Gun dark
  P2: '#94a3b8', // Gun steel
  P3: '#38bdf8', // Gun plasma core
  W1: '#cbd5e1', // Sword steel
  W2: '#ffffff', // Sword edge
  FX1: '#fef08a',
  FX2: '#38bdf8',
  POT1: '#22c55e',
  POT2: '#bbf7d0',
};

function drawHeroFrame(surf, col, row, opts = {}) {
  const ox = col * 32;
  const oy = row * 32;
  const {
    bobY = 0,
    leanX = 0,
    squashY = 0,
    capeWave = 0,
    legMode = 'idle',
    armMode = 'buster',
    muzzle = false,
    swordFrame = -1,
    climbFrame = -1,
    hangFrame = -1,
    blockFrame = -1,
    backFrame = -1,
    plungeFrame = -1,
    deadFrame = -1,
    hurtFlash = false,
  } = opts;

  if (deadFrame >= 0) {
    if (deadFrame === 0) {
      drawHeroFrame(surf, col, row, { legMode: 'hurt', armMode: 'hurt', bobY: 1, hurtFlash: true });
      return;
    }
    if (deadFrame === 1) {
      surf.rect(ox + 10, oy + 14, 12, 10, HERO_PAL.O);
      surf.rect(ox + 11, oy + 15, 10, 8, HERO_PAL.I2);
      surf.rect(ox + 11, oy + 8, 10, 7, HERO_PAL.SK2);
      surf.rect(ox + 12, oy + 10, 2, 2, HERO_PAL.O);
      surf.rect(ox + 16, oy + 10, 2, 2, HERO_PAL.O);
      surf.rect(ox + 9, oy + 24, 6, 4, HERO_PAL.I1);
      surf.rect(ox + 17, oy + 24, 6, 4, HERO_PAL.I1);
      return;
    }
    if (deadFrame === 2) {
      surf.rect(ox + 6, oy + 22, 20, 6, HERO_PAL.O);
      surf.rect(ox + 7, oy + 23, 18, 4, HERO_PAL.C2);
      surf.rect(ox + 6, oy + 21, 7, 5, HERO_PAL.SK2);
      surf.rect(ox + 20, oy + 23, 5, 4, HERO_PAL.I2);
      return;
    }
    const spread = deadFrame === 3 ? 6 : 11;
    const pts = [
      [16 - spread, 20], [16 + spread, 20],
      [16, 20 - spread], [16, 20 + Math.min(8, spread)],
      [16 - Math.round(spread * 0.7), 20 - Math.round(spread * 0.7)],
      [16 + Math.round(spread * 0.7), 20 - Math.round(spread * 0.7)],
      [16 - Math.round(spread * 0.7), 20 + Math.round(spread * 0.5)],
      [16 + Math.round(spread * 0.7), 20 + Math.round(spread * 0.5)],
    ];
    for (const [px, py] of pts) {
      surf.circle(ox + px, oy + py, 2, HERO_PAL.C3);
      surf.set(ox + px, oy + py, HERO_PAL.SK3);
    }
    return;
  }

  // Dedicated Plunge Slam Sprite (Jump + Down + A: Diving & planting sword into ground for AoE shockwave)
  if (plungeFrame >= 0) {
    const cx = ox + 16;
    if (plungeFrame === 0) {
      // Airborne vertical dive gripping blade straight down + red cape billowing upward
      for (let i = 0; i < 6; i++) {
        const w = Math.max(2, 6 - i);
        surf.rect(cx - 3 - Math.round(i * 0.4), oy + 2 + i * 2, w + 3, 3, HERO_PAL.O);
        surf.rect(cx - 2 - Math.round(i * 0.4), oy + 3 + i * 2, w + 1, 2, i % 2 === 0 ? HERO_PAL.C2 : HERO_PAL.C3);
      }
      // Boots tucked up high
      surf.rect(cx - 5, oy + 6, 4, 4, HERO_PAL.I2);
      surf.rect(cx + 1, oy + 6, 4, 4, HERO_PAL.I2);
      // Iron torso leaning downward
      surf.rect(cx - 5, oy + 9, 10, 8, HERO_PAL.O);
      surf.rect(cx - 4, oy + 10, 8, 6, HERO_PAL.I2);
      // Skull head tucked forward
      surf.rect(cx - 4, oy + 11, 8, 7, HERO_PAL.O);
      surf.rect(cx - 3, oy + 12, 6, 5, HERO_PAL.SK2);
      surf.set(cx - 1, oy + 14, HERO_PAL.EYE);
      surf.set(cx + 2, oy + 14, HERO_PAL.EYE);
      // Both hands gripping sword hilt pointing straight down
      surf.rect(cx - 2, oy + 17, 4, 3, HERO_PAL.G1);
      surf.rect(cx - 2, oy + 20, 4, 11, HERO_PAL.O);
      surf.rect(cx - 1, oy + 20, 2, 10, HERO_PAL.W2);
      surf.set(cx, oy + 30, HERO_PAL.FX1);
      return;
    }

    // Frames 1..3: Crouched knight planting sword blade deep into ground + expanding ground shockwave
    const crouchY = plungeFrame === 1 ? 3 : plungeFrame === 2 ? 2 : 1;
    const baseY = oy + 28;
    const bodyTop = oy + 14 + crouchY;
    // Fluttering red cape behind crouched knight
    for (let i = 0; i < 6; i++) {
      surf.rect(cx - 4 - i, bodyTop - 1 + (i % 2), 2, 8 - Math.floor(i * 0.5), HERO_PAL.O);
      surf.rect(cx - 4 - i, bodyTop + (i % 2), 1, 6 - Math.floor(i * 0.5), i % 2 === 0 ? HERO_PAL.C2 : HERO_PAL.C3);
    }
    // Wide knee-bent stance boots
    surf.rect(cx - 8, baseY - 4, 5, 4, HERO_PAL.O);
    surf.rect(cx - 7, baseY - 3, 3, 2, HERO_PAL.I2);
    surf.rect(cx + 3, baseY - 4, 5, 4, HERO_PAL.O);
    surf.rect(cx + 4, baseY - 3, 3, 2, HERO_PAL.I2);
    // Iron chest crouched forward
    surf.rect(cx - 5, bodyTop, 10, 9, HERO_PAL.O);
    surf.rect(cx - 4, bodyTop + 1, 8, 7, HERO_PAL.I2);
    surf.rect(cx - 3, bodyTop + 1, 6, 2, HERO_PAL.I3);
    // Skull head focused down
    surf.rect(cx - 5, bodyTop - 7, 10, 8, HERO_PAL.O);
    surf.rect(cx - 4, bodyTop - 6, 8, 6, HERO_PAL.SK2);
    surf.rect(cx - 2, bodyTop - 6, 5, 2, HERO_PAL.SK3);
    surf.set(cx + 1, bodyTop - 3, HERO_PAL.EYE);
    surf.set(cx + 3, bodyTop - 3, HERO_PAL.EYE);
    // Sword thrust vertically into earth in front of knight
    const bladeX = cx + 5;
    surf.rect(bladeX - 2, bodyTop + 2, 5, 2, HERO_PAL.G1); // hilt & guard
    surf.rect(bladeX - 1, bodyTop - 1, 3, 4, HERO_PAL.SK2); // hands on pommel
    surf.rect(bladeX - 1, bodyTop + 4, 3, baseY - (bodyTop + 4), HERO_PAL.O);
    surf.rect(bladeX, bodyTop + 4, 1, baseY - (bodyTop + 4), HERO_PAL.W2);
    // Ground shockwave burst at blade tip
    const waveR = plungeFrame === 1 ? 6 : plungeFrame === 2 ? 12 : 9;
    surf.line(Math.max(ox + 1, bladeX - waveR), baseY, Math.min(ox + 30, bladeX + waveR), baseY, HERO_PAL.FX1);
    surf.line(Math.max(ox + 1, bladeX - waveR + 2), baseY - 2, Math.max(ox + 1, bladeX - waveR), baseY, HERO_PAL.FX2);
    surf.line(Math.min(ox + 30, bladeX + waveR - 2), baseY - 2, Math.min(ox + 30, bladeX + waveR), baseY, HERO_PAL.FX2);
    if (plungeFrame <= 2) {
      surf.set(bladeX - 4, baseY - 4, HERO_PAL.FX1);
      surf.set(bladeX + 5, baseY - 5, HERO_PAL.FX1);
    }
    return;
  }

  // Dedicated Back-Facing Sprite ("Sprite ketika menghadap ke belakang")
  if (backFrame >= 0) {
    const cx = ox + 16;
    const bob = backFrame === 1 || backFrame === 3 ? 1 : 0;
    const sway = backFrame === 1 ? -1 : backFrame === 3 ? 1 : 0;
    const headY = oy + 4 + bob;
    const bodyTop = oy + 14 + bob;

    // Back-view iron boots
    const lStep = backFrame === 1 ? -1 : 0;
    const rStep = backFrame === 3 ? -1 : 0;
    surf.rect(cx - 5, oy + 24 + lStep, 4, 5, HERO_PAL.O);
    surf.rect(cx - 4, oy + 25 + lStep, 2, 3, HERO_PAL.I2);
    surf.rect(cx + 1, oy + 24 + rStep, 4, 5, HERO_PAL.O);
    surf.rect(cx + 2, oy + 25 + rStep, 2, 3, HERO_PAL.I2);

    // Sword & Gun held by left/right hands peeking past sides from behind
    // Right hand holding sword at right side (blade pointing up-right)
    surf.rect(cx + 5, bodyTop + 3, 4, 4, HERO_PAL.O);
    surf.rect(cx + 6, bodyTop + 4, 2, 2, HERO_PAL.SK2); // skeletal/gloved hand
    surf.rect(cx + 7, bodyTop + 2, 2, 2, HERO_PAL.G1); // hilt
    surf.line(cx + 8, bodyTop + 1, cx + 12, bodyTop - 6, HERO_PAL.O);
    surf.line(cx + 8, bodyTop, cx + 11, bodyTop - 6, HERO_PAL.W1);
    surf.set(cx + 11, bodyTop - 6, HERO_PAL.W2);
    // Left hand holding gun at left side
    surf.rect(cx - 9, bodyTop + 3, 4, 4, HERO_PAL.O);
    surf.rect(cx - 8, bodyTop + 4, 2, 2, HERO_PAL.SK2);
    surf.rect(cx - 12, bodyTop + 3, 4, 3, HERO_PAL.P1);
    surf.rect(cx - 11, bodyTop + 4, 2, 1, HERO_PAL.P2);

    // Full flowing Red Cape draping down the back
    surf.rect(cx - 6, bodyTop - 1, 12, 13, HERO_PAL.O);
    surf.rect(cx - 5, bodyTop, 10, 11, HERO_PAL.C2);
    surf.rect(cx - 5 + sway, bodyTop + 3, 4, 8, HERO_PAL.C1);
    surf.rect(cx + 1 + sway, bodyTop + 2, 3, 9, HERO_PAL.C3);
    // Cape hem flutter
    surf.rect(cx - 6 + sway, bodyTop + 10, 4, 3, HERO_PAL.C1);
    surf.rect(cx + 2 - sway, bodyTop + 10, 4, 3, HERO_PAL.C2);

    // Iron Shoulder Pauldrons & Upper Back Collar
    surf.rect(cx - 7, bodyTop - 1, 5, 4, HERO_PAL.O);
    surf.rect(cx - 6, bodyTop, 3, 2, HERO_PAL.I3);
    surf.rect(cx + 2, bodyTop - 1, 5, 4, HERO_PAL.O);
    surf.rect(cx + 3, bodyTop, 3, 2, HERO_PAL.I3);
    surf.rect(cx - 4, bodyTop - 1, 8, 2, HERO_PAL.C1);

    // Back of Skull Cranium (bone shading, occipital ridge, no face visible)
    surf.rect(cx - 5, headY - 1, 10, 10, HERO_PAL.O);
    surf.rect(cx - 4, headY, 8, 8, HERO_PAL.SK2);
    surf.rect(cx - 3, headY, 6, 2, HERO_PAL.SK3);
    surf.rect(cx - 4, headY + 5, 8, 3, HERO_PAL.SK1);
    surf.rect(cx - 2, headY + 3, 4, 2, HERO_PAL.SK1);
    return;
  }

  // Dedicated Hand-Over-Hand Hanging Animation ("gerakan tangan bergelantung")
  if (hangFrame >= 0) {
    const swing = hangFrame === 1 ? 1 : hangFrame === 3 ? -1 : 0;
    const cx = ox + 16 + swing;
    const headY = oy + 8;
    const bodyTop = oy + 18;
    const leftUp = hangFrame === 0 || hangFrame === 1;
    const rightUp = hangFrame === 2 || hangFrame === 3;
    // Left arm
    surf.rect(cx - 6, leftUp ? oy + 2 : oy + 6, 3, leftUp ? 16 : 12, HERO_PAL.O);
    surf.rect(cx - 5, leftUp ? oy + 3 : oy + 7, 2, leftUp ? 14 : 10, HERO_PAL.I2);
    surf.rect(cx - 6, leftUp ? oy + 2 : oy + 6, 3, 2, HERO_PAL.SK2);
    // Right arm
    surf.rect(cx + 3, rightUp ? oy + 2 : oy + 6, 3, rightUp ? 16 : 12, HERO_PAL.O);
    surf.rect(cx + 4, rightUp ? oy + 3 : oy + 7, 2, rightUp ? 14 : 10, HERO_PAL.I2);
    surf.rect(cx + 3, rightUp ? oy + 2 : oy + 6, 3, 2, HERO_PAL.SK2);
    // Dangling iron boots
    surf.rect(cx - 4 + swing, oy + 26, 4, 4, HERO_PAL.O);
    surf.rect(cx - 3 + swing, oy + 26, 3, 3, HERO_PAL.I2);
    surf.rect(cx + 1 + swing, oy + 25, 4, 4, HERO_PAL.O);
    surf.rect(cx + 1 + swing, oy + 25, 3, 3, HERO_PAL.I2);
    // Red cape behind torso
    surf.rect(cx - 5, bodyTop + 1, 10, 7, HERO_PAL.C1);
    // Iron Armor torso
    surf.rect(cx - 6, bodyTop - 1, 12, 9, HERO_PAL.O);
    surf.rect(cx - 5, bodyTop, 10, 7, HERO_PAL.I2);
    surf.rect(cx - 4, bodyTop + 1, 8, 2, HERO_PAL.I3);
    surf.rect(cx - 4, bodyTop + 5, 8, 2, HERO_PAL.I1);
    surf.rect(cx - 1, bodyTop + 5, 2, 2, HERO_PAL.G1);
    // Skull head
    surf.rect(cx - 5, headY, 10, 9, HERO_PAL.O);
    surf.rect(cx - 4, headY + 1, 8, 7, HERO_PAL.SK2);
    surf.rect(cx - 3, headY + 1, 6, 2, HERO_PAL.SK3);
    surf.rect(cx - 3, headY + 4, 2, 2, HERO_PAL.O);
    surf.rect(cx + 1, headY + 4, 2, 2, HERO_PAL.O);
    surf.set(cx - 2, headY + 4, HERO_PAL.EYE);
    surf.set(cx + 2, headY + 4, HERO_PAL.EYE);
    return;
  }

  // Ladder Climb (also drawn from behind showing Red Cape & Back of Skull!)
  if (climbFrame >= 0) {
    const cx = ox + 16;
    const bodyTop = oy + 14;
    const headY = oy + 4;
    const lOffset = climbFrame % 2 === 0 ? -2 : 1;
    const rOffset = climbFrame % 2 === 0 ? 1 : -2;
    const la = climbFrame % 2 === 0 ? -5 : 0;
    const ra = climbFrame % 2 === 0 ? 0 : -5;

    // Iron climbing boots
    surf.rect(cx - 5, oy + 24 + lOffset, 4, 4, HERO_PAL.O);
    surf.rect(cx - 4, oy + 25 + lOffset, 2, 2, HERO_PAL.I2);
    surf.rect(cx + 1, oy + 24 + rOffset, 4, 4, HERO_PAL.O);
    surf.rect(cx + 2, oy + 25 + rOffset, 2, 2, HERO_PAL.I2);

    // Reaching armored arms + hands gripping ladder
    surf.rect(cx - 7, bodyTop + la, 3, 7, HERO_PAL.O);
    surf.rect(cx - 6, bodyTop + la + 1, 2, 5, HERO_PAL.I2);
    surf.rect(cx - 7, bodyTop + la, 3, 2, HERO_PAL.SK2);
    surf.rect(cx + 4, bodyTop + ra, 3, 7, HERO_PAL.O);
    surf.rect(cx + 5, bodyTop + ra + 1, 2, 5, HERO_PAL.I2);
    surf.rect(cx + 4, bodyTop + ra, 3, 2, HERO_PAL.SK2);

    // Red Cape covering back while climbing
    surf.rect(cx - 6, bodyTop - 1, 12, 12, HERO_PAL.O);
    surf.rect(cx - 5, bodyTop, 10, 10, HERO_PAL.C2);
    surf.rect(cx - 5, bodyTop + 3, 4, 7, HERO_PAL.C1);
    surf.rect(cx + 1, bodyTop + 2, 3, 8, HERO_PAL.C3);
    // Iron pauldrons
    surf.rect(cx - 6, bodyTop - 1, 4, 3, HERO_PAL.I3);
    surf.rect(cx + 2, bodyTop - 1, 4, 3, HERO_PAL.I3);

    // Back of skull head
    surf.rect(cx - 5, headY - 1, 10, 10, HERO_PAL.O);
    surf.rect(cx - 4, headY, 8, 8, HERO_PAL.SK2);
    surf.rect(cx - 3, headY, 6, 2, HERO_PAL.SK3);
    surf.rect(cx - 4, headY + 5, 8, 3, HERO_PAL.SK1);
    return;
  }

  const cx = ox + 16 + leanX;
  const baseY = oy + 28;
  const bodyTop = oy + 13 + bobY + squashY;

  // Flowing Red Cape ("jubah merah") draping behind torso and fluttering in wind
  const capeLen = legMode === 'dash' ? 11 : legMode.startsWith('run') ? 8 : 6;
  const capeDrop = legMode === 'dash' ? 6 : 11;
  for (let i = 0; i < capeLen; i++) {
    const wave = Math.round(Math.sin((i + capeWave) * 0.8) * 1.3);
    const sx = cx - 4 - i;
    const h = Math.max(4, capeDrop - Math.floor(i * 0.6));
    surf.rect(sx, bodyTop + wave, 2, h + 1, HERO_PAL.O);
    surf.rect(sx, bodyTop + 1 + wave, 1, h - 1, i % 3 === 0 ? HERO_PAL.C3 : i % 2 === 0 ? HERO_PAL.C2 : HERO_PAL.C1);
  }

  const drawBoot = (bx, by, w = 4, h = 4) => {
    surf.rect(bx - 1, by - 1, w + 2, h + 1, HERO_PAL.O);
    surf.rect(bx, by, w, h, HERO_PAL.I2);
    surf.rect(bx, by, w, 1, HERO_PAL.I3);
    surf.rect(bx, by + h - 1, w, 1, HERO_PAL.I1);
  };

  if (legMode === 'idle' || legMode === 'land') {
    const lh = legMode === 'land' ? 3 : 4;
    drawBoot(cx - 5, baseY - lh, 4, lh);
    drawBoot(cx + 1, baseY - lh, 4, lh);
  } else if (legMode === 'jump') {
    drawBoot(cx - 5, baseY - 6, 4, 4);
    drawBoot(cx + 2, baseY - 4, 4, 4);
  } else if (legMode === 'fall') {
    drawBoot(cx - 6, baseY - 5, 4, 4);
    drawBoot(cx + 2, baseY - 5, 4, 4);
  } else if (legMode === 'dash') {
    drawBoot(cx - 8, baseY - 4, 5, 3);
    drawBoot(cx + 1, baseY - 5, 4, 3);
    surf.rect(cx - 12, baseY - 4, 3, 2, HERO_PAL.C3);
    surf.set(cx - 13, baseY - 3, HERO_PAL.FX1);
  } else if (legMode === 'hurt') {
    drawBoot(cx - 6, baseY - 5, 4, 4);
    drawBoot(cx + 2, baseY - 3, 4, 4);
  } else {
    const phase = parseInt(legMode.replace(/\D/g, ''), 10) || 0;
    const stride = legMode.startsWith('run') ? 4 : 3;
    const angle = (phase / (legMode.startsWith('run') ? 6 : 4)) * Math.PI * 2;
    const lx = Math.round(Math.sin(angle) * stride);
    const rx = Math.round(-Math.sin(angle) * stride);
    const ly = Math.min(0, Math.round(Math.cos(angle) * -2));
    const ry = Math.min(0, Math.round(-Math.cos(angle) * -2));
    drawBoot(cx - 2 + lx, baseY - 4 + ly, 4, 4);
    drawBoot(cx - 1 + rx, baseY - 4 + ry, 4, 4);
  }

  const torsoH = 10 - squashY;
  // Right Arm + Visible Hand gripping Sword in guard position
  if (!armMode.startsWith('sword') && blockFrame < 0) {
    // Iron arm + forearm + visible bone/gauntlet hand holding sword hilt
    surf.rect(cx - 9, bodyTop + 1, 5, 4, HERO_PAL.O);
    surf.rect(cx - 8, bodyTop + 2, 3, 2, HERO_PAL.I2);
    surf.rect(cx - 9, bodyTop + 1, 2, 3, HERO_PAL.SK2); // hand gripping hilt
    surf.rect(cx - 9, bodyTop, 2, 2, HERO_PAL.G1); // gold crossguard
    surf.line(cx - 8, bodyTop, cx - 14, bodyTop - 8, HERO_PAL.O);
    surf.line(cx - 8, bodyTop - 1, cx - 13, bodyTop - 8, HERO_PAL.W1);
    surf.set(cx - 13, bodyTop - 8, HERO_PAL.W2);
  }

  // Iron Armor Chestplate + Red Cape Collar + Shoulder Pauldrons
  surf.rect(cx - 6, bodyTop - 1, 12, torsoH + 2, HERO_PAL.O);
  surf.rect(cx - 5, bodyTop, 10, torsoH, hurtFlash ? HERO_PAL.W2 : HERO_PAL.I2);
  surf.rect(cx - 5, bodyTop, 4, torsoH, hurtFlash ? HERO_PAL.FX1 : HERO_PAL.I1);
  // Red cape shoulder drape
  surf.rect(cx - 6, bodyTop - 1, 11, 2, HERO_PAL.C2);
  // Iron Shoulder Pauldrons
  surf.rect(cx - 7, bodyTop - 1, 4, 4, HERO_PAL.O);
  surf.rect(cx - 6, bodyTop, 3, 3, HERO_PAL.I3);
  surf.rect(cx + 3, bodyTop - 1, 4, 4, HERO_PAL.O);
  surf.rect(cx + 3, bodyTop, 3, 3, HERO_PAL.I3);
  // Chest steel ribs / plate highlight + gold belt buckle
  surf.rect(cx - 1, bodyTop + 2, 4, 3, HERO_PAL.I3);
  surf.set(cx + 1, bodyTop + 3, HERO_PAL.I4);
  surf.rect(cx - 5, bodyTop + torsoH - 3, 10, 2, HERO_PAL.S1);
  surf.rect(cx - 1, bodyTop + torsoH - 3, 3, 2, HERO_PAL.G1);

  // Skull Head ("kepala tengkorak"): Bone cranium, dark eye sockets, glowing red eyes, teeth jaw!
  const headY = bodyTop - 10;
  surf.rect(cx - 5, headY - 1, 11, 10, HERO_PAL.O);
  surf.rect(cx - 4, headY, 9, 7, hurtFlash ? HERO_PAL.W2 : HERO_PAL.SK2);
  surf.rect(cx - 3, headY, 7, 2, HERO_PAL.SK3); // cranium shine
  surf.rect(cx - 4, headY + 1, 2, 6, HERO_PAL.SK1); // back skull shade
  // Skull jaw & teeth
  surf.rect(cx - 2, headY + 6, 7, 3, HERO_PAL.SK2);
  surf.set(cx, headY + 8, HERO_PAL.O);
  surf.set(cx + 2, headY + 8, HERO_PAL.O);
  surf.set(cx + 4, headY + 8, HERO_PAL.O);
  // Sunken dark eye sockets + glowing red eyes + nasal slit
  surf.rect(cx - 1, headY + 2, 3, 3, HERO_PAL.O);
  surf.rect(cx + 3, headY + 2, 3, 3, HERO_PAL.O);
  surf.set(cx, headY + 3, HERO_PAL.EYE);
  surf.set(cx + 4, headY + 3, HERO_PAL.EYE);
  surf.set(cx + 4, headY + 2, HERO_PAL.EY2);
  surf.set(cx + 2, headY + 5, HERO_PAL.O); // nasal cavity

  // Block Pose (Row 18: Iron Shield + Sword held by visible hand)
  if (blockFrame >= 0) {
    surf.rect(cx + 2, bodyTop + 3, 3, 3, HERO_PAL.SK2); // hand gripping shield
    surf.rect(cx + 4, bodyTop - 3, 5, 13, HERO_PAL.O);
    surf.rect(cx + 5, bodyTop - 2, 3, 11, HERO_PAL.I3);
    surf.rect(cx + 6, bodyTop, 2, 7, HERO_PAL.C2);
    if (blockFrame % 2 === 1) {
      surf.line(cx + 9, bodyTop - 2, cx + 9, bodyTop + 9, HERO_PAL.W2);
    }
    return;
  }

  if (armMode.startsWith('potion')) {
    const pStep = parseInt(armMode.replace(/\D/g, ''), 10) || 0;
    const py = bodyTop + 1 - pStep;
    surf.rect(cx + 2, bodyTop + 1, 4, 3, HERO_PAL.I2);
    surf.rect(cx + 4, bodyTop, 3, 3, HERO_PAL.SK2); // hand holding potion
    surf.rect(cx + 5, py - 5, 4, 5, HERO_PAL.O);
    surf.rect(cx + 6, py - 4, 2, 3, HERO_PAL.POT1);
    surf.set(cx + 6, py - 5, HERO_PAL.POT2);
    return;
  }

  if (armMode === 'shootUp') {
    surf.rect(cx + 1, bodyTop - 2, 4, 3, HERO_PAL.I2);
    surf.rect(cx + 2, bodyTop - 4, 3, 3, HERO_PAL.SK2); // hand gripping gun upward
    surf.rect(cx + 2, bodyTop - 9, 4, 7, HERO_PAL.O);
    surf.rect(cx + 3, bodyTop - 8, 2, 5, HERO_PAL.P2);
    surf.set(cx + 3, bodyTop - 6, HERO_PAL.P3);
    if (muzzle) {
      surf.circle(cx + 4, bodyTop - 11, 2, HERO_PAL.FX1);
      surf.set(cx + 4, bodyTop - 12, HERO_PAL.W2);
    }
    return;
  }

  if (armMode === 'shootDown') {
    surf.rect(cx + 1, bodyTop + 2, 4, 3, HERO_PAL.I2);
    surf.rect(cx + 2, bodyTop + 4, 3, 2, HERO_PAL.SK2); // hand gripping gun downward
    surf.rect(cx + 2, bodyTop + 5, 4, 6, HERO_PAL.O);
    surf.rect(cx + 3, bodyTop + 6, 2, 4, HERO_PAL.P2);
    surf.set(cx + 3, bodyTop + 7, HERO_PAL.P3);
    if (muzzle) {
      surf.circle(cx + 4, bodyTop + 12, 2, HERO_PAL.FX1);
      surf.set(cx + 4, bodyTop + 13, HERO_PAL.W2);
    }
    return;
  }

  if (armMode.startsWith('sword')) {
    const dir = armMode === 'swordWind' ? -1 : 1;
    // Left arm & hand gripping gun at waist
    surf.rect(cx - 5, bodyTop + 3, 5, 3, HERO_PAL.P1);
    surf.rect(cx - 2, bodyTop + 3, 2, 2, HERO_PAL.SK2);
    // Right armored arm & visible hand swinging sword forward
    surf.rect(cx + 1, bodyTop + 2, 4, 3, HERO_PAL.I2);
    surf.rect(cx + 4, bodyTop + 1, 3, 3, HERO_PAL.SK2); // hand wrapping sword hilt
    if (swordFrame === 0) {
      surf.line(cx - 2, bodyTop + 1, cx - 7, bodyTop - 6, HERO_PAL.O);
      surf.line(cx - 2, bodyTop, cx - 6, bodyTop - 6, HERO_PAL.W1);
    } else if (swordFrame === 1) {
      surf.rect(cx + 6, bodyTop + 1, 10, 3, HERO_PAL.O);
      surf.rect(cx + 7, bodyTop + 2, 8, 1, HERO_PAL.W2);
      surf.rect(cx + 6, bodyTop + 1, 2, 3, HERO_PAL.G1);
    } else if (swordFrame === 2) {
      surf.line(cx + 6, bodyTop + 2, cx + 14, bodyTop + 8 * dir, HERO_PAL.O);
      surf.line(cx + 6, bodyTop + 1, cx + 13, bodyTop + 7 * dir, HERO_PAL.W2);
    } else {
      surf.line(cx + 5, bodyTop + 3, cx + 11, bodyTop - 5, HERO_PAL.W1);
    }
    return;
  }

  // Left Armored Arm + Distinct Gripping Hand holding Gun aimed forward
  const gunExt = armMode === 'shoot' ? 9 : 7;
  const gunY = bodyTop + 2;
  surf.rect(cx, gunY, 4, 3, HERO_PAL.I2); // iron arm forward
  surf.rect(cx + 3, gunY + 1, 3, 3, HERO_PAL.O);
  surf.rect(cx + 3, gunY + 1, 2, 2, HERO_PAL.SK2); // visible hand holding gun grip!
  surf.rect(cx + 4, gunY - 1, gunExt + 1, 5, HERO_PAL.O);
  surf.rect(cx + 5, gunY, gunExt - 1, 3, HERO_PAL.P2);
  surf.rect(cx + 5, gunY + 2, gunExt - 1, 1, HERO_PAL.P1);
  surf.set(cx + 6, gunY + 1, HERO_PAL.P3);
  if (muzzle) {
    surf.circle(cx + 5 + gunExt + 1, gunY + 1, 2, HERO_PAL.FX1);
    surf.set(cx + 5 + gunExt + 2, gunY + 1, HERO_PAL.W2);
  }
}

function buildHeroSheet() {
  const surf = new PixelSurface(192, 672);
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 0, { bobY: i === 2 ? 1 : 0, capeWave: i });
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 1, { legMode: `walk${i}`, bobY: i % 2 === 1 ? -1 : 0, capeWave: i });
  for (let i = 0; i < 6; i++) drawHeroFrame(surf, i, 2, { legMode: `run${i}`, leanX: 1, bobY: i % 3 === 1 ? -1 : 0, capeWave: i * 1.4 });
  drawHeroFrame(surf, 0, 3, { legMode: 'land', squashY: 1, capeWave: 0 });
  drawHeroFrame(surf, 1, 3, { legMode: 'jump', bobY: -2, capeWave: 2 });
  drawHeroFrame(surf, 2, 3, { legMode: 'jump', bobY: -3, capeWave: 4 });
  for (let i = 0; i < 3; i++) drawHeroFrame(surf, i, 4, { legMode: 'fall', bobY: -1, capeWave: i * 2 });
  drawHeroFrame(surf, 0, 5, { legMode: 'land', squashY: 2, capeWave: 1 });
  drawHeroFrame(surf, 1, 5, { legMode: 'idle', squashY: 1, capeWave: 2 });
  drawHeroFrame(surf, 0, 6, { armMode: 'swordWind', swordFrame: 0 });
  drawHeroFrame(surf, 1, 6, { armMode: 'swordSwing', swordFrame: 1, leanX: 2 });
  drawHeroFrame(surf, 2, 6, { armMode: 'swordSwing', swordFrame: 2, leanX: 2 });
  drawHeroFrame(surf, 3, 6, { armMode: 'swordSwing', swordFrame: 3, leanX: 1 });
  drawHeroFrame(surf, 0, 7, { armMode: 'swordWind', swordFrame: 0, bobY: 1 });
  drawHeroFrame(surf, 1, 7, { armMode: 'swordUp', swordFrame: 2, leanX: 2 });
  drawHeroFrame(surf, 2, 7, { armMode: 'swordUp', swordFrame: 1, leanX: 2 });
  drawHeroFrame(surf, 3, 7, { armMode: 'swordUp', swordFrame: 3, leanX: 1 });
  drawHeroFrame(surf, 0, 8, { armMode: 'swordWind', swordFrame: 0, leanX: -1 });
  drawHeroFrame(surf, 1, 8, { armMode: 'swordSpin', swordFrame: 3, leanX: 1, bobY: -1 });
  drawHeroFrame(surf, 2, 8, { armMode: 'swordSpin', swordFrame: 1, leanX: 3 });
  drawHeroFrame(surf, 3, 8, { armMode: 'swordSpin', swordFrame: 2, leanX: 3 });
  drawHeroFrame(surf, 4, 8, { armMode: 'swordSpin', swordFrame: 3, leanX: 1 });
  drawHeroFrame(surf, 0, 9, { armMode: 'shoot', muzzle: true, leanX: -1 });
  drawHeroFrame(surf, 1, 9, { armMode: 'shoot', muzzle: false });
  drawHeroFrame(surf, 2, 9, { armMode: 'buster' });
  drawHeroFrame(surf, 0, 10, { armMode: 'shootUp', muzzle: true });
  drawHeroFrame(surf, 1, 10, { armMode: 'shootUp', muzzle: false });
  drawHeroFrame(surf, 2, 10, { armMode: 'shootUp', muzzle: false, bobY: 1 });
  drawHeroFrame(surf, 0, 11, { legMode: 'fall', armMode: 'shootDown', muzzle: true });
  drawHeroFrame(surf, 1, 11, { legMode: 'fall', armMode: 'shootDown', muzzle: false });
  drawHeroFrame(surf, 2, 11, { legMode: 'fall', armMode: 'shootDown', muzzle: false, bobY: -1 });
  drawHeroFrame(surf, 0, 12, { legMode: 'hurt', leanX: -2, hurtFlash: true });
  drawHeroFrame(surf, 1, 12, { legMode: 'hurt', leanX: -1, hurtFlash: false });
  drawHeroFrame(surf, 2, 12, { legMode: 'hurt', leanX: -1, hurtFlash: true });
  for (let i = 0; i < 5; i++) drawHeroFrame(surf, i, 13, { deadFrame: i });
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 14, { climbFrame: i });
  for (let i = 0; i < 3; i++) drawHeroFrame(surf, i, 15, { legMode: 'dash', leanX: 3, bobY: 2, capeWave: i * 2 });
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 16, { armMode: `potion${i}`, bobY: i === 2 ? -1 : 0 });
  // Row 17: hangClimb (4 frames hand-over-hand)
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 17, { hangFrame: i });
  // Row 18: block (3 frames iron shield guard)
  for (let i = 0; i < 3; i++) drawHeroFrame(surf, i, 18, { blockFrame: i });
  // Row 19: back (4 frames back-facing view showing skull back & red cape)
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 19, { backFrame: i });
  // Row 20: plungeSlam (4 frames: air vertical dive + 3 ground shockwave slam frames)
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 20, { plungeFrame: i });

  surf.save('hero.png');
}

// ---- 2. 10 SWORDS SHEET ----
const SWORD_DEFS = [
  { name: 'Iron Sword', c1: '#64748b', c2: '#cbd5e1', c3: '#ffffff', hilt: '#b45309' },
  { name: 'Crystal Sword', c1: '#0284c7', c2: '#38bdf8', c3: '#e0f2fe', hilt: '#1e3a8a' },
  { name: 'Flame Sword', c1: '#dc2626', c2: '#f97316', c3: '#fef08a', hilt: '#7c2d12' },
  { name: 'Thunder Sword', c1: '#ca8a04', c2: '#facc15', c3: '#fef9c3', hilt: '#1e293b' },
  { name: 'Dark Sword', c1: '#581c87', c2: '#9333ea', c3: '#e9d5ff', hilt: '#0f172a' },
  { name: 'Holy Sword', c1: '#d97706', c2: '#fde047', c3: '#ffffff', hilt: '#f8fafc' },
  { name: 'Dragon Slayer', c1: '#991b1b', c2: '#ef4444', c3: '#fda4af', hilt: '#fbbf24' },
  { name: 'Great Sword', c1: '#334155', c2: '#94a3b8', c3: '#f1f5f9', hilt: '#78350f' },
  { name: 'Shadow Katana', c1: '#1e1b4b', c2: '#6366f1', c3: '#c7d2fe', hilt: '#ef4444' },
  { name: 'Excalibur', c1: '#eab308', c2: '#fef08a', c3: '#ffffff', hilt: '#2563eb' },
];

function buildSwordsSheet() {
  const surf = new PixelSurface(160, 336);
  SWORD_DEFS.forEach((sw, idx) => {
    const ix = idx * 16;
    const thick = idx === 6 || idx === 7 ? 2 : 1;
    for (let i = 4; i <= 13; i++) {
      const bx = ix + i;
      const by = 15 - i;
      surf.set(bx - 1, by, '#0f111a');
      surf.set(bx, by - 1, '#0f111a');
      surf.set(bx + 1, by, '#0f111a');
      surf.set(bx, by + 1, '#0f111a');
    }
    for (let i = 4; i <= 13; i++) {
      const bx = ix + i;
      const by = 15 - i;
      surf.set(bx, by, i > 10 ? sw.c3 : sw.c2);
      if (thick === 2) surf.set(bx - 1, by, sw.c1);
      else surf.set(bx, by + 1, sw.c1);
    }
    surf.rect(ix + 2, 10, 4, 4, '#0f111a');
    surf.line(ix + 2, 9, ix + 6, 13, sw.hilt);
    surf.set(ix + 2, 13, sw.hilt);
    surf.set(ix + 3, 12, sw.hilt);
    if (idx === 9 || idx === 5) surf.set(ix + 13, 2, '#ffffff');

    const sy = 16 + idx * 32;
    for (let f = 0; f < 3; f++) {
      const fx = f * 32;
      const rOuter = f === 0 ? 11 : f === 1 ? 14 : 13;
      const rInner = f === 0 ? 7 : f === 1 ? 8 : 10;
      const startAng = f === 0 ? -1.4 : f === 1 ? -1.1 : -0.4;
      const endAng = f === 0 ? 0.3 : f === 1 ? 1.1 : 1.4;
      for (let y = -15; y <= 15; y++) {
        for (let x = -4; x <= 15; x++) {
          const dist = Math.hypot(x, y);
          const ang = Math.atan2(y, x);
          if (dist <= rOuter && dist >= rInner && ang >= startAng && ang <= endAng) {
            const col = dist > rOuter - 2 ? sw.c3 : dist > rInner + 2 ? sw.c2 : sw.c1;
            surf.set(fx + 14 + x, sy + 16 + y, col);
          }
        }
      }
    }
  });
  surf.save('swords.png');
}

// ---- 3. 40 DISTINCT KEROCO ENEMIES (128 x 1280 -> 4 frames x 40 rows of 32x32) ----
const KEROCO_TEMPLATES = [
  // 0..9: Slimes & Critters
  { shape: 'slime', c1: '#22c55e', c2: '#86efac', eye: '#0f172a', accent: '#166534' },
  { shape: 'slime', c1: '#06b6d4', c2: '#a5f3fc', eye: '#1e3a8a', accent: '#0e7490' },
  { shape: 'slime', c1: '#f97316', c2: '#fed7aa', eye: '#450a0a', accent: '#dc2626' },
  { shape: 'slime', c1: '#a855f7', c2: '#e9d5ff', eye: '#facc15', accent: '#581c87' },
  { shape: 'slime', c1: '#eab308', c2: '#fef08a', eye: '#713f12', accent: '#ca8a04' },
  { shape: 'crawler', c1: '#d97706', c2: '#fde68a', eye: '#dc2626', accent: '#78350f' },
  { shape: 'crawler', c1: '#65a30d', c2: '#bef264', eye: '#ef4444', accent: '#365314' },
  { shape: 'crawler', c1: '#0284c7', c2: '#7dd3fc', eye: '#fef08a', accent: '#0c4a6e' },
  { shape: 'crawler', c1: '#9333ea', c2: '#d8b4fe', eye: '#22d3ee', accent: '#3b0764' },
  { shape: 'crawler', c1: '#dc2626', c2: '#fca5a5', eye: '#fef08a', accent: '#7f1d1d' },
  // 10..17: Flyers & Bats & Ghosts
  { shape: 'bat', c1: '#7e22ce', c2: '#c084fc', eye: '#facc15', accent: '#4c1d95' },
  { shape: 'bat', c1: '#b91c1c', c2: '#f87171', eye: '#fef08a', accent: '#7f1d1d' },
  { shape: 'bat', c1: '#0284c7', c2: '#7dd3fc', eye: '#ffffff', accent: '#1e3a8a' },
  { shape: 'bat', c1: '#4d7c0f', c2: '#a3e635', eye: '#ef4444', accent: '#1a2e05' },
  { shape: 'ghost', c1: '#94a3b8', c2: '#f1f5f9', eye: '#38bdf8', accent: '#475569' },
  { shape: 'ghost', c1: '#6366f1', c2: '#c7d2fe', eye: '#facc15', accent: '#312e81' },
  { shape: 'ghost', c1: '#ec4899', c2: '#fbcfe8', eye: '#ffffff', accent: '#831843' },
  { shape: 'ghost', c1: '#14b8a6', c2: '#99f6e4', eye: '#fef08a', accent: '#134e4a' },
  // 18..25: Troopers & Shooters & Mages
  { shape: 'trooper', c1: '#dc2626', c2: '#f87171', eye: '#fef08a', accent: '#475569' },
  { shape: 'trooper', c1: '#2563eb', c2: '#93c5fd', eye: '#38bdf8', accent: '#1e293b' },
  { shape: 'trooper', c1: '#16a34a', c2: '#86efac', eye: '#fde047', accent: '#14532d' },
  { shape: 'trooper', c1: '#ca8a04', c2: '#fde047', eye: '#ef4444', accent: '#422006' },
  { shape: 'mage', c1: '#6b21a8', c2: '#c084fc', eye: '#38bdf8', accent: '#facc15' },
  { shape: 'mage', c1: '#b91c1c', c2: '#fb923c', eye: '#fef08a', accent: '#7c2d12' },
  { shape: 'mage', c1: '#0e7490', c2: '#67e8f9', eye: '#ffffff', accent: '#164e63' },
  { shape: 'mage', c1: '#1e293b', c2: '#64748b', eye: '#f43f5e', accent: '#a855f7' },
  // 26..33: Armored Knights & Skeletons & Mummies
  { shape: 'knight', c1: '#475569', c2: '#94a3b8', eye: '#38bdf8', accent: '#eab308' },
  { shape: 'knight', c1: '#991b1b', c2: '#ef4444', eye: '#fef08a', accent: '#fbbf24' },
  { shape: 'knight', c1: '#1e3a8a', c2: '#60a5fa', eye: '#ffffff', accent: '#38bdf8' },
  { shape: 'knight', c1: '#3b0764', c2: '#a855f7', eye: '#f43f5e', accent: '#e9d5ff' },
  { shape: 'skeleton', c1: '#e2e8f0', c2: '#ffffff', eye: '#ef4444', accent: '#64748b' },
  { shape: 'skeleton', c1: '#d97706', c2: '#fef3c7', eye: '#22d3ee', accent: '#78350f' },
  { shape: 'skeleton', c1: '#7c3aed', c2: '#ddd6fe', eye: '#facc15', accent: '#4c1d95' },
  { shape: 'skeleton', c1: '#0f766e', c2: '#99f6e4', eye: '#f97316', accent: '#134e4a' },
  // 34..39: Turrets & Golems
  { shape: 'turret', c1: '#334155', c2: '#64748b', eye: '#38bdf8', accent: '#facc15' },
  { shape: 'turret', c1: '#7f1d1d', c2: '#b91c1c', eye: '#f97316', accent: '#fef08a' },
  { shape: 'turret', c1: '#1e3a8a', c2: '#2563eb', eye: '#22d3ee', accent: '#ffffff' },
  { shape: 'golem', c1: '#78350f', c2: '#b45309', eye: '#facc15', accent: '#451a03' },
  { shape: 'golem', c1: '#0369a1', c2: '#38bdf8', eye: '#ffffff', accent: '#0c4a6e' },
  { shape: 'golem', c1: '#374151', c2: '#9ca3af', eye: '#ef4444', accent: '#f97316' },
];

function buildKerocoEnemiesSheet() {
  const surf = new PixelSurface(128, KEROCO_TEMPLATES.length * 32);
  KEROCO_TEMPLATES.forEach((t, idx) => {
    for (let f = 0; f < 4; f++) {
      const ox = f * 32;
      const oy = idx * 32;
      const flash = f === 3;
      const main = flash ? '#ffffff' : t.c1;
      const hi = flash ? '#fef08a' : t.c2;
      const acc = flash ? '#ffffff' : t.accent;

      if (t.shape === 'slime') {
        const squish = f === 1 ? 2 : f === 2 ? -2 : 0;
        const h = 11 - squish;
        const y = oy + 28 - h;
        surf.rect(ox + 8, y - 1, 16, h + 2, '#0f111a');
        surf.rect(ox + 9, y, 14, h, main);
        surf.rect(ox + 10, y + 1, 10, 3, hi);
        surf.rect(ox + 11, y + 4, 2, 3, t.eye);
        surf.rect(ox + 17, y + 4, 2, 3, t.eye);
        if (idx % 2 === 1) surf.rect(ox + 14, y - 3, 4, 2, acc);
      } else if (t.shape === 'crawler') {
        const legOff = f % 2 === 0 ? 1 : -1;
        surf.rect(ox + 6, oy + 16, 20, 9, '#0f111a');
        surf.rect(ox + 7, oy + 17, 18, 7, main);
        surf.rect(ox + 9, oy + 17, 14, 3, hi);
        surf.rect(ox + 8, oy + 20, 3, 2, t.eye);
        surf.rect(ox + 4, oy + 14, 3, 3, acc); // pincer/horn
        for (let l = 0; l < 3; l++) {
          surf.rect(ox + 8 + l * 6, oy + 25 + (l % 2 === 0 ? legOff : -legOff), 2, 4, acc);
        }
      } else if (t.shape === 'bat') {
        const wingY = f % 2 === 0 ? 10 : 19;
        surf.circle(ox + 16, oy + 16, 5, '#0f111a');
        surf.circle(ox + 16, oy + 16, 4, main);
        surf.set(ox + 14, oy + 15, t.eye);
        surf.set(ox + 18, oy + 15, t.eye);
        surf.line(ox + 12, oy + 16, ox + 4, oy + wingY, '#0f111a');
        surf.line(ox + 12, oy + 15, ox + 5, oy + wingY, hi);
        surf.line(ox + 20, oy + 16, ox + 28, oy + wingY, '#0f111a');
        surf.line(ox + 20, oy + 15, ox + 27, oy + wingY, hi);
      } else if (t.shape === 'ghost') {
        const bob = f === 1 ? -2 : f === 2 ? 1 : 0;
        surf.circle(ox + 16, oy + 14 + bob, 7, '#0f111a');
        surf.circle(ox + 16, oy + 14 + bob, 6, main);
        surf.rect(ox + 10, oy + 14 + bob, 12, 10, main);
        surf.rect(ox + 12, oy + 12 + bob, 2, 3, t.eye);
        surf.rect(ox + 17, oy + 12 + bob, 2, 3, t.eye);
        surf.rect(ox + 11, oy + 24 + bob, 3, 2, hi);
        surf.rect(ox + 17, oy + 24 + bob, 3, 2, hi);
      } else if (t.shape === 'trooper') {
        const step = f === 1 ? 2 : 0;
        surf.rect(ox + 10, oy + 7, 12, 10, '#0f111a');
        surf.rect(ox + 11, oy + 8, 10, 8, main);
        surf.rect(ox + 12, oy + 10, 6, 3, t.eye);
        surf.rect(ox + 11, oy + 17, 10, 7, acc);
        surf.rect(ox + 10 - step, oy + 24, 4, 4, '#475569');
        surf.rect(ox + 18 + step, oy + 24, 4, 4, '#475569');
        surf.rect(ox + 5, oy + 18, 7, 3, hi);
        if (f === 2) surf.circle(ox + 4, oy + 19, 2, '#f97316');
      } else if (t.shape === 'mage') {
        const bob = f === 1 ? -1 : 0;
        surf.rect(ox + 10, oy + 11 + bob, 12, 16, '#0f111a');
        surf.rect(ox + 11, oy + 12 + bob, 10, 14, main);
        surf.rect(ox + 9, oy + 8 + bob, 14, 4, acc); // wizard brim
        surf.rect(ox + 13, oy + 4 + bob, 6, 4, main);
        surf.rect(ox + 12, oy + 14 + bob, 2, 2, t.eye);
        surf.rect(ox + 16, oy + 14 + bob, 2, 2, t.eye);
        // staff
        surf.rect(ox + 6, oy + 10 + bob, 2, 17, '#92400e');
        surf.circle(ox + 7, oy + 9 + bob, 2, f === 2 ? '#fef08a' : hi);
      } else if (t.shape === 'knight') {
        surf.rect(ox + 10, oy + 6, 13, 18, '#0f111a');
        surf.rect(ox + 11, oy + 7, 11, 16, main);
        surf.rect(ox + 12, oy + 10, 4, 2, t.eye);
        surf.rect(ox + 11, oy + 24, 4, 4, '#1e293b');
        surf.rect(ox + 18, oy + 24, 4, 4, '#1e293b');
        const lift = f === 2 ? -4 : 0;
        surf.rect(ox + 5, oy + 10 + lift, 6, 14, '#0f111a');
        surf.rect(ox + 6, oy + 11 + lift, 4, 12, acc);
        surf.rect(ox + 7, oy + 13 + lift, 2, 8, hi);
      } else if (t.shape === 'skeleton') {
        const step = f === 1 ? 2 : 0;
        surf.rect(ox + 11, oy + 6, 10, 9, '#0f111a');
        surf.rect(ox + 12, oy + 7, 8, 7, main);
        surf.rect(ox + 12, oy + 10, 2, 2, t.eye);
        surf.rect(ox + 16, oy + 10, 2, 2, t.eye);
        surf.rect(ox + 13, oy + 16, 6, 8, acc);
        surf.rect(ox + 12, oy + 17, 8, 2, hi);
        surf.rect(ox + 11 - step, oy + 24, 3, 4, main);
        surf.rect(ox + 17 + step, oy + 24, 3, 4, main);
        surf.line(ox + 7, oy + 17, ox + 10, oy + 12, hi); // bone sword
      } else if (t.shape === 'turret') {
        surf.rect(ox + 8, oy + 12, 16, 16, '#0f111a');
        surf.rect(ox + 9, oy + 13, 14, 14, main);
        surf.rect(ox + 12, oy + 16, 8, 6, f === 2 ? '#ef4444' : t.eye);
        surf.rect(ox + 4, oy + 17, 6, 4, acc);
      } else {
        // golem
        const stomp = f === 1 ? -1 : 0;
        surf.rect(ox + 6, oy + 6 + stomp, 20, 22, '#0f111a');
        surf.rect(ox + 7, oy + 7 + stomp, 18, 18, main);
        surf.rect(ox + 9, oy + 8 + stomp, 14, 5, hi);
        surf.rect(ox + 10, oy + 13 + stomp, 4, 3, t.eye);
        surf.rect(ox + 17, oy + 13 + stomp, 4, 3, t.eye);
        surf.rect(ox + 8, oy + 24, 5, 5, acc);
        surf.rect(ox + 19, oy + 24, 5, 5, acc);
      }
    }
  });
  surf.save('enemies_keroco.png');
}

// ---- 4. 10 BOSSES + 1 FINAL BOSS (2592 x 792 -> 12 anims x 3 frames = 36 cols x 11 rows of 72x72) ----
// Size: 2.5x-3x Hero (~22px hero vs 54-68px tall bosses) with 12 complete animations:
// 0:idle, 1:move, 2:attack1, 3:attack2, 4:heavyAttack, 5:throwRock,
// 6:summonRock, 7:stun, 8:weaknessExposed, 9:damage, 10:knockback, 11:death
const BOSS_SPRITE_DEFS = [
  { id: 'slime_king', name: 'Slime King', shape: 'slime_king', c1: '#15803d', c2: '#22c55e', hi: '#86efac', acc: '#facc15', eye: '#ef4444', weak: '#22d3ee' },
  { id: 'skeleton_general', name: 'Skeleton General', shape: 'skeleton_general', c1: '#475569', c2: '#cbd5e1', hi: '#ffffff', acc: '#dc2626', eye: '#ef4444', weak: '#facc15' },
  { id: 'goblin_warlord', name: 'Goblin Warlord', shape: 'goblin_warlord', c1: '#3f6212', c2: '#65a30d', hi: '#bef264', acc: '#991b1b', eye: '#facc15', weak: '#f97316' },
  { id: 'inferno_dragon', name: 'Inferno Dragon', shape: 'inferno_dragon', c1: '#7f1d1d', c2: '#dc2626', hi: '#f97316', acc: '#facc15', eye: '#fef08a', weak: '#fde047' },
  { id: 'frost_queen', name: 'Frost Queen', shape: 'frost_queen', c1: '#0e7490', c2: '#38bdf8', hi: '#e0f2fe', acc: '#bae6fd', eye: '#ffffff', weak: '#67e8f9' },
  { id: 'vampire_lord', name: 'Vampire Lord', shape: 'vampire_lord', c1: '#1e1b4b', c2: '#7f1d1d', hi: '#dc2626', acc: '#f8fafc', eye: '#ef4444', weak: '#f43f5e' },
  { id: 'ancient_golem', name: 'Ancient Golem', shape: 'ancient_golem', c1: '#44403c', c2: '#78716c', hi: '#a8a29e', acc: '#22d3ee', eye: '#facc15', weak: '#38bdf8' },
  { id: 'shadow_demon', name: 'Shadow Demon', shape: 'shadow_demon', c1: '#1e1b2e', c2: '#581c87', hi: '#a855f7', acc: '#f43f5e', eye: '#fb7185', weak: '#e879f9' },
  { id: 'titan_mech', name: 'Titan Mech', shape: 'titan_mech', c1: '#1e293b', c2: '#475569', hi: '#94a3b8', acc: '#f97316', eye: '#38bdf8', weak: '#22d3ee' },
  { id: 'abyss_dragon_king', name: 'Abyss Dragon King', shape: 'abyss_dragon_king', c1: '#2e1065', c2: '#6b21a8', hi: '#c084fc', acc: '#facc15', eye: '#f43f5e', weak: '#c084fc' },
  { id: 'chaos_overload', name: 'Chaos Overlord', shape: 'chaos_overload', c1: '#0f172a', c2: '#7c3aed', hi: '#f43f5e', acc: '#facc15', eye: '#ffffff', weak: '#fde047' },
];

const BOSS_ANIM_LIST = [
  'idle',
  'move',
  'attack1',
  'attack2',
  'heavyAttack',
  'throwRock',
  'summonRock',
  'stun',
  'weaknessExposed',
  'damage',
  'knockback',
  'death',
];

function drawBossCell72(surf, ox, oy, b, anim, f) {
  const O = '#090d16';
  const isFlash = anim === 'damage' && f % 2 === 0;
  const isWeak = anim === 'weaknessExposed';
  const isStun = anim === 'stun' || isWeak;
  const isAtk1 = anim === 'attack1';
  const isAtk2 = anim === 'attack2';
  const isHeavy = anim === 'heavyAttack';
  const isThrow = anim === 'throwRock';
  const isSummon = anim === 'summonRock';
  const isKnock = anim === 'knockback';
  const isDeath = anim === 'death';

  if (isDeath && f === 2) {
    // Final explosion burst pixels
    const pts = [
      [18, 22], [52, 24], [36, 14], [24, 52], [48, 50],
      [12, 38], [60, 36], [36, 36], [28, 28], [44, 42],
    ];
    for (const [px, py] of pts) {
      surf.circle(ox + px, oy + py, 4, b.acc);
      surf.circle(ox + px, oy + py, 2, '#ffffff');
    }
    return;
  }

  const c1 = isFlash ? '#ffffff' : b.c1;
  const c2 = isFlash ? '#fef08a' : b.c2;
  const hi = isFlash ? '#ffffff' : b.hi;
  const acc = isFlash ? '#ffffff' : b.acc;
  const weakCol = f % 2 === 0 ? b.weak : '#ffffff';

  const bounce =
    anim === 'idle' ? (f === 1 ? -2 : f === 2 ? 1 : 0) :
    anim === 'move' ? (f === 1 ? -4 : f === 2 ? 2 : 0) :
    isHeavy ? (f === 0 ? -6 : f === 1 ? 3 : 1) :
    isStun ? 6 + (f % 2) :
    isDeath ? f * 7 :
    isKnock ? 2 : 0;

  const lean =
    isKnock ? 5 :
    isAtk1 && f > 0 ? -4 :
    isHeavy && f === 1 ? -3 :
    anim === 'move' ? (f === 1 ? -2 : 0) : 0;

  const cx = ox + 36 + lean;
  const groundY = oy + 68;

  // Shared Weakness Core Pulse helper
  const drawExposedCore = (wx, wy, r = 6) => {
    surf.circle(wx, wy, r + 2, O);
    surf.circle(wx, wy, r, weakCol);
    surf.circle(wx, wy, Math.max(2, Math.floor(r / 2)), '#ffffff');
  };

  if (b.shape === 'slime_king') {
    const squish = isHeavy && f === 1 ? 6 : anim === 'move' && f === 1 ? -5 : isStun ? 7 : 0;
    const w = isWeak ? 44 : 46;
    const h = Math.max(22, 38 - squish - (isDeath ? f * 8 : 0));
    const topY = groundY - h;

    if (isWeak) {
      // Split slime halves revealing exposed Crystal Core in center!
      surf.rect(cx - 24, topY + 6, 16, h - 6, O);
      surf.rect(cx - 23, topY + 7, 14, h - 8, c2);
      surf.rect(cx + 8, topY + 6, 16, h - 6, O);
      surf.rect(cx + 9, topY + 7, 14, h - 8, c2);
      drawExposedCore(cx, groundY - 16, 7);
    } else {
      surf.rect(cx - Math.floor(w / 2), topY, w, h, O);
      surf.rect(cx - Math.floor(w / 2) + 3, topY - 5, w - 6, 6, O);
      surf.rect(cx - Math.floor(w / 2) + 2, topY + 2, w - 4, h - 4, c1);
      surf.rect(cx - Math.floor(w / 2) + 4, topY - 3, w - 8, h - 2, c2);
      surf.rect(cx - 14, topY, 22, 8, hi);
      // Inner Crystal Core visible inside translucent slime
      surf.circle(cx, topY + Math.floor(h * 0.56), 7, isStun ? weakCol : acc);
      surf.circle(cx, topY + Math.floor(h * 0.56), 3, '#ffffff');
    }

    // Crown
    const crownY = isWeak ? groundY - 30 : topY - 14;
    surf.rect(cx - 12, crownY, 24, 11, O);
    surf.rect(cx - 11, crownY + 5, 22, 5, acc);
    surf.rect(cx - 11, crownY + 1, 4, 4, acc);
    surf.rect(cx - 2, crownY, 5, 5, acc);
    surf.rect(cx + 7, crownY + 1, 4, 4, acc);
    surf.set(cx, crownY + 6, '#ef4444');

    if (!isWeak) {
      // Fierce eyes
      surf.rect(cx - 12, topY + 9, 5, 6, O);
      surf.rect(cx + 5, topY + 9, 5, 6, O);
      surf.rect(cx - 11, topY + 10, 3, 4, isStun ? '#94a3b8' : b.eye);
      surf.rect(cx + 6, topY + 10, 3, 4, isStun ? '#94a3b8' : b.eye);
      surf.rect(cx - 8, topY + 19, 14, 4, O);
    }
    if (isThrow || isSummon) {
      surf.circle(cx - 20, topY + 2, 6, '#22d3ee');
    }
    return;
  }

  if (b.shape === 'skeleton_general') {
    const legSpread = anim === 'move' && f === 1 ? 4 : 0;
    // Red General Cape
    surf.rect(cx + 4, oy + 20 + bounce, 18, 36, O);
    surf.rect(cx + 5, oy + 21 + bounce, 16, 34, acc);
    // Legs (kneeling when stun/weaknessExposed!)
    if (isStun) {
      surf.rect(cx - 14, groundY - 10, 10, 10, O);
      surf.rect(cx + 4, groundY - 10, 10, 10, O);
      surf.rect(cx - 13, groundY - 9, 8, 8, c1);
      surf.rect(cx + 5, groundY - 9, 8, 8, c1);
    } else {
      surf.rect(cx - 12 - legSpread, groundY - 16, 8, 16, O);
      surf.rect(cx + 4 + legSpread, groundY - 16, 8, 16, O);
      surf.rect(cx - 11 - legSpread, groundY - 15, 6, 14, c1);
      surf.rect(cx + 5 + legSpread, groundY - 15, 6, 14, c1);
    }
    // Iron Chestplate / Shattered Armor Chest
    const torsoY = oy + 22 + bounce;
    surf.rect(cx - 14, torsoY, 28, 28, O);
    surf.rect(cx - 13, torsoY + 1, 26, 26, c1);
    if (isWeak) {
      // Exposed cracked chest ribcage + glowing core
      surf.rect(cx - 8, torsoY + 5, 16, 16, O);
      drawExposedCore(cx, torsoY + 13, 6);
    } else {
      surf.rect(cx - 10, torsoY + 5, 18, 3, c2);
      surf.rect(cx - 10, torsoY + 11, 18, 3, c2);
      surf.rect(cx - 10, torsoY + 17, 18, 3, c2);
    }
    // Horned Skull Helm
    const headY = oy + 6 + bounce;
    surf.rect(cx - 10, headY, 20, 17, O);
    surf.rect(cx - 9, headY + 1, 18, 15, hi);
    surf.rect(cx - 12, headY - 1, 24, 6, c1);
    surf.rect(cx - 15, headY - 5, 5, 8, c2);
    surf.rect(cx + 10, headY - 5, 5, 8, c2);
    surf.rect(cx - 3, headY - 6, 6, 6, acc);
    surf.rect(cx - 7, headY + 7, 4, 4, O);
    surf.rect(cx + 2, headY + 7, 4, 4, O);
    surf.set(cx - 5, headY + 9, b.eye);
    surf.set(cx + 4, headY + 9, b.eye);
    // Giant Greatsword
    if (isAtk1 || isHeavy) {
      surf.rect(cx - 33, torsoY + 8, 22, 6, O);
      surf.rect(cx - 32, torsoY + 9, 20, 4, hi);
    } else if (isSummon || isThrow) {
      surf.rect(cx - 22, headY - 4, 6, 26, O);
      surf.rect(cx - 21, headY - 3, 4, 24, hi);
    } else {
      surf.rect(cx - 22, oy + 10 + bounce, 6, 32, O);
      surf.rect(cx - 21, oy + 11 + bounce, 4, 28, hi);
    }
    return;
  }

  if (b.shape === 'goblin_warlord') {
    const legSpread = anim === 'move' && f === 1 ? 4 : 0;
    surf.rect(cx - 15 - legSpread, groundY - 14, 11, 14, O);
    surf.rect(cx + 4 + legSpread, groundY - 14, 11, 14, O);
    surf.rect(cx - 14 - legSpread, groundY - 13, 9, 12, c1);
    surf.rect(cx + 5 + legSpread, groundY - 13, 9, 12, c1);
    // Muscular wide torso
    const torsoY = oy + 22 + bounce;
    surf.rect(cx - 19, torsoY, 38, 32, O);
    surf.rect(cx - 18, torsoY + 1, 36, 30, c2);
    surf.rect(cx - 18, torsoY + 20, 36, 8, acc);
    surf.rect(cx - 21, torsoY - 1, 11, 10, '#64748b');
    surf.rect(cx + 10, torsoY - 1, 11, 10, '#64748b');
    // Head
    const headY = oy + 6 + bounce;
    surf.rect(cx - 12, headY, 24, 17, O);
    surf.rect(cx - 11, headY + 1, 22, 15, hi);
    surf.rect(cx - 19, headY + 4, 8, 5, c2);
    surf.rect(cx + 11, headY + 4, 8, 5, c2);
    surf.rect(cx - 4, headY - 5, 8, 6, acc);
    surf.rect(cx - 7, headY + 6, 4, 3, b.eye);
    surf.rect(cx + 2, headY + 6, 4, 3, b.eye);
    surf.rect(cx - 8, headY + 12, 3, 4, '#ffffff');
    surf.rect(cx + 4, headY + 12, 3, 4, '#ffffff');

    if (isWeak) {
      // Giant Axe disarmed! Glowing disarm target at weapon side
      drawExposedCore(cx - 22, torsoY + 14, 6);
    } else {
      const axeY = isAtk1 || isHeavy ? torsoY + 10 : isSummon ? oy + 2 : torsoY - 8;
      surf.rect(cx - 28, axeY, 5, 28, '#78350f');
      surf.rect(cx - 34, axeY - 4, 14, 14, O);
      surf.rect(cx - 33, axeY - 3, 12, 12, '#cbd5e1');
      if (isAtk2 || isThrow) {
        surf.circle(cx - 28, axeY + 2, 5, weakCol);
      }
    }
    return;
  }

  if (b.shape === 'inferno_dragon') {
    const wingY = f % 2 === 0 ? oy + 6 : oy + 16;
    surf.rect(cx + 4, wingY, 26, 30, O);
    surf.rect(cx + 5, wingY + 1, 24, 28, c2);
    surf.rect(cx + 9, wingY + 6, 16, 16, hi);
    // Heavy Dragon Body
    const bodyY = oy + 22 + bounce;
    surf.rect(cx - 14, bodyY, 32, 36, O);
    surf.rect(cx - 13, bodyY + 1, 30, 34, c1);
    if (isWeak) {
      drawExposedCore(cx - 2, bodyY + 16, 7);
    } else {
      surf.rect(cx - 11, bodyY + 6, 15, 22, acc);
      surf.circle(cx - 4, bodyY + 16, 5, '#f97316');
    }
    // Dragon Head
    const headY = oy + 8 + bounce;
    surf.rect(cx - 28, headY, 26, 18, O);
    surf.rect(cx - 27, headY + 1, 24, 16, c2);
    surf.rect(cx - 10, headY - 7, 5, 9, acc);
    surf.rect(cx - 3, headY - 5, 4, 7, acc);
    surf.rect(cx - 22, headY + 5, 5, 4, b.eye);
    const jawDrop = isAtk1 || isAtk2 ? 6 : 0;
    surf.rect(cx - 30, headY + 14 + jawDrop, 16, 5, c1);
    if (isAtk2 || isSummon) {
      surf.circle(cx - 30, headY + 14, 6, hi);
      surf.circle(cx - 31, headY + 14, 3, '#fef08a');
    }
    // Clawed Legs
    surf.rect(cx - 12, groundY - 11, 10, 11, O);
    surf.rect(cx + 4, groundY - 11, 10, 11, O);
    surf.rect(cx - 11, groundY - 10, 8, 9, c1);
    surf.rect(cx + 5, groundY - 10, 8, 9, c1);
    return;
  }

  if (b.shape === 'frost_queen') {
    const hover = isStun ? 6 : bounce;
    // Ice Gown
    const gownY = oy + 30 + hover;
    surf.rect(cx - 16, gownY, 32, 34, O);
    surf.rect(cx - 15, gownY + 1, 30, 32, c1);
    surf.rect(cx - 11, gownY + 3, 22, 28, c2);
    surf.rect(cx - 6, gownY + 5, 12, 24, hi);
    // Torso
    surf.rect(cx - 12, oy + 19 + hover, 24, 13, O);
    surf.rect(cx - 11, oy + 20 + hover, 22, 11, c2);
    // Head + Ice Crown (Weakness!)
    const headY = oy + 7 + hover;
    surf.rect(cx - 9, headY, 18, 13, O);
    surf.rect(cx - 8, headY + 1, 16, 11, hi);
    if (isWeak) {
      drawExposedCore(cx, headY - 2, 6);
    } else {
      surf.rect(cx - 11, headY - 8, 5, 9, c2);
      surf.rect(cx - 3, headY - 10, 6, 11, hi);
      surf.rect(cx + 6, headY - 8, 5, 9, c2);
    }
    surf.rect(cx - 5, headY + 5, 3, 3, '#0ea5e9');
    surf.rect(cx + 2, headY + 5, 3, 3, '#0ea5e9');
    // Frost Scepter
    const scepterX = isAtk1 || isThrow ? cx - 24 : cx - 20;
    surf.rect(scepterX, oy + 14 + hover, 4, 42, acc);
    surf.circle(scepterX + 2, oy + 12 + hover, 6, isSummon || isAtk2 ? '#ffffff' : hi);
    return;
  }

  if (b.shape === 'vampire_lord') {
    const capeSpan = isAtk1 || isSummon ? 24 : 16;
    const bodyY = oy + 18 + bounce;
    surf.rect(cx - capeSpan, bodyY, capeSpan * 2, 46, O);
    surf.rect(cx - capeSpan + 2, bodyY + 1, capeSpan * 2 - 4, 44, c1);
    surf.rect(cx - 13, bodyY + 2, 26, 40, c2);
    // Tuxedo / Dark Heart Chest
    surf.rect(cx - 10, bodyY + 4, 20, 28, O);
    surf.rect(cx - 9, bodyY + 5, 18, 26, c2);
    if (isWeak) {
      drawExposedCore(cx, bodyY + 16, 7);
    } else {
      surf.circle(cx, bodyY + 16, 4, '#ef4444');
    }
    // Head
    const headY = oy + 5 + bounce;
    surf.rect(cx - 9, headY, 18, 15, O);
    surf.rect(cx - 8, headY + 1, 16, 13, acc);
    surf.rect(cx - 8, headY, 16, 4, O);
    surf.rect(cx - 5, headY + 6, 3, 3, b.eye);
    surf.rect(cx + 2, headY + 6, 3, 3, b.eye);
    if (isAtk1 || isHeavy) {
      surf.line(cx - 12, bodyY + 14, cx - 32, bodyY + 10, hi);
      surf.circle(cx - 30, bodyY + 10, 4, hi);
    }
    return;
  }

  if (b.shape === 'ancient_golem') {
    const bodyY = oy + 12 + bounce;
    surf.rect(cx - 18, bodyY, 36, 44, O);
    surf.rect(cx - 17, bodyY + 1, 34, 42, c1);
    surf.rect(cx - 14, bodyY + 4, 28, 34, c2);
    // Visor
    surf.rect(cx - 10, bodyY + 8, 20, 6, O);
    surf.rect(cx - 7, bodyY + 9, 14, 4, b.eye);
    // Ancient Core in Chest
    if (isWeak) {
      surf.rect(cx - 9, bodyY + 18, 18, 16, O);
      drawExposedCore(cx, bodyY + 26, 7);
    } else {
      surf.rect(cx - 3, bodyY + 20, 6, 12, acc);
      surf.rect(cx - 9, bodyY + 24, 18, 4, acc);
    }
    // Boulder Fists
    const fistY = isHeavy && f === 1 ? groundY - 16 : isSummon ? oy + 6 : bodyY + 14;
    surf.rect(cx - 31, fistY, 13, 18, O);
    surf.rect(cx - 30, fistY + 1, 11, 16, hi);
    surf.rect(cx + 18, bodyY + 14, 13, 18, O);
    surf.rect(cx + 19, bodyY + 15, 11, 16, hi);
    // Legs
    surf.rect(cx - 15, groundY - 12, 12, 12, O);
    surf.rect(cx + 3, groundY - 12, 12, 12, O);
    surf.rect(cx - 14, groundY - 11, 10, 10, c2);
    surf.rect(cx + 4, groundY - 11, 10, 10, c2);
    return;
  }

  if (b.shape === 'shadow_demon') {
    const wy = f % 2 === 0 ? oy + 6 : oy + 15;
    surf.rect(cx - 32, wy, 18, 26, O);
    surf.rect(cx - 31, wy + 1, 16, 24, c2);
    surf.rect(cx + 14, wy, 18, 26, O);
    surf.rect(cx + 15, wy + 1, 16, 24, c2);
    const bodyY = oy + 20 + bounce;
    surf.rect(cx - 14, bodyY, 28, 34, O);
    surf.rect(cx - 13, bodyY + 1, 26, 32, c1);
    surf.circle(cx, bodyY + 16, 6, acc);
    const headY = oy + 6 + bounce;
    surf.rect(cx - 10, headY, 20, 16, O);
    surf.rect(cx - 9, headY + 1, 18, 14, c2);
    surf.rect(cx - 14, headY - 6, 5, 9, hi);
    surf.rect(cx + 9, headY - 6, 5, 9, hi);
    if (isWeak) {
      drawExposedCore(cx, headY - 1, 6);
    } else {
      surf.circle(cx, headY + 2, 3, weakCol);
    }
    surf.rect(cx - 6, headY + 7, 4, 3, b.eye);
    surf.rect(cx + 2, headY + 7, 4, 3, b.eye);
    surf.rect(cx - 12, groundY - 12, 9, 12, O);
    surf.rect(cx + 3, groundY - 12, 9, 12, O);
    return;
  }

  if (b.shape === 'titan_mech') {
    const bodyY = oy + 14 + bounce;
    // Shoulder Missile Pods
    surf.rect(cx - 18, bodyY - 6, 10, 11, O);
    surf.rect(cx - 17, bodyY - 5, 8, 9, acc);
    surf.rect(cx + 8, bodyY - 6, 10, 11, O);
    surf.rect(cx + 9, bodyY - 5, 8, 9, acc);
    // Steel Mech Chassis
    surf.rect(cx - 16, bodyY, 32, 38, O);
    surf.rect(cx - 15, bodyY + 1, 30, 36, c1);
    surf.rect(cx - 12, bodyY + 5, 24, 8, c2);
    surf.rect(cx - 10, bodyY + 7, 20, 4, O);
    surf.rect(cx - 8, bodyY + 8, 16, 2, b.eye);
    // Reactor Core
    if (isWeak) {
      surf.rect(cx - 10, bodyY + 17, 20, 16, O);
      drawExposedCore(cx, bodyY + 25, 7);
    } else {
      surf.rect(cx - 9, bodyY + 18, 18, 12, hi);
      surf.circle(cx, bodyY + 24, 4, acc);
    }
    // Plasma Cannon Arm
    surf.rect(cx - 32, bodyY + 14, 18, 11, O);
    surf.rect(cx - 31, bodyY + 15, 16, 9, c2);
    if (isAtk2 || isAtk1) {
      surf.circle(cx - 33, bodyY + 19, 4, '#38bdf8');
    }
    surf.rect(cx - 14, groundY - 14, 11, 14, O);
    surf.rect(cx + 3, groundY - 14, 11, 14, O);
    return;
  }

  if (b.shape === 'abyss_dragon_king') {
    const wingY = f % 2 === 0 ? oy + 4 : oy + 14;
    surf.rect(cx + 4, wingY, 27, 32, O);
    surf.rect(cx + 5, wingY + 1, 25, 30, c2);
    surf.rect(cx + 9, wingY + 6, 16, 18, hi);
    const bodyY = oy + 20 + bounce;
    surf.rect(cx - 14, bodyY, 32, 38, O);
    surf.rect(cx - 13, bodyY + 1, 30, 36, c1);
    if (isWeak) {
      drawExposedCore(cx - 2, bodyY + 16, 7);
    } else {
      surf.rect(cx - 10, bodyY + 5, 16, 24, acc);
      surf.circle(cx - 2, bodyY + 16, 5, '#c084fc');
    }
    const headY = oy + 6 + bounce;
    surf.rect(cx - 29, headY, 27, 19, O);
    surf.rect(cx - 28, headY + 1, 25, 17, c2);
    surf.rect(cx - 18, headY - 7, 5, 8, acc);
    surf.rect(cx - 8, headY - 9, 6, 10, acc);
    surf.rect(cx - 23, headY + 5, 5, 4, b.eye);
    if (isAtk2 || isSummon) surf.circle(cx - 31, headY + 15, 5, hi);
    surf.rect(cx - 12, groundY - 10, 11, 10, O);
    surf.rect(cx + 4, groundY - 10, 11, 10, O);
    return;
  }

  // 11. Chaos Overlord (Final Boss - largest silhouette, 68px tall, 4 wings, cosmic halo & Chaos Core)
  const wy = f % 2 === 0 ? oy + 4 : oy + 12;
  surf.rect(cx - 34, wy, 16, 24, O);
  surf.rect(cx - 33, wy + 1, 14, 22, c2);
  surf.rect(cx - 30, wy + 4, 8, 12, hi);
  surf.rect(cx + 18, wy, 16, 24, O);
  surf.rect(cx + 19, wy + 1, 14, 22, c2);
  surf.rect(cx + 22, wy + 4, 8, 12, hi);
  // Lower energy wings
  surf.rect(cx - 30, oy + 32 + bounce, 14, 18, hi);
  surf.rect(cx + 16, oy + 32 + bounce, 14, 18, hi);
  // Golden Chaos Halo
  surf.circle(cx, oy + 16 + bounce, 14, acc);
  surf.circle(cx, oy + 16 + bounce, 10, O);
  // Massive Cosmic Torso
  const bodyY = oy + 20 + bounce;
  surf.rect(cx - 15, bodyY, 30, 34, O);
  surf.rect(cx - 14, bodyY + 1, 28, 32, c1);
  if (isWeak) {
    drawExposedCore(cx, bodyY + 17, 8);
  } else {
    surf.circle(cx, bodyY + 17, 7, c2);
    surf.circle(cx, bodyY + 17, 4, acc);
  }
  // Crowned Helm
  const headY = oy + 5 + bounce;
  surf.rect(cx - 10, headY, 20, 16, O);
  surf.rect(cx - 9, headY + 1, 18, 14, c2);
  surf.rect(cx - 4, headY - 5, 8, 6, acc);
  surf.rect(cx - 7, headY + 6, 14, 4, O);
  surf.rect(cx - 4, headY + 7, 8, 3, b.eye);
  // Legs
  surf.rect(cx - 13, groundY - 14, 10, 14, O);
  surf.rect(cx + 3, groundY - 14, 10, 14, O);
  surf.rect(cx - 12, groundY - 13, 8, 12, c2);
  surf.rect(cx + 4, groundY - 13, 8, 12, c2);
  if (isAtk1 || isAtk2 || isHeavy || isSummon) {
    surf.circle(cx - 24, oy + 46, 5, acc);
    surf.circle(cx + 24, oy + 46, 5, acc);
  }
}

function buildBossesSheet() {
  // 36 cols (12 anims * 3 frames) x 11 rows of 72x72 = 2592 x 792
  const surf = new PixelSurface(36 * 72, BOSS_SPRITE_DEFS.length * 72);
  BOSS_SPRITE_DEFS.forEach((b, row) => {
    BOSS_ANIM_LIST.forEach((anim, animIdx) => {
      for (let f = 0; f < 3; f++) {
        const col = animIdx * 3 + f;
        drawBossCell72(surf, col * 72, row * 72, b, anim, f);
      }
    });
  });
  surf.save('bosses.png');
}

// ---- 4b. 8 BOSS ROCK TYPES (192 x 48 -> 8 cols x 2 frames of 24x24) ----
// Cols: 0=fire, 1=ice, 2=poison, 3=spike, 4=thunder, 5=dark, 6=crystal, 7=normal
const ROCK_PALETTES = [
  { id: 'fire', outer: '#450a0a', c1: '#b91c1c', c2: '#f97316', hi: '#fef08a' },
  { id: 'ice', outer: '#082f49', c1: '#0284c7', c2: '#38bdf8', hi: '#e0f2fe' },
  { id: 'poison', outer: '#14532d', c1: '#15803d', c2: '#4ade80', hi: '#bef264' },
  { id: 'spike', outer: '#090d16', c1: '#475569', c2: '#94a3b8', hi: '#f8fafc' },
  { id: 'thunder', outer: '#1e1b4b', c1: '#ca8a04', c2: '#facc15', hi: '#ffffff' },
  { id: 'dark', outer: '#090d16', c1: '#3b0764', c2: '#7e22ce', hi: '#f43f5e' },
  { id: 'crystal', outer: '#164e63', c1: '#06b6d4', c2: '#67e8f9', hi: '#ffffff' },
  { id: 'normal', outer: '#0f172a', c1: '#57534e', c2: '#78716c', hi: '#d6d3d1' },
];

function buildRocksSheet() {
  const surf = new PixelSurface(192, 48);
  ROCK_PALETTES.forEach((rk, col) => {
    for (let f = 0; f < 2; f++) {
      const ox = col * 24;
      const oy = f * 24;
      const pulse = f === 1;
      surf.circle(ox + 12, oy + 12, 9, rk.outer);
      surf.circle(ox + 12, oy + 12, 7, rk.c1);
      surf.circle(ox + 11, oy + 11, 5, rk.c2);

      if (rk.id === 'spike') {
        // Sharp spikes around boulder
        surf.rect(ox + 11, oy + 1, 2, 4, rk.hi);
        surf.rect(ox + 11, oy + 19, 2, 4, rk.hi);
        surf.rect(ox + 1, oy + 11, 4, 2, rk.hi);
        surf.rect(ox + 19, oy + 11, 4, 2, rk.hi);
        surf.rect(ox + 4, oy + 4, 3, 3, rk.hi);
        surf.rect(ox + 17, oy + 17, 3, 3, rk.hi);
      } else if (rk.id === 'fire') {
        surf.line(ox + 8, oy + 8, ox + 15, oy + 15, rk.hi);
        surf.line(ox + 15, oy + 8, ox + 9, oy + 15, rk.hi);
        if (pulse) surf.circle(ox + 12, oy + 4, 2, rk.hi);
      } else if (rk.id === 'ice' || rk.id === 'crystal') {
        surf.rect(ox + 9, oy + 5, 6, 14, rk.c2);
        surf.rect(ox + 11, oy + 6, 3, 10, rk.hi);
        if (pulse) surf.set(ox + 8, oy + 8, '#ffffff');
      } else if (rk.id === 'thunder') {
        surf.line(ox + 13, oy + 5, ox + 9, oy + 12, rk.hi);
        surf.line(ox + 9, oy + 12, ox + 14, oy + 12, rk.hi);
        surf.line(ox + 14, oy + 12, ox + 10, oy + 18, rk.hi);
      } else if (rk.id === 'poison') {
        surf.circle(ox + 9, oy + 9, 2, rk.hi);
        surf.circle(ox + 15, oy + 13, 2, rk.hi);
        surf.rect(ox + 10, oy + 18, 3, pulse ? 4 : 2, rk.c2);
      } else if (rk.id === 'dark') {
        surf.circle(ox + 12, oy + 12, 4, '#090d16');
        surf.circle(ox + 12, oy + 12, pulse ? 3 : 2, rk.hi);
      } else {
        // normal rock cracks
        surf.line(ox + 8, oy + 9, ox + 13, oy + 12, rk.outer);
        surf.line(ox + 13, oy + 12, ox + 11, oy + 16, rk.outer);
        surf.rect(ox + 8, oy + 7, 4, 2, rk.hi);
      }
    }
  });
  surf.save('rocks.png');
}

// Keep legacy enemies.png intact for fallback safety
function buildLegacyEnemiesSheet() {
  const surf = new PixelSurface(192, 208);
  for (let f = 0; f < 4; f++) {
    const ox = f * 32;
    surf.rect(ox + 8, 16, 16, 12, '#22c55e');
  }
  surf.save('enemies.png');
}

// ---- 5. ITEMS, PROJECTILES, CHESTS & VFX ----
function buildItemsVfxSheet() {
  const surf = new PixelSurface(128, 64);
  const drawCell = (col, row, fn) => fn(col * 16, row * 16);

  drawCell(0, 0, (ox, oy) => {
    surf.rect(ox + 5, oy + 4, 6, 9, '#0f111a');
    surf.rect(ox + 6, oy + 6, 4, 6, '#eab308');
    surf.rect(ox + 6, oy + 4, 4, 2, '#94a3b8');
  });
  drawCell(1, 0, (ox, oy) => {
    surf.rect(ox + 3, oy + 4, 10, 9, '#0f111a');
    surf.rect(ox + 4, oy + 6, 3, 6, '#eab308');
    surf.rect(ox + 9, oy + 6, 3, 6, '#eab308');
    surf.rect(ox + 4, oy + 4, 3, 2, '#cbd5e1');
    surf.rect(ox + 9, oy + 4, 3, 2, '#cbd5e1');
  });
  drawCell(2, 0, (ox, oy) => {
    surf.rect(ox + 2, oy + 3, 12, 10, '#0f111a');
    surf.rect(ox + 3, oy + 4, 10, 8, '#166534');
    surf.rect(ox + 4, oy + 6, 8, 4, '#facc15');
    surf.rect(ox + 5, oy + 2, 6, 2, '#94a3b8');
  });
  drawCell(3, 0, (ox, oy) => {
    surf.rect(ox + 6, oy + 2, 4, 3, '#92400e');
    surf.circle(ox + 8, oy + 10, 5, '#0f111a');
    surf.circle(ox + 8, oy + 10, 4, '#ef4444');
    surf.set(ox + 6, oy + 8, '#fecaca');
  });
  drawCell(4, 0, (ox, oy) => {
    surf.rect(ox + 6, oy + 2, 4, 3, '#92400e');
    surf.circle(ox + 8, oy + 10, 5, '#0f111a');
    surf.circle(ox + 8, oy + 10, 4, '#2563eb');
    surf.set(ox + 6, oy + 8, '#bfdbfe');
  });
  drawCell(5, 0, (ox, oy) => {
    surf.circle(ox + 8, oy + 8, 5, '#0f111a');
    surf.circle(ox + 8, oy + 8, 4, '#facc15');
    surf.rect(ox + 7, oy + 6, 2, 4, '#ca8a04');
    surf.set(ox + 6, oy + 6, '#fef9c3');
  });
  drawCell(6, 0, (ox, oy) => {
    surf.rect(ox + 6, oy + 2, 4, 12, '#0f111a');
    surf.rect(ox + 4, oy + 5, 8, 6, '#0f111a');
    surf.rect(ox + 6, oy + 3, 4, 10, '#06b6d4');
    surf.rect(ox + 5, oy + 6, 6, 4, '#67e8f9');
    surf.set(ox + 7, oy + 4, '#ffffff');
  });
  // 7: Iron Ingot
  drawCell(7, 0, (ox, oy) => {
    surf.rect(ox + 2, oy + 5, 12, 7, '#0f111a');
    surf.rect(ox + 3, oy + 6, 10, 5, '#94a3b8');
    surf.rect(ox + 4, oy + 6, 8, 2, '#f1f5f9');
  });

  drawCell(0, 1, (ox, oy) => {
    surf.rect(ox + 3, oy + 5, 10, 6, '#0f111a');
    surf.rect(ox + 4, oy + 6, 8, 4, '#facc15');
    surf.rect(ox + 6, oy + 7, 5, 2, '#ffffff');
  });
  drawCell(1, 1, (ox, oy) => {
    surf.rect(ox + 2, oy + 4, 12, 8, '#38bdf8');
    surf.rect(ox + 4, oy + 6, 8, 4, '#ffffff');
  });
  drawCell(2, 1, (ox, oy) => {
    surf.rect(ox + 2, oy + 2, 12, 12, '#eab308');
    surf.rect(ox + 4, oy + 4, 8, 8, '#fef08a');
    surf.rect(ox + 6, oy + 5, 5, 6, '#ffffff');
  });
  drawCell(3, 1, (ox, oy) => {
    surf.circle(ox + 8, oy + 8, 4, '#0f111a');
    surf.circle(ox + 8, oy + 8, 3, '#ef4444');
    surf.set(ox + 7, oy + 7, '#fef08a');
  });
  drawCell(4, 1, (ox, oy) => {
    surf.circle(ox + 8, oy + 8, 6, '#991b1b');
    surf.circle(ox + 8, oy + 8, 4, '#f97316');
    surf.circle(ox + 8, oy + 8, 2, '#fef08a');
  });
  drawCell(5, 1, (ox, oy) => {
    surf.rect(ox + 4, oy + 1, 7, 14, '#fde047');
    surf.rect(ox + 6, oy + 2, 4, 12, '#ffffff');
  });
  drawCell(6, 1, (ox, oy) => {
    surf.rect(ox + 1, oy + 4, 14, 11, '#0f111a');
    surf.rect(ox + 2, oy + 5, 12, 9, '#92400e');
    surf.rect(ox + 2, oy + 8, 12, 2, '#facc15');
    surf.rect(ox + 7, oy + 7, 2, 4, '#fef08a');
  });
  drawCell(7, 1, (ox, oy) => {
    surf.rect(ox + 1, oy + 7, 14, 8, '#0f111a');
    surf.rect(ox + 2, oy + 8, 12, 6, '#78350f');
    surf.rect(ox + 2, oy + 3, 12, 4, '#b45309');
    surf.rect(ox + 5, oy + 6, 6, 3, '#fef08a');
  });

  for (let f = 0; f < 4; f++) {
    drawCell(f, 2, (ox, oy) => {
      const r = 2 + f * 2;
      surf.line(ox + 8 - r, oy + 8, ox + 8 + r, oy + 8, '#fef08a');
      surf.line(ox + 8, oy + 8 - r, ox + 8, oy + 8 + r, '#38bdf8');
      surf.set(ox + 8, oy + 8, '#ffffff');
    });
    drawCell(f + 4, 2, (ox, oy) => {
      const r = 2 + f * 2;
      surf.circle(ox + 8, oy + 8, Math.min(7, r), f % 2 === 0 ? '#f97316' : '#ef4444');
      surf.circle(ox + 8, oy + 8, Math.max(1, r - 2), '#fef08a');
    });
  }

  for (let f = 0; f < 4; f++) {
    drawCell(f, 3, (ox, oy) => {
      const r = 3 + f;
      surf.line(ox + 8 - r, oy + 8 - r, ox + 8 + r, oy + 8 + r, '#facc15');
      surf.line(ox + 8 - r, oy + 8 + r, ox + 8 + r, oy + 8 - r, '#facc15');
      surf.circle(ox + 8, oy + 8, 2, '#ffffff');
    });
    drawCell(f + 4, 3, (ox, oy) => {
      surf.rect(ox + 3, oy + 1, 10, 14, '#0f111a');
      surf.rect(ox + 4, oy + 2, 8, 12, f % 2 === 0 ? '#06b6d4' : '#3b82f6');
      surf.rect(ox + 6, oy + 4, 4, 8, '#e0f2fe');
    });
  }

  surf.save('items_vfx.png');
}

// ---- 6. MENU ICONS ----
function buildMenuIconsSheet() {
  const surf = new PixelSurface(120, 24);
  surf.circle(12, 12, 9, '#0f111a');
  surf.circle(12, 12, 8, '#2563eb');
  surf.rect(7, 8, 5, 4, '#22c55e');
  surf.rect(13, 11, 5, 6, '#22c55e');
  surf.rect(9, 15, 4, 3, '#16a34a');

  surf.rect(24 + 5, 3, 14, 18, '#0f111a');
  surf.rect(24 + 6, 4, 12, 16, '#fef3c7');
  surf.rect(24 + 4, 4, 16, 3, '#d97706');
  surf.rect(24 + 4, 17, 16, 3, '#d97706');
  surf.rect(24 + 11, 8, 2, 5, '#dc2626');
  surf.rect(24 + 11, 14, 2, 2, '#dc2626');

  surf.rect(48 + 9, 3, 6, 3, '#92400e');
  surf.circle(48 + 12, 14, 7, '#0f111a');
  surf.circle(48 + 12, 14, 6, '#ef4444');
  surf.circle(48 + 17, 17, 4, '#facc15');

  surf.rect(72 + 4, 13, 16, 4, '#475569');
  surf.rect(72 + 7, 17, 10, 4, '#334155');
  surf.rect(72 + 5, 11, 12, 3, '#94a3b8');
  surf.line(72 + 12, 4, 72 + 17, 9, '#eab308');
  surf.rect(72 + 8, 4, 6, 4, '#cbd5e1');

  surf.rect(96 + 6, 5, 12, 14, '#0f111a');
  surf.rect(96 + 7, 6, 10, 12, '#3b82f6');
  surf.rect(96 + 9, 8, 6, 8, '#eab308');
  surf.line(96 + 4, 19, 96 + 19, 4, '#e2e8f0');

  surf.save('menu_icons.png');
}

// ---- 7. GEAR ICONS (96 x 32 -> row 0: 5 Armors 16x16, row 1: 4 Accessories + 2 Grapple Hooks 16x16) ----
function buildGearIconsSheet() {
  const surf = new PixelSurface(96, 32);
  const armorColors = [
    { c1: '#334155', c2: '#64748b', hi: '#cbd5e1', trim: '#dc2626' }, // Skull Iron & Red Cape Vest
    { c1: '#475569', c2: '#94a3b8', hi: '#e2e8f0', trim: '#cbd5e1' }, // Iron Mail
    { c1: '#0284c7', c2: '#38bdf8', hi: '#e0f2fe', trim: '#67e8f9' }, // Crystal Plate
    { c1: '#7f1d1d', c2: '#dc2626', hi: '#fca5a5', trim: '#facc15' }, // Dragon Scale
    { c1: '#b45309', c2: '#facc15', hi: '#ffffff', trim: '#38bdf8' }, // Aegis Armor
  ];
  armorColors.forEach((a, i) => {
    const ox = i * 16;
    surf.rect(ox + 3, 2, 10, 12, '#0f111a');
    surf.rect(ox + 2, 3, 12, 5, '#0f111a');
    surf.rect(ox + 4, 3, 8, 10, a.c1);
    surf.rect(ox + 5, 4, 6, 8, a.c2);
    surf.rect(ox + 3, 4, 3, 3, a.hi);
    surf.rect(ox + 10, 4, 3, 3, a.hi);
    surf.rect(ox + 6, 5, 4, 4, a.trim);
    surf.rect(ox + 6, 2, 4, 2, '#0f111a'); // collar notch
  });

  // Row 1: 4 Accessories (Ammo Belt, Crit Ring, Power Gauntlet, Wind Boots) + 2 Grapple Hooks (cols 4..5)
  // 0: Ammo Belt
  surf.rect(2, 16 + 5, 12, 6, '#0f111a');
  surf.rect(3, 16 + 6, 10, 4, '#92400e');
  surf.rect(4, 16 + 7, 2, 2, '#facc15');
  surf.rect(7, 16 + 7, 2, 2, '#facc15');
  surf.rect(10, 16 + 7, 2, 2, '#facc15');
  // 1: Crit Ring
  surf.circle(16 + 8, 16 + 9, 5, '#0f111a');
  surf.circle(16 + 8, 16 + 9, 4, '#eab308');
  surf.circle(16 + 8, 16 + 9, 2, '#0f111a');
  surf.rect(16 + 6, 16 + 2, 4, 4, '#ef4444');
  surf.set(16 + 7, 16 + 3, '#fecaca');
  // 2: Power Gauntlet
  surf.rect(32 + 4, 16 + 3, 8, 10, '#0f111a');
  surf.rect(32 + 5, 16 + 4, 6, 8, '#dc2626');
  surf.rect(32 + 5, 16 + 4, 6, 3, '#facc15');
  surf.rect(32 + 3, 16 + 6, 2, 4, '#991b1b');
  // 3: Wind Boots
  surf.rect(48 + 4, 16 + 3, 6, 10, '#0f111a');
  surf.rect(48 + 4, 16 + 9, 9, 4, '#0f111a');
  surf.rect(48 + 5, 16 + 4, 4, 8, '#14b8a6');
  surf.rect(48 + 5, 16 + 10, 7, 2, '#5eead4');
  surf.line(48 + 9, 16 + 5, 48 + 13, 16 + 3, '#ffffff');
  surf.line(48 + 9, 16 + 7, 48 + 12, 16 + 6, '#bae6fd');

  // 4: Iron Grapple Hook (col 4, y=16)
  surf.line(64 + 3, 16 + 13, 64 + 11, 16 + 5, '#0f111a');
  surf.line(64 + 3, 16 + 12, 64 + 11, 16 + 4, '#94a3b8');
  surf.rect(64 + 8, 16 + 2, 6, 6, '#0f111a');
  surf.line(64 + 8, 16 + 3, 64 + 13, 16 + 3, '#cbd5e1');
  surf.line(64 + 12, 16 + 3, 64 + 12, 16 + 8, '#cbd5e1');
  surf.set(64 + 12, 16 + 3, '#38bdf8');
  surf.rect(64 + 2, 16 + 11, 3, 3, '#334155');

  // 5: Plasma Grapple Hook (col 5, y=16)
  surf.line(80 + 3, 16 + 13, 80 + 11, 16 + 5, '#0f111a');
  surf.line(80 + 3, 16 + 12, 80 + 11, 16 + 4, '#38bdf8');
  surf.rect(80 + 8, 16 + 2, 6, 6, '#0f111a');
  surf.line(80 + 8, 16 + 3, 80 + 13, 16 + 3, '#facc15');
  surf.line(80 + 12, 16 + 3, 80 + 12, 16 + 8, '#facc15');
  surf.set(80 + 12, 16 + 3, '#ffffff');
  surf.rect(80 + 2, 16 + 11, 3, 3, '#1d4ed8');

  surf.save('gear.png');
}

// ---- 8. ROTATING LARGE SQUARE PORTALS (256 x 64 -> 8 frames x 2 kinds of 32x32) ----
function buildPortalsSheet() {
  const surf = new PixelSurface(256, 64);
  const kinds = [
    // Row 0: Exit Portal (Emerald / Gold rotating vortex square)
    { outer: '#facc15', mid: '#22c55e', inner: '#bbf7d0', core: '#ffffff' },
    // Row 1: Branch Warp Portal (Cyan / Violet rotating vortex square)
    { outer: '#38bdf8', mid: '#7c3aed', inner: '#e0f2fe', core: '#ffffff' },
  ];
  kinds.forEach((k, row) => {
    for (let f = 0; f < 8; f++) {
      const ox = f * 32;
      const oy = row * 32;
      const ang = (f / 8) * (Math.PI / 2);
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      // Draw larger rotating square frame (half-size 12 -> ~26x26 bounding box inside 32x32)
      for (let y = -14; y <= 14; y++) {
        for (let x = -14; x <= 14; x++) {
          const rx = x * cos - y * sin;
          const ry = x * sin + y * cos;
          const cheb = Math.max(Math.abs(rx), Math.abs(ry));
          if (cheb <= 12.2 && cheb >= 9.6) {
            surf.set(ox + 16 + x, oy + 16 + y, '#0f111a');
          }
          if (cheb <= 11.4 && cheb >= 10.2) {
            surf.set(ox + 16 + x, oy + 16 + y, k.outer);
          } else if (cheb < 10.2 && cheb >= 5.2) {
            // Spiral swirl pattern
            const angle = Math.atan2(y, x) + f * 0.8 + cheb * 0.45;
            surf.set(ox + 16 + x, oy + 16 + y, Math.sin(angle * 2) > 0 ? k.mid : k.inner);
          } else if (cheb < 5.2) {
            surf.set(ox + 16 + x, oy + 16 + y, cheb < 2.2 ? k.core : k.inner);
          }
        }
      }
    }
  });
  surf.save('portals.png');
}

// ---- 9. 6-BIOME TILESET (160 x 96 -> 10 cols x 6 biome rows of 16x16) ----
// Biomes: 0=Waterfall, 1=Desert, 2=Snow, 3=Volcano, 4=Galaxy, 5=Graveyard
const BIOME_PALETTES = [
  { top: '#22c55e', topH: '#86efac', rock1: '#334155', rock2: '#1e293b', rockH: '#64748b', plat: '#0284c7', accent: '#38bdf8', water1: '#0284c7', water2: '#7dd3fc' }, // 0: Air Terjun
  { top: '#f59e0b', topH: '#fde68a', rock1: '#b45309', rock2: '#78350f', rockH: '#d97706', plat: '#d97706', accent: '#fef08a', water1: '#0369a1', water2: '#38bdf8' }, // 1: Gurun
  { top: '#f8fafc', topH: '#ffffff', rock1: '#38bdf8', rock2: '#0369a1', rockH: '#bae6fd', plat: '#0284c7', accent: '#e0f2fe', water1: '#0ea5e9', water2: '#e0f2fe' }, // 2: Salju
  { top: '#f97316', topH: '#fed7aa', rock1: '#450a0a', rock2: '#271212', rockH: '#7f1d1d', plat: '#b91c1c', accent: '#facc15', water1: '#ea580c', water2: '#fef08a' }, // 3: Vulkano
  { top: '#a855f7', topH: '#e9d5ff', rock1: '#1e1b4b', rock2: '#0f0d1f', rockH: '#4338ca', plat: '#6366f1', accent: '#22d3ee', water1: '#4f46e5', water2: '#c084fc' }, // 4: Galaxy
  { top: '#65a30d', topH: '#bef264', rock1: '#374151', rock2: '#1f2937', rockH: '#6b7280', plat: '#4b5563', accent: '#c084fc', water1: '#115e59', water2: '#5eead4' }, // 5: Kuburan
];

function buildTilesSheet() {
  // 12 cols x 6 biomes of 16x16 = 192 x 96
  const surf = new PixelSurface(192, 96);
  BIOME_PALETTES.forEach((p, bIdx) => {
    const oy = bIdx * 16;
    // 0: Solid Ground Top (extra icy sheen for Snow biome bIdx === 2)
    surf.rect(0, oy, 16, 16, p.rock2);
    surf.rect(1, oy + 4, 14, 11, p.rock1);
    surf.rect(0, oy, 16, 4, p.top);
    surf.rect(0, oy, 16, 1, p.topH);
    if (bIdx === 2) {
      // Slippery ice crust highlights on snow top
      surf.rect(2, oy + 1, 5, 2, '#7dd3fc');
      surf.rect(9, oy + 1, 5, 2, '#bae6fd');
      surf.set(4, oy + 1, '#ffffff');
      surf.set(11, oy + 1, '#ffffff');
    }
    surf.rect(3, oy + 7, 4, 3, p.rockH);
    surf.rect(10, oy + 10, 4, 3, p.rockH);

    // 1: Solid Brick Fill
    surf.rect(16, oy, 16, 16, p.rock2);
    surf.rect(17, oy + 1, 6, 6, p.rock1);
    surf.rect(25, oy + 1, 6, 6, p.rock1);
    surf.rect(20, oy + 9, 8, 6, p.rock1);
    surf.rect(17, oy + 1, 6, 1, p.rockH);

    // 2: One-way Platform
    surf.rect(32, oy, 16, 5, '#0f111a');
    surf.rect(32, oy + 1, 16, 3, p.plat);
    surf.rect(32, oy + 1, 16, 1, p.topH);

    // 3: Vertical Ladder
    surf.rect(48 + 3, oy, 2, 16, '#92400e');
    surf.rect(48 + 11, oy, 2, 16, '#92400e');
    surf.rect(48 + 3, oy + 3, 10, 2, '#facc15');
    surf.rect(48 + 3, oy + 11, 10, 2, '#facc15');

    // 4: Spikes
    for (let s = 0; s < 2; s++) {
      const sx = 64 + s * 8;
      surf.rect(sx + 3, oy + 4, 2, 12, '#ffffff');
      surf.rect(sx + 2, oy + 7, 4, 9, '#cbd5e1');
      surf.rect(sx + 1, oy + 11, 6, 5, '#64748b');
    }

    // 5: Pillar / Torch
    surf.rect(80 + 5, oy, 6, 16, p.rock1);
    surf.rect(80 + 6, oy + 2, 4, 4, p.accent);

    // 6: Moving Platform Tile (col 6)
    surf.rect(96, oy, 16, 8, '#0f111a');
    surf.rect(97, oy + 1, 14, 6, p.plat);
    surf.rect(98, oy + 2, 12, 2, p.accent);
    surf.set(99, oy + 5, '#ffffff');
    surf.set(108, oy + 5, '#ffffff');

    // 7: Overhead Horizontal Monkey Bar / Climb Rail (col 7)
    surf.rect(112, oy + 2, 16, 4, '#0f111a');
    surf.rect(112, oy + 3, 16, 2, '#facc15');
    surf.rect(114, oy + 1, 2, 6, '#94a3b8');
    surf.rect(122, oy + 1, 2, 6, '#94a3b8');

    // 8: Water Surface (col 8) & 9: Deep Water (col 9)
    surf.rect(128, oy + 3, 16, 13, p.water1);
    surf.rect(128, oy + 2, 16, 3, p.water2);
    surf.rect(130, oy + 2, 4, 1, '#ffffff');
    surf.rect(138, oy + 3, 4, 1, '#ffffff');
    surf.rect(144, oy, 16, 16, p.water1);
    surf.rect(147, oy + 4, 3, 1, p.water2);
    surf.rect(153, oy + 10, 3, 1, p.water2);

    // 10: Quicksand / Pasir Hisap (col 10)
    surf.rect(160, oy, 16, 16, '#92400e');
    surf.rect(160, oy + 2, 16, 3, '#d97706');
    surf.rect(162, oy + 4, 5, 2, '#fef08a');
    surf.rect(169, oy + 7, 5, 2, '#f59e0b');
    surf.rect(163, oy + 11, 7, 2, '#78350f');
    surf.set(166, oy + 1, '#fde68a');
    surf.set(172, oy + 2, '#fde68a');

    // 11: Destructible Arena Platform (col 11)
    surf.rect(176, oy, 16, 6, '#0f111a');
    surf.rect(176, oy + 1, 16, 4, '#64748b');
    surf.rect(177, oy + 1, 14, 1, '#cbd5e1');
    surf.line(180, oy + 1, 182, oy + 4, '#0f111a');
    surf.line(187, oy + 1, 186, oy + 4, '#0f111a');
  });
  surf.save('tiles.png');
}

// ---- 10. 6-BIOME PARALLAX BACKGROUNDS (256 x 1440) ----
function buildBackgroundsSheet() {
  const surf = new PixelSurface(256, 1440);
  const bgConfigs = [
    // 0: Air Terjun (Waterfall)
    { kind: 'waterfall', sky1: '#071b24', sky2: '#0f3847', sky3: '#155e75', moon: '#fef08a', hill1: '#14532d', hill2: '#166534', star: '#bae6fd' },
    // 1: Gurun (Desert)
    { kind: 'desert', sky1: '#451a03', sky2: '#92400e', sky3: '#d97706', moon: '#fef08a', hill1: '#b45309', hill2: '#f59e0b', star: '#fde68a' },
    // 2: Salju (Snow)
    { kind: 'snow', sky1: '#082f49', sky2: '#0369a1', sky3: '#38bdf8', moon: '#f8fafc', hill1: '#1e3a8a', hill2: '#e0f2fe', star: '#ffffff' },
    // 3: Vulkano (Volcano)
    { kind: 'volcano', sky1: '#1c0707', sky2: '#450a0a', sky3: '#9a3412', moon: '#fb923c', hill1: '#271212', hill2: '#7f1d1d', star: '#fde047' },
    // 4: Galaxy
    { kind: 'galaxy', sky1: '#040312', sky2: '#1e1b4b', sky3: '#4c1d95', moon: '#c084fc', hill1: '#1e1b4b', hill2: '#312e81', star: '#e0f2fe' },
    // 5: Kuburan (Graveyard)
    { kind: 'graveyard', sky1: '#090717', sky2: '#1f1638', sky3: '#312e59', moon: '#e2e8f0', hill1: '#111827', hill2: '#1f2937', star: '#cbd5e1' },
  ];

  bgConfigs.forEach((cfg, idx) => {
    const oy = idx * 240;
    for (let y = 0; y < 240; y++) {
      for (let x = 0; x < 256; x++) {
        let col = cfg.sky1;
        if (y >= 44 && y < 60) col = (x + y) % 2 === 0 ? cfg.sky1 : cfg.sky2;
        else if (y >= 60 && y < 110) col = cfg.sky2;
        else if (y >= 110 && y < 128) col = (x + y) % 2 === 0 ? cfg.sky2 : cfg.sky3;
        else if (y >= 128) col = cfg.sky3;
        surf.set(x, oy + y, col);
      }
    }

    // Sky celestial body (Sun/Moon/Ringed Planet)
    if (cfg.kind === 'desert') {
      surf.circle(202, oy + 44, 13, '#fde047');
    } else if (cfg.kind === 'galaxy') {
      surf.circle(196, oy + 46, 12, '#a855f7');
      surf.line(176, oy + 52, 216, oy + 40, '#38bdf8');
      surf.line(178, oy + 53, 214, oy + 41, '#e0f2fe');
    } else if (cfg.kind === 'graveyard') {
      surf.circle(204, oy + 42, 13, '#f1f5f9');
    } else {
      surf.circle(204, oy + 42, 11, cfg.moon);
      surf.circle(208, oy + 39, 9, cfg.sky1);
    }

    // Stars / Snowflakes / Embers
    let seed = (idx + 1) * 4919;
    const starCount = cfg.kind === 'galaxy' ? 68 : 34;
    for (let i = 0; i < starCount; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const sx = seed % 256;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const sy = oy + 8 + (seed % 110);
      surf.set(sx, sy, cfg.star);
    }

    // Biome-specific horizon features
    if (cfg.kind === 'desert') {
      // Pyramids
      for (let p = 0; p < 2; p++) {
        const px = 40 + p * 120;
        const size = p === 0 ? 48 : 36;
        for (let r = 0; r < size; r++) {
          surf.rect(px - r, oy + 170 + r, r * 2 + 1, 1, r % 4 === 0 ? '#92400e' : '#b45309');
        }
      }
    } else if (cfg.kind === 'volcano') {
      // Volcano peak + glowing crater
      for (let r = 0; r < 64; r++) {
        const half = 12 + r;
        surf.rect(128 - half, oy + 140 + r, half * 2, 1, '#271212');
      }
      surf.rect(116, oy + 138, 24, 4, '#f97316');
      surf.rect(120, oy + 136, 16, 3, '#fef08a');
    }

    // Hills / Cliffs
    for (let x = 0; x < 256; x++) {
      const h1 = Math.round(68 + Math.sin((x / 256) * Math.PI * 4) * 20 + Math.cos((x / 256) * Math.PI * 8) * 9);
      surf.rect(x, oy + 240 - h1, 1, h1, cfg.hill1);
      const h2 = Math.round(42 + Math.sin((x / 256) * Math.PI * 6 + 1.2) * 12);
      surf.rect(x, oy + 240 - h2, 1, h2, cfg.hill2);
    }

    if (cfg.kind === 'waterfall') {
      // Cascading pixel waterfall columns
      for (const wx of [54, 178]) {
        surf.rect(wx, oy + 150, 18, 90, '#0284c7');
        surf.rect(wx + 3, oy + 150, 4, 90, '#7dd3fc');
        surf.rect(wx + 11, oy + 152, 3, 88, '#e0f2fe');
        surf.rect(wx - 2, oy + 232, 22, 6, '#e0f2fe');
      }
    } else if (cfg.kind === 'graveyard') {
      // Tombstones & crosses
      for (const tx of [28, 76, 134, 210]) {
        surf.rect(tx, oy + 188, 10, 14, '#4b5563');
        surf.rect(tx + 2, oy + 186, 6, 2, '#6b7280');
        surf.rect(tx + 4, oy + 190, 2, 7, '#1f2937');
        surf.rect(tx + 2, oy + 192, 6, 2, '#1f2937');
      }
    }
  });
  surf.save('backgrounds.png');
}

// ---- 11. 10 GUNS & PROJECTILES ----
const GUN_PALETTES = [
  { body: '#64748b', hi: '#cbd5e1', core: '#38bdf8', grip: '#78350f', shot: '#facc15', shotCore: '#ffffff', shotgun: false },
  { body: '#1d4ed8', hi: '#93c5fd', core: '#facc15', grip: '#1e293b', shot: '#38bdf8', shotCore: '#e0f2fe', shotgun: false },
  { body: '#475569', hi: '#94a3b8', core: '#f97316', grip: '#92400e', shot: '#fb923c', shotCore: '#fef08a', shotgun: true },
  { body: '#0284c7', hi: '#67e8f9', core: '#ffffff', grip: '#1e3a8a', shot: '#22d3ee', shotCore: '#ffffff', shotgun: false },
  { body: '#991b1b', hi: '#f87171', core: '#fde047', grip: '#451a03', shot: '#ef4444', shotCore: '#fef08a', shotgun: true },
  { body: '#ca8a04', hi: '#fef08a', core: '#38bdf8', grip: '#1e293b', shot: '#facc15', shotCore: '#ffffff', shotgun: false },
  { body: '#b91c1c', hi: '#fb923c', core: '#fef08a', grip: '#271212', shot: '#f97316', shotCore: '#ffffff', shotgun: false },
  { body: '#3b0764', hi: '#c084fc', core: '#f43f5e', grip: '#0f172a', shot: '#a855f7', shotCore: '#fdf4ff', shotgun: false },
  { body: '#0f766e', hi: '#5eead4', core: '#facc15', grip: '#1e293b', shot: '#2dd4bf', shotCore: '#ffffff', shotgun: false },
  { body: '#eab308', hi: '#fef9c3', core: '#38bdf8', grip: '#1e3a8a', shot: '#fde047', shotCore: '#ffffff', shotgun: false },
];

function buildGunsSheet() {
  const surf = new PixelSurface(160, 32);
  GUN_PALETTES.forEach((g, idx) => {
    const ox = idx * 16;
    const barrelLen = g.shotgun ? 10 : idx >= 6 ? 12 : 9;
    const barrelH = g.shotgun ? 4 : idx >= 6 ? 4 : 3;
    surf.rect(ox + 2, 5, barrelLen + 1, barrelH + 2, '#0f111a');
    surf.rect(ox + 3, 6, barrelLen - 1, barrelH, g.body);
    surf.rect(ox + 3, 6, barrelLen - 1, 1, g.hi);
    surf.rect(ox + 5, 7, 2, 2, g.core);
    surf.rect(ox + 3, 9, 4, 5, '#0f111a');
    surf.rect(ox + 4, 9, 2, 4, g.grip);
    if (g.shotgun) {
      surf.rect(ox + 7, 10, 5, 2, g.grip);
    }

    const py = 16;
    if (g.shotgun) {
      surf.circle(ox + 8, py + 8, 3, '#0f111a');
      surf.circle(ox + 8, py + 8, 2, g.shot);
      surf.set(ox + 8, py + 8, g.shotCore);
    } else if (idx === 9) {
      surf.rect(ox + 1, py + 5, 14, 6, '#0f111a');
      surf.rect(ox + 2, py + 6, 12, 4, g.shot);
      surf.rect(ox + 3, py + 7, 10, 2, g.shotCore);
    } else {
      surf.rect(ox + 3, py + 5, 10, 6, '#0f111a');
      surf.rect(ox + 4, py + 6, 8, 4, g.shot);
      surf.rect(ox + 6, py + 7, 5, 2, g.shotCore);
    }
  });
  surf.save('guns.png');
}

buildHeroSheet();
buildSwordsSheet();
buildKerocoEnemiesSheet();
buildBossesSheet();
buildRocksSheet();
buildLegacyEnemiesSheet();
buildItemsVfxSheet();
buildMenuIconsSheet();
buildGearIconsSheet();
buildPortalsSheet();
buildTilesSheet();
buildBackgroundsSheet();
buildGunsSheet();
