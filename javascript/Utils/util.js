// A module of utility functions, with no private elements to hide.

"use strict";


var util = {


// RANGES
// ======

clampRange: function(value, lowBound, highBound) {
    if (value < lowBound) {
	value = lowBound;
    } else if (value > highBound) {
	value = highBound;
    }
    return value;
},

wrapRange: function(value, lowBound, highBound) {
    while (value < lowBound) {
	value += (highBound - lowBound);
    }
    while (value > highBound) {
	value -= (highBound - lowBound);
    }
    return value;
},

isBetween: function(value, lowBound, highBound) {
    if (value < lowBound) { return false; }
    if (value > highBound) { return false; }
    return true;
},


// RANDOMNESS
// ==========

randRange: function(min, max) {
    return (min + Math.random() * (max - min));
},


// MISC
// ====

square: function(x) {
    return x*x;
},


// DISTANCES
// =========

distSq: function(x1, y1, x2, y2) {
    return this.square(x2-x1) + this.square(y2-y1);
},

wrappedDistSq: function(x1, y1, x2, y2, xWrap, yWrap) {
    var dx = Math.abs(x2-x1),
	dy = Math.abs(y2-y1);
    if (dx > xWrap/2) {
	dx = xWrap - dx;
    };
    if (dy > yWrap/2) {
	dy = yWrap - dy;
    }
    return this.square(dx) + this.square(dy);
},

// ANGLE
// =====

angle: function(x1, y1, x2, y2) {
    var deltaY = y2-y1;
    var deltaX = x2-x1;

    return Math.atan(deltaY/deltaX) * (180/Math.PI);
},


// CANVAS OPS
// ==========

clearCanvas: function (ctx) {
    var prevfillStyle = ctx.fillStyle;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = prevfillStyle;
},

strokeCircle: function (ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
},

fillCircle: function (ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
},

fillBox: function (ctx, x, y, w, h, style) {
    var oldStyle = ctx.fillStyle;
    ctx.fillStyle = style;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = oldStyle;
},

strokeRect: function (ctx, x, y, w, h, style) {
    var oldStyle = ctx.strokeStyle;
    ctx.strokeStyle = style;
    ctx.rect(x, y, w, h);
    ctx.stroke();
    ctx.strokeStyle = oldStyle;
},

drawLine: function (ctx, x1, y1, x2, y2, color1, color2) {
    var oldStyle = ctx.strokeStyle;
    var grd = ctx.createLinearGradient(0, 0, 170, 0);
    grd.addColorStop(0, color1);
    grd.addColorStop(1, color2);
    var oldWidth = ctx.lineWidth;
    ctx.strokeStyle = grd;
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.moveTo(x1, y1+ctx.lineWidth/2);
    ctx.lineTo(x2, y2+ctx.lineWidth/2);
    ctx.stroke();
    ctx.lineWidth = oldWidth;
    ctx.strokeStyle = oldStyle;
}

};
