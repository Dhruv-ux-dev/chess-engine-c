# AlphaBeta — Chess Engine in C

**Author: Dhruv Mittal** · **[Play it in your browser](https://dhruv-ux-dev.github.io/chess-engine-c/)**

AlphaBeta is a chess engine written in C. It speaks the UCI and XBoard protocols, so it plugs into standard chess GUIs (Arena, Cute Chess, BanksiaGUI), and it also compiles to WebAssembly so you can play it in the browser.

## Features

- **Board:** 120-square mailbox board with bitboards for pawns; Zobrist position hashing
- **Move generation:** fully legal moves, castling, en passant, promotion; perft-tested
- **Game state:** checkmate, stalemate, fifty-move, threefold repetition and insufficient-material detection
- **Search:** minimax with alpha-beta pruning, iterative deepening, quiescence search, null-move pruning
- **Move ordering:** principal-variation move, MVV-LVA captures, killer and history heuristics
- **Transposition table:** hash table of searched positions, configurable size
- **Evaluation:** material plus piece-square tables, pawn structure (passed and isolated pawns), open files
- **Opening book:** Polyglot `.bin` book support (`performance.bin`)
- **Protocols:** UCI, XBoard/WinBoard and an interactive console mode

## Build and run

```bash
make
./alphabeta
```

Then type `uci` (UCI mode), `xboard` (XBoard mode) or `console` (play in the terminal).
Run `./alphabeta NoBook` to disable the opening book.

## Play in the browser

The `web/` folder holds a browser UI. `wasm.c` exposes the engine to JavaScript, and the same C
source is compiled with Emscripten and runs in a Web Worker:

```bash
./build-web.sh          # needs Emscripten
python3 -m http.server -d web 8000
```

## License

MIT
