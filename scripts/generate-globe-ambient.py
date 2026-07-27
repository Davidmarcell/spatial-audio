#!/usr/bin/env python3
"""Synthesize the ethereal globe-browse ambient loop.

Writes public/audio/ui/globe-ambient.mp3 — soft filtered noise + quiet pad drones,
crossfaded into a seamless 24s stereo loop for map browsing.
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


def soft_clip(x: np.ndarray, drive: float = 1.15) -> np.ndarray:
  return np.tanh(x * drive) / math.tanh(drive)


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


def normalize(x: np.ndarray) -> np.ndarray:
  peak = float(np.max(np.abs(x)) or 1.0)
  return x / peak


def main() -> int:
  rng = np.random.default_rng(42)
  t = np.arange(N, dtype=np.float64) / SR

  print('generating ethereal globe ambient…', file=sys.stderr)

  white = rng.standard_normal(N)
  brown = np.cumsum(white)
  brown = normalize(brown - np.mean(brown))
  body = normalize(one_pole_lowpass(one_pole_lowpass(brown, 420.0), 280.0))

  p = white
  for cutoff in (8000, 2000, 900, 400):
    p = 0.65 * p + 0.35 * one_pole_lowpass(white, cutoff)
  pink = normalize(p)
  hush = normalize(one_pole_highpass(one_pole_lowpass(pink, 1200.0), 120.0))

  shimmer = normalize(one_pole_highpass(one_pole_lowpass(rng.standard_normal(N), 6200.0), 2800.0))
  shimmer_env = 0.55 + 0.45 * np.sin(2 * math.pi * 0.03 * t + 0.4)
  shimmer_env *= 0.7 + 0.3 * np.sin(2 * math.pi * 0.011 * t + 1.7)
  shimmer *= shimmer_env

  def drone(freq: float, amp: float, lfo_hz: float, phase: float = 0.0) -> np.ndarray:
    vibr = 1.0 + 0.0018 * np.sin(2 * math.pi * 0.07 * t + phase)
    wave = np.sin(2 * math.pi * freq * vibr * t + phase)
    wave += 0.12 * np.sin(2 * math.pi * freq * 2 * vibr * t + phase * 1.3)
    wave += 0.05 * np.sin(2 * math.pi * freq * 3 * vibr * t + phase * 0.7)
    env = 0.72 + 0.28 * np.sin(2 * math.pi * lfo_hz * t + phase)
    return soft_clip(wave) * env * amp

  pad = (
    drone(98.0, 0.11, 0.017, 0.2)
    + drone(146.8, 0.08, 0.013, 1.1)
    + drone(196.0, 0.055, 0.021, 2.4)
    + drone(294.0, 0.03, 0.009, 0.8)
  )

  mono = 0.55 * body + 0.28 * hush + 0.09 * shimmer + pad
  breath = 0.88 + 0.12 * np.sin(2 * math.pi * 0.025 * t + 0.6)
  breath *= 0.94 + 0.06 * np.sin(2 * math.pi * 0.008 * t)
  mono *= breath

  fade_in = np.sin(0.5 * math.pi * np.linspace(0, 1, FADE)) ** 2
  fade_out = np.sin(0.5 * math.pi * np.linspace(1, 0, FADE)) ** 2
  mono[-FADE:] = mono[-FADE:] * fade_out + mono[:FADE] * fade_in
  intro = int(SR * 0.35)
  mono[:intro] *= np.linspace(0.0, 1.0, intro)

  delay = int(0.018 * SR)
  right = one_pole_lowpass(np.roll(mono, delay), 9000.0)
  width = 0.12 * np.roll(hush, int(0.027 * SR))
  stereo = np.stack([mono + width, right - width], axis=1)
  stereo = stereo / (float(np.max(np.abs(stereo)) or 1.0)) * 0.72

  wav_path = Path('/tmp/globe-ambient.wav')
  pcm_i16 = (np.clip(stereo, -1, 1) * 32767.0).astype(np.int16)
  data = pcm_i16.tobytes()
  channels = 2
  bits = 16
  byte_rate = SR * channels * bits // 8
  block_align = channels * bits // 8
  with wav_path.open('wb') as handle:
    handle.write(b'RIFF')
    handle.write(struct.pack('<I', 36 + len(data)))
    handle.write(b'WAVEfmt ')
    handle.write(struct.pack('<IHHIIHH', 16, 1, channels, SR, byte_rate, block_align, bits))
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
