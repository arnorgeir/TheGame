// ==========
// DUDE STUFF
// ==========

// A generic contructor which accepts an arbitrary descriptor object
function DudeOne(descr) {
   // Common inherited setup logic from Entity
   this.setup(descr);

   this.cx = this.cellWidth;
   this.cy = g_canvas.height/1.5;

   this.rememberResets();
   this.rememberDeathPos();

   // Default sprite, if not otherwise specified
   this.sprite = this.sprite || g_sprites.dudeOne;

   this.frame = this._imageMap[this.cellNum];

   this.score = entityManager.score;
   this.lives = entityManager.lives;
};

DudeOne.prototype = new Entity();

DudeOne.prototype.rememberResets = function () {
   // Remember my reset position
   this.reset_cx = this.cx;
   this.reset_cy = this.cy;
};

DudeOne.prototype.rememberDeathPos = function () {
   // Remember my death position
   this.death_cx = this.cx;
   this.death_cy = this.cy;
};

DudeOne.prototype.isDude = true;

DudeOne.prototype.KEY_LEFT   = 'A'.charCodeAt(0);
DudeOne.prototype.KEY_RIGHT  = 'D'.charCodeAt(0);
DudeOne.prototype.KEY_JUMP  = keyCode(' ');
DudeOne.prototype.KEY_SKIP = keyCode('L');

// Initial, inheritable, default values
DudeOne.prototype.velX = 0;
DudeOne.prototype.velY = 0;

DudeOne.prototype._canvasMiddle = g_canvas.width/2;

DudeOne.prototype._isJumping = false;
DudeOne.prototype._moveMap = false;
DudeOne.prototype._deathJump = false;
DudeOne.prototype._isDying = false;

DudeOne.prototype.numSubSteps = 1;
DudeOne.prototype.cellWidth = 24;
DudeOne.prototype.cellHeight = 46;
DudeOne.prototype.numCels = 5;
DudeOne.prototype.cellNum = 0;

DudeOne.prototype.flipCounter = 0;
DudeOne.prototype.flipThresh = 200 / SECS_TO_NOMINALS;

DudeOne.prototype.liveX = 0;
DudeOne.prototype.liveY = 24;

DudeOne.prototype.scoreX = g_canvas.width-24;
DudeOne.prototype.scoreY = 60;

DudeOne.prototype._imageMap = [
   // Right
   {x: 0, y: 2},       // 0    Standing to the right
   {x: 24, y: 2},      // 1
   {x: 48, y: 2},      // 2
   {x: 72, y: 2},      // 3
   {x: 96, y: 2},      // 4    Jumping
   // Left
   {x: 0, y: 50},      // 5    Standing to the left
   {x: 24, y: 50},     // 6
   {x: 48, y: 50},     // 7
   {x: 72, y: 50},     // 8
   {x: 96, y: 50}      // 9    Jumping
];

var maxY;
var TOTAL_MOVE_DIST = 0;

DudeOne.prototype.update = function (du) {
   spatialManager.unregister(this);

   if (this._isDeadNow) {
      return entityManager.KILL_ME_NOW;
   }

   if (this.cy >= g_canvas.height) {
      this.argueDeath(du);
   }

   if (this.cx < g_canvas_halfWidth) {
      this._moveMap = false;
   }

   if (keys[this.KEY_SKIP] || this.cx >= 3000-this.cellWidth) {
      this.progressGame();
   }

   var steps = this.numSubSteps;
   var dStep = du / steps;
   for (var i = 0; i < steps; i++) {
      this.computeSubSteps(dStep);
   }

   // Handle collision with the DudeOne.
   var hitEntity = this.findHitEntity();
   if (hitEntity) {
      var canTakeHit = hitEntity.collideWithDude;
      if (canTakeHit && !this._isDying) {
         canTakeHit.call(hitEntity);

         if (hitEntity.isBaddie && !hitEntity._isDying) {
            this.doFunnyDeath();
         }
         if (hitEntity.isCoin) {
            this.score++;
         }
         if (hitEntity.isExtraLife) {
            this.lives++;
         }
      }
   }

   spatialManager.register(this);
};

DudeOne.prototype.doFunnyDeath = function () {
   if (!this._isDying) {
      this._deathJump = true;
      this._isDying = true;
   }
};

DudeOne.prototype.argueDeath = function (du) {
   if (this.lives > 1) {
      this._isDying = false;
      this.lives--;
      this.findASafePlace(du);
   }
   else {
      this.killMeNow();
      location.reload();
   }
};

