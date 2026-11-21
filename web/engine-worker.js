// Runs the C engine (compiled to WebAssembly) off the main thread.
// Main thread posts UCI command strings; engine output lines are posted back.
let ready = false;
const queue = [];
let engine;

importScripts('alphabeta.js');

createAlphaBeta({
  print: (line) => postMessage({ type: 'line', line }),
  printErr: () => {},
  locateFile: (p) => p,
}).then((mod) => {
  engine = mod;
  engine._engine_init(32);
  ready = true;
  postMessage({ type: 'ready' });
  while (queue.length) run(queue.shift());
});

function run(cmd) {
  const len = engine.lengthBytesUTF8(cmd) + 1;
  const ptr = engine._malloc(len);
  engine.stringToUTF8(cmd, ptr, len);
  engine._engine_command(ptr);
  engine._free(ptr);
}

onmessage = (e) => {
  if (ready) run(e.data);
  else queue.push(e.data);
};
