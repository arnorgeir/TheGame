// =======
// GLOBALS
// =======
/*
Evil, ugly (but "necessary") globals, which everyone can use.
*/

"use strict";

var g_canvas = document.getElementById("myCanvas");
var g_ctx = g_canvas.getContext("2d");

var g_canvas_halfWidth = g_canvas.width/2;
var g_canvas_halfHeight = g_canvas.height/2;

var g_canvasL = document.getElementById("myLevel");
var g_ctxL = g_canvasL.getContext("2d");

// The "nominal interval" is the one that all time-based units are
// calibrated to e.g. a velocity unit is "pixels per nominal interval"
//
var NOMINAL_UPDATE_INTERVAL = 16.666;

// Multiply by this to convert seconds into "nominals"
var SECS_TO_NOMINALS = 1000 / NOMINAL_UPDATE_INTERVAL;