/*
The function here below is the result of programming whilst on the toilet
and it resembles the purpose of the toilet trip perfectly.
It will be refactored!
*/
DudeOne.prototype.findASafePlace = function (du) {
   var prevX = this.cx;
   var deathX = this.death_cx;
   var newX = 0;
   var newY = 0;
   var startX = this.reset_cx;
   var startY = this.reset_cy;
   var checkpointOneX = 504;
   var checkpointOneY = 384;
   var checkpointTwoX = 1152;
   var checkpointTwoY = 456;
   var checkpointThreeX = 1752;
   var checkpointThreeY = 456;

   if (util.isBetween(deathX, start, checkpointOneX)) {
      newX = startX;
      newY = startY;
      prevX -= g_canvas_halfWidth-this.cellWidth;
   } else if (util.isBetween(deathX, checkpointOneX, checkpointTwoX)) {
      newX = checkpointOneX+this.cellWidth;
      newY = checkpointOneY;
   } else if (util.isBetween(deathX, checkpointTwoX, checkpointThreeX)) {
      newX = checkpointTwoX+this.cellWidth;
      newY = checkpointTwoY;
   } else if (deathX > checkpointThreeX) {
      newX = checkpointThreeX+this.cellWidth;
      newY = checkpointThreeY;
   }

   this.reset(newX, newY);

   if (this._moveMap) {
      this.translateMap(du, prevX);
   }
};

DudeOne.prototype.killMeNow = function () {
   this._isDeadNow = true;
};

DudeOne.prototype.computeSubSteps = function (du) {
   var thrust = this.computeThrustMag();
   var accelY = -thrust;
   var prevX = this.cx;

   this.velX = 3*du;

   accelY += this.computeGravity();

   this.applyJumpAccel(accelY, du);

   /*
   Prevent multi jumping.
   One may still experience irrational mega jumps!
   */
   if (this.cy < maxY-this.cellHeight/4 || this.cy > maxY) {
      this._isJumping = true;
   }
   else {
      this._isJumping = false;
   }

   this.moveDude(du, prevX);

   if (this._moveMap) {
      this.translateMap(du, prevX);
   }
};

var NOMINAL_GRAVITY = 0.30;

DudeOne.prototype.computeGravity = function () {
   return g_useGravity ? NOMINAL_GRAVITY : 0;
};

var NOMINAL_THRUST = NOMINAL_GRAVITY*25;

DudeOne.prototype.computeThrustMag = function () {
   var thrust = 0;

   if (eatKey(this.KEY_JUMP) && !this._isJumping || this._deathJump) {
      thrust += NOMINAL_THRUST;
      this.rememberDeathPos();
      this._deathJump = false;
   }

   return thrust;
};

DudeOne.prototype.applyJumpAccel = function (accelY, du) {
   // u = original velocity
   var oldVelY = this.velY;

   // v = u + at
   this.velY += accelY * du;

   // v_ave = (u + v) / 2
   var aveVelY = (oldVelY + this.velY) / 2;

   // Decide whether to use the average or not (average is best!)
   var intervalVelY = g_useAveVel ? aveVelY : this.velY;

   // s = s + v_ave * t
   var nextY = this.cy + intervalVelY * du;

   var minY = this.cellHeight / 2;
   maxY = g_canvas.height*2;

   /*
   Make dude collide with platforms.
   I know it's ugly!
   */
   for (var i = 0; i < entityManager._level[0].colTileLoc.length; i++) {
      if ((this.cx >= entityManager._level[0].colTileLoc[i].x &&
         this.cx < entityManager._level[0].colTileLoc[i].x+this.cellWidth) &&
         this.cy >= entityManager._level[0].colTileLoc[i].y-this.cellHeight) {
         maxY = entityManager._level[0].colTileLoc[i].y - this.cellHeight/2;
      }
      else if (this._isDying) {
         maxY = g_canvas.height*2;
      }
   }

   /*
   Ignore the bounce if the dude is already in
   the "border zone" (to avoid trapping him there)
   */
   if (this.cy > maxY) {
      // Do nothing.
   } else if (nextY >= maxY) {
      this.velY = oldVelY * -0.1;
      intervalVelY = this.velY;
   } else if (nextY < minY) {
      this.velY = oldVelY * -1.0;
      intervalVelY = this.velY;
   }

   // s = s + v_ave * t
   this.cy += intervalVelY * du;
};

