// wasm.c
// WebAssembly entry point. Replaces the blocking stdin loop in main.c with
// exported functions that a Web Worker calls one UCI command at a time.
// Engine output (info / bestmove lines) still goes through printf, which
// Emscripten routes to Module.print in the worker.

#include <stdio.h>
#include <string.h>
#include <emscripten.h>
#include "defs.h"

#define WASM_INPUT 2400

extern void ParseGo(char *line, S_SEARCHINFO *info, S_BOARD *pos);
extern void ParsePosition(char *lineIn, S_BOARD *pos);

static S_BOARD pos[1];
static S_SEARCHINFO info[1];

EMSCRIPTEN_KEEPALIVE
void engine_init(int hashMb) {
	AllInit();
	pos->HashTable->pTable = NULL;
	InitHashTable(pos->HashTable, hashMb);
	info->quit = FALSE;
	info->GAME_MODE = UCIMODE;
	info->POST_THINKING = TRUE;
	ParseFen(START_FEN, pos);
	printf("readyok\n");
}

EMSCRIPTEN_KEEPALIVE
void engine_command(const char *cmd) {
	char line[WASM_INPUT];
	memset(line, 0, sizeof(line));
	strncpy(line, cmd, WASM_INPUT - 2);

	if (!strncmp(line, "isready", 7)) {
		printf("readyok\n");
	} else if (!strncmp(line, "ucinewgame", 10)) {
		ClearHashTable(pos->HashTable);
		ParsePosition("position startpos\n", pos);
	} else if (!strncmp(line, "position", 8)) {
		ParsePosition(line, pos);
	} else if (!strncmp(line, "go", 2)) {
		ParseGo(line, info, pos);
	} else if (!strncmp(line, "setoption name Book value ", 26)) {
		EngineOptions->UseBook = strstr(line, "true") != NULL ? TRUE : FALSE;
	}
	fflush(stdout);
}
