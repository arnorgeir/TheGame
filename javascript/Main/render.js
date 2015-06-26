// GENERIC RENDERING

var g_doClear = true;
var g_doRender = true;

var g_frameCounter = 1;

var TOGGLE_CLEAR = 'C'.charCodeAt(0);
var TOGGLE_RENDER = 'R'.charCodeAt(0);

function render(ctx) {
   if (g_doClear) util.clearCanvas(ctx);

   // The core rendering of the actual game / simulation
   if (g_doRender) renderSimulation(ctx);

   ++g_frameCounter;
}
