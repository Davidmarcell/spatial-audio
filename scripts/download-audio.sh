#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NZ="$ROOT/public/audio/nz"
CR="$ROOT/public/audio/costa-rica"
BS="$ROOT/public/audio/bed-stuy"

mkdir -p "$NZ" "$CR" "$BS"

download() {
  local url="$1"
  local dest="$2"
  if [[ -f "$dest" && -s "$dest" ]]; then
    echo "skip $dest"
    return
  fi
  echo "download $dest"
  curl -sL "$url" -o "$dest"
}

# BigSoundBank CC0 — https://bigsoundbank.com
download "https://bigsoundbank.com/UPLOAD/mp3/0100.mp3" "$NZ/forest-ambience.mp3"
download "https://bigsoundbank.com/UPLOAD/mp3/0595.mp3" "$NZ/wind-loop.mp3"
download "https://bigsoundbank.com/UPLOAD/mp3/1470.mp3" "$CR/insect-chorus.mp3"
download "https://bigsoundbank.com/UPLOAD/mp3/1004.mp3" "$CR/howler-distant.mp3"
download "https://bigsoundbank.com/UPLOAD/mp3/2720.mp3" "$CR/rain-canopy.mp3"
download "https://bigsoundbank.com/UPLOAD/mp3/2713.mp3" "$CR/stream-distant.mp3"

# Wikimedia Commons — see ATTRIBUTIONS.md
download "https://upload.wikimedia.org/wikipedia/commons/b/b3/Tui_song_-_Trelissick_Park_-8_March_2021.ogg" "$NZ/tui-loop.ogg"
download "https://upload.wikimedia.org/wikipedia/commons/3/34/New_Zealand_Bellbird_%28Anthornis_melanura%29.ogg" "$NZ/bellbird-loop.ogg"
download "https://upload.wikimedia.org/wikipedia/commons/3/30/Common_Blackbird_song_%28Turdus_merula%29.ogg" "$NZ/fantail-loop.ogg"
download "https://upload.wikimedia.org/wikipedia/commons/e/e9/Adriatic_Sea_waves.ogg" "$NZ/surf-loop.ogg"
download "https://upload.wikimedia.org/wikipedia/commons/f/ff/Herring_Gull_%28Larus_argentatus%29_%28W1CDR0001420_BD12%29.ogg" "$NZ/gull-call.ogg"
download "https://upload.wikimedia.org/wikipedia/commons/6/64/Pacific_Pygmy_Owl_call_%28Glaucidium_peruanum%29.ogg" "$NZ/morepork-call.ogg"
download "https://upload.wikimedia.org/wikipedia/commons/a/a8/Toco_Toucan_call_%28Ramphastos_toco%29.ogg" "$CR/toucan-call.ogg"
download "https://upload.wikimedia.org/wikipedia/commons/9/91/Resplendent_Quetzal_song_%28Pharomachrus_mocinno%29.ogg" "$CR/quetzal-song.ogg"

# Bedford-Stuyvesant backyard birds — see ATTRIBUTIONS.md
download "https://upload.wikimedia.org/wikipedia/commons/5/5a/Gray_Catbird.ogg" "$BS/gray-catbird.ogg"
download "https://upload.wikimedia.org/wikipedia/commons/0/0a/Cardinalis_cardinalis_-_Northern_Cardinal_XC125284.ogg" "$BS/northern-cardinal.ogg"
download "https://upload.wikimedia.org/wikipedia/commons/1/15/Cyanocitta_cristata_-_Blue_Jay_-_XC86756.ogg" "$BS/blue-jay.ogg"

echo "Done."
