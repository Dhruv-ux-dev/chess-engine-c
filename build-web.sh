#!/bin/sh
# Compile the engine to WebAssembly for the browser UI in web/.
# Requires Emscripten (emcc). Output: web/alphabeta.js + web/alphabeta.wasm + web/alphabeta.data
set -e
SRC="uci.c evaluate.c pvtable.c init.c bitboards.c hashkeys.c board.c data.c attack.c io.c movegen.c validate.c makemove.c perft.c search.c misc.c polybook.c polykeys.c xboard.c wasm.c"
emcc $SRC -O3 -o web/alphabeta.js \
  -sMODULARIZE=1 -sEXPORT_NAME=createAlphaBeta -sENVIRONMENT=worker \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB \
  -sEXPORTED_FUNCTIONS=_engine_init,_engine_command,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=lengthBytesUTF8,stringToUTF8 \
  --preload-file performance.bin
