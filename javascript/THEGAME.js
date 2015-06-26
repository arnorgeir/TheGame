// ========
// THE GAME
// ========
/*

"use strict";

/* jshint browser: true, devel: true, globalstrict: true */

var g_canvas = document.getElementById("myCanvas");
var g_ctx = g_canvas.getContext("2d");

// =================
// UPDATE SIMULATION
// =================

// The primary `update` routine handles generic stuff such as
// pausing, single-step, and time-handling.
//
// It then delegates the game-specific logic to `updateSimulation`


// GAME-SPECIFIC UPDATE LOGIC
function updateSimulation(du) {
   processDiagnostics();

   gameFlowManager.update();

   if (gameFlowManager.getStatus() === 'menu') {
      menuManager.update(du);
   }
   else if (gameFlowManager.getStatus() === 'levelOne' ||
      gameFlowManager.getStatus() === 'levelTwo')
      entityManager.update(du);
}

// GAME-SPECIFIC DIAGNOSTICS
var g_allowMixedActions = true;
var g_useGravity = true;
var g_useAveVel = true;
var g_renderSpatialDebug = false;

var KEY_SPATIAL = keyCode('S');

function processDiagnostics() {
   g_allowMixedActions = !g_allowMixedActions;

   if (eatKey(KEY_SPATIAL)) g_renderSpatialDebug = !g_renderSpatialDebug;
}

// =================
// RENDER SIMULATION
// =================

// GAME-SPECIFIC RENDERING

function renderSimulation(ctx) {
   if (gameFlowManager.getStatus() === 'menu')
      menuManager.render(ctx);
   else if (gameFlowManager.getStatus() === 'levelOne')
      entityManager.render(ctx);
   else if (gameFlowManager.getStatus() === 'levelTwo')
      entityManager.render(ctx);

   if (g_renderSpatialDebug) spatialManager.render(ctx);
}

// =============
// PRELOAD STUFF
// =============

var g_images = {};

function requestPreloads() {
   var requiredImages = {
      sky         : "images/sky.png",
      mapOne      : "images/mapOne.png",
      mapTwo      : "images/mapTwo.png",
      dudeOne     : "images/hero.png",
      dudeTwo     : "images/heroTwo.png",
      coin        : "images/coin.png",
      coinTwo     : "images/coinTwo.png",
      extraLife   : "images/extraLife.png",
      extraLifeTwo   : "images/extraLifeTwo.png",
      extraSpeed   : "images/extraSpeed.png",
      baddieOne   : "images/baddieOne.png",
      baddieTwo   : "images/baddieTwo.png"
   };

   imagesPreload(requiredImages, g_images, preloadDone);
}

var g_sprites = {};

function preloadDone() {
   g_sprites.sky = new Sprite(g_images.sky);
   g_sprites.mapOne = new Sprite(g_images.mapOne);
   g_sprites.mapTwo = new Sprite(g_images.mapTwo);
   g_sprites.dudeOne = new Sprite(g_images.dudeOne);
   g_sprites.dudeTwo = new Sprite(g_images.dudeTwo);
   g_sprites.coin = new Sprite(g_images.coin);
   g_sprites.coinTwo = new Sprite(g_images.coinTwo);
   g_sprites.extraLife = new Sprite(g_images.extraLife);
   g_sprites.extraLifeTwo = new Sprite(g_images.extraLifeTwo);
   g_sprites.extraSpeed = new Sprite(g_images.extraSpeed);
   g_sprites.baddieOne = new Sprite(g_images.baddieOne);
   g_sprites.baddieTwo = new Sprite(g_images.baddieTwo);

   main.init();

   gameFlowManager.init();
}

// Kick it off
requestPreloads();
