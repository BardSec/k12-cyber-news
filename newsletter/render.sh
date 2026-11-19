#!/bin/sh
# Renders header.html to k12-cyber-watch-header.png with headless Chrome.
cd "$(dirname "$0")"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --hide-scrollbars \
  --window-size=1456,485 --screenshot="$PWD/k12-cyber-watch-header.png" "file://$PWD/header.html" 2>/dev/null
