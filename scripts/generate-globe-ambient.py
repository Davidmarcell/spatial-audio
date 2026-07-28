#!/usr/bin/env python3
"""Build the globe-browse ambient from a quiet Auckland soundscape layout.

Writes public/audio/ui/globe-ambient.mp3 — a distant "wireframe" of Auckland's
default tile mix (tui / fantail / forest / summer insects), lowpassed and quiet,
crossfaded into a seamless 24s stereo loop. Replaces the earlier abstract pad.
"""

from __future__ import annotations

import math
import struct
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT_MP3 = ROOT / 'public' / 'audio' / 'ui' / 'globe-ambient.mp3'

SR = 44100
DURATION = 24.0
N = int(SR * DURATION)
FADE = int(SR * 3.0)

# Quiet distant read of Auckland's bed layout (birds + bush + cicadas).
LAYERS = [
  (ROOT / 'public' / 'audio' / 'nz' / 'tui-loop.ogg', 0.10),
  (ROOT / 'public' / 'audio' / 'nz' / 'fantail-loop.ogg', 0.07),
  (ROOT / 'public' / 'audio' / 'nz' / 'bellbird-loop.ogg', 0.05),
  (ROOT / 'public' / 'audio' / 'nz' / 'forest-ambience.mp3', 0.14),
  (ROOT / 'public' / 'audio' / 'costa-rica' / 'insect-chorus.mp3', 0.045),
]


def one_pole_lowpass(x: np.ndarray, cutoff_hz: float) -> np.ndarray:
  a = math.exp(-2.0 * math.pi * cutoff_hz / SR)
  y = np.empty_like(x)
  acc = 0.0
  coeff = 1.0 - a
  for i, sample in enumerate(x):
    acc = coeff * sample + a * acc
    y[i] = acc
  return y


def one_pole_highpass(x: np.ndarray, cutoff_hz: float) -> np.ndarray:
  a = math.exp(-2.0 * math.pi * cutoff_hz / SR)
  y = np.empty_like(x)
  prev_x = 0.0
  prev_y = 0.0
  for i, sample in enumerate(x):
    prev_y = a * (prev_y + sample - prev_x)
    prev_x = sample
    y[i] = prev_y
  return y


def load_mono(path: Path) -> np.ndarray:
  wav = Path('/tmp') / f'{path.stem}-globe-amb.wav'
  subprocess.check_call(
    ['ffmpeg', '-y', '-i', str(path), '-ac', '1', '-ar', str(SR), str(wav)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.STDOUT,
  )
  raw = wav.read_bytes()
  idx = raw.find(b'data')
  nbytes = struct.unpack_from('<I', raw, idx + 4)[0]
  return np.frombuffer(raw[idx + 8 : idx + 8 + nbytes], dtype=np.int16).astype(np.float64) / 32768.0


def loop_to(x: np.ndarray, length: int) -> np.ndarray:
  if len(x) == 0:
    return np.zeros(length)
  reps = int(math.ceil(length / len(x)))
  return np.tile(x, reps)[:length]


def main() -> int:
  print('generating Auckland wireframe globe ambient…', file=sys.stderr)
  mix = np.zeros(N, dtype=np.float64)
  for path, gain in LAYERS:
    if not path.exists():
      print(f'missing layer: {path}', file=sys.stderr)
      return 1
    mono = load_mono(path)
    soft = one_pole_highpass(one_pole_lowpass(mono, 1800.0), 80.0)
    mix += loop_to(soft, N) * gain

  t = np.arange(N, dtype=np.float64) / SR
  mix *= 0.88 + 0.12 * np.sin(2 * math.pi * 0.02 * t)

  fade_in = np.sin(0.5 * math.pi * np.linspace(0, 1, FADE)) ** 2
  fade_out = np.sin(0.5 * math.pi * np.linspace(1, 0, FADE)) ** 2
  mix[-FADE:] = mix[-FADE:] * fade_out + mix[:FADE] * fade_in
  intro = int(SR * 0.5)
  mix[:intro] *= np.linspace(0.0, 1.0, intro)

  peak = float(np.max(np.abs(mix)) or 1.0)
  mix = mix / peak * 0.42

  delay = int(0.016 * SR)
  right = np.roll(mix, delay)
  stereo = np.stack([mix * 0.98, right * 0.98], axis=1)

  wav_path = Path('/tmp/globe-ambient.wav')
  pcm_i16 = (np.clip(stereo, -1, 1) * 32767.0).astype(np.int16)
  data = pcm_i16.tobytes()
  with wav_path.open('wb') as handle:
    handle.write(b'RIFF')
    handle.write(struct.pack('<I', 36 + len(data)))
    handle.write(b'WAVEfmt ')
    handle.write(struct.pack('<IHHIIHH', 16, 1, 2, SR, SR * 4, 4, 16))
    handle.write(b'data')
    handle.write(struct.pack('<I', len(data)))
    handle.write(data)

  OUT_MP3.parent.mkdir(parents=True, exist_ok=True)
  subprocess.check_call(
    [
      'ffmpeg',
      '-y',
      '-i',
      str(wav_path),
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '160k',
      '-ar',
      '44100',
      str(OUT_MP3),
    ],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.STDOUT,
  )
  print(f'wrote {OUT_MP3} ({OUT_MP3.stat().st_size} bytes)', file=sys.stderr)
  return 0


if __name__ == '__main__':
  raise SystemExit(main())