DudeOne.prototype.moveDude = function (du, prevX) {
   var nextX = this.cx + this.velX;
   var nextNegX = this.cx - this.velX;

   switch (true) {
      case (keys[39]): // Go Right
         if (this.flipCounter >= this.flipThresh) {
            if (this.cellNum === 3 || this.cellNum >= 4) {
               this.cellNum = 1;
            } else {
               this.cellNum++;
            }
            this.frame = this._imageMap[this.cellNum];

            this.flipCounter = 0;
         }

         this.flipCounter += du;

         // Use jumping sprite even if moving.
         if (this._isJumping) {
            this.cellNum = 4;
            this.frame = this._imageMap[this.cellNum];
         }

         // Start translating the whole mess when Dude reaches middle until he gets to the end.
         if (nextX > g_canvas_halfWidth && this.cx < 2700 && this.cx < g_canvas_halfWidth) {
            this._moveMap = true;
         }

         // Fix the map at the end and only move Dude.
         if (nextX >= 2700 && this._moveMap) {
            this.cx += this._canvasMiddle - this.cx;
            this._moveMap = false;
         }

         // Make velX positive for correct incrementation of this._canvasMiddle.
         this.velX = Math.abs(this.velX);
         this.cx += this.velX;
      break;
      case (keys[37]): // Go Left
         if (this.flipCounter >= this.flipThresh) {
            if (this.cellNum <= 5 || this.cellNum >= 8) {
               this.cellNum = 6;
            }
            else{
               this.cellNum++;

               this.frame = this._imageMap[this.cellNum];

               this.flipCounter = 0;
            }
         }

         this.flipCounter += du;

         // Use jumping sprite even if moving.
         if (this._isJumping) {
            this.cellNum = 9;
            this.frame = this._imageMap[this.cellNum];
         }

         // Keep the Dude on the canvas.
         if (nextNegX <= this.cellWidth/2 && !this._moveMap){
            return;
         }

         // Fix the map at the beginning and only move Dude.
         if (nextNegX <= g_canvas_halfWidth && this._moveMap) {
            this.cx -= this.cx - g_canvas_halfWidth;
            this.translateMap(du, prevX);
            this._moveMap = false;
         }

         // Make velX negative for correct decrementation of this._canvasMiddle.
         this.velX = -this.velX;
         this.cx += this.velX;
      break;
      case (this._isJumping):
         if (this.cellNum < this.numCels) {
            this.cellNum = 4;
         }
         else {
            this.cellNum = 9;
         }

         this.frame = this._imageMap[this.cellNum];
      break;
      default:
         if (this.cellNum < this.numCels){
            this.cellNum = 0;     // Standandi to the left.
         }
         else {
            this.cellNum = 5;     // Standing to the right.
         }

         this.frame = this._imageMap[this.cellNum];
      break;
   }
};

DudeOne.prototype.translateMap = function (du, prevX) {
   var move = this.velX;
   var moveDist = this.cx - prevX;
   TOTAL_MOVE_DIST += moveDist;

   this.liveX += moveDist;
   this.scoreX += moveDist;

   if (Math.abs(moveDist) > 0) {
      g_ctx.translate(-moveDist, 0);
      this._canvasMiddle += move;
   }
};

DudeOne.prototype.progressGame = function () {
   entityManager.lives = this.lives;
   entityManager.score = this.score;

   g_ctx.translate(TOTAL_MOVE_DIST, 0);
   TOTAL_MOVE_DIST = 0;
   entityManager.flush();
};

DudeOne.prototype.getRadius = function () {
   return this.cellWidth * 0.5;
};

DudeOne.prototype.reset = function (cx, cy) {
   this.setPos(cx, cy);
};

DudeOne.prototype.render = function (ctx) {
   this.sprite.drawFrameAt(
      ctx,
      this.cx - this.cellWidth/2,
      this.cy - this.cellHeight/2,
      this.cellWidth,
      this.cellHeight,
      this.frame
   );

   for (var i = 1; i <= this.lives; i++) {
      this.sprite.drawFrameAt(
         ctx,
         this.liveX+24*i,
         this.liveY,
         this.cellWidth,
         this.cellHeight,
         this.frame
      );
   }

   ctx.font = "48px Bold Calibri";
   var oldStyle = ctx.fillStyle;
   ctx.fillStyle = "rgba(252, 136, 0, 1)";
   ctx.textAlign = "right";
   ctx.fillText(this.score, this.scoreX, this.scoreY);
   ctx.strokeText(this.score, this.scoreX, this.scoreY);
   ctx.fillStyle = oldStyle;
};
