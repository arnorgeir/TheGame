// ================
// BADDIE ONE STUFF
// ================

// A generic contructor which accepts an arbitrary descriptor object
function BaddieOne(descr) {
   // Common inherited setup logic from Entity
   this.setup(descr);

   this.rememberResets();

   // Default sprite, if not otherwise specified
   this.sprite = this.sprite || g_sprites.baddieOne;

   this.frame = this._imageMapBaddie[this.cellNum];
};

BaddieOne.prototype = new Entity();

BaddieOne.prototype.rememberResets = function () {
   // Remember my reset positions
   this.reset_cx = this.cx;
   this.reset_cy = this.cy;
};

// Initial, inheritable, default values
BaddieOne.prototype.velX = 0;
BaddieOne.prototype.velY = 0;

BaddieOne.prototype.numSubSteps = 1;
BaddieOne.prototype.cellWidth = 24;
BaddieOne.prototype.cellHeight = 24;
BaddieOne.prototype.numCels = 2;
BaddieOne.prototype.cellNum = 0;

BaddieOne.prototype.isBaddie = true;
BaddieOne.prototype._doThrust = false;
BaddieOne.prototype._isDying = false;

BaddieOne.prototype.flipCounter = 0;
BaddieOne.prototype.flipThresh = 500 / SECS_TO_NOMINALS;

BaddieOne.prototype._imageMapBaddie = [
   {x: 0, y: 0},       // 0
   {x: 24, y: 0}      // 1
];

BaddieOne.prototype.update = function (du) {
   spatialManager.unregister(this);

   if (this._isDeadNow) {
      return entityManager.KILL_ME_NOW;
   }

   var steps = this.numSubSteps;
   var dStep = du / steps;
   for (var i = 0; i < steps; i++) {
      this.computeSubSteps(dStep);
   }

   // Follow the player if he comes to close.
   var target = this.findPlayer();
   if (target && target.isDude && !this._isDying) {
      this.followPlayer(du, target);
   }

   this.flipCounter += du;
   if (this.flipCounter >= this.flipThresh) {
      this.animate();
      this.flipCounter = 0;
   }

   this.cx += this.velX * du;

   spatialManager.register(this);
};

BaddieOne.prototype.followPlayer = function (du, target) {
   if (!this._isDying) {
   if (this.cx < target.cx)
      this.velX = 0.5 * du;
   else
      this.velX = 0.5 * -du;
   }
   else {
      this.velX = 0;
   }
};

BaddieOne.prototype.animate = function () {
   this.frame = this._imageMapBaddie[this.cellNum];

   this.cellNum++;

   if (this.cellNum === this._imageMapBaddie.length)
      this.cellNum = 0;
};

BaddieOne.prototype.collideWithDude = function () {
   // Nothing to see here, move along!
   if (!this._isDying) {
      var dudeCX = entityManager._dude[0].cx;
      var dudeCY = entityManager._dude[0].cy;
      var angle = Math.abs(util.angle(this.cx, this.cy, dudeCX, dudeCY));

      //console.log(angle);

      if (angle > 50) {
         this._doThrust = true;
         this._isDying = true;
      }
   }
};

BaddieOne.prototype.killMeNow = function () {
   this._isDeadNow = true;
};

BaddieOne.prototype.computeSubSteps = function (du) {
   var thrust = this.computeThrustMag();
   var accelY = -thrust;
   var prevX = this.cx;

   // This enables the player to trick the baddies to suicide.
   this.velX = this.velX;
   accelY += this.computeGravity();
   this.applyJumpAccel(accelY, du);
};

BaddieOne.prototype.computeGravity = function () {
    return g_useGravity ? NOMINAL_GRAVITY : 0;
};

BaddieOne.prototype.computeThrustMag = function () {
   var thrust = 0;

   if (this._doThrust) {
      thrust += NOMINAL_THRUST*0.75;
   }

   this._doThrust = false;

   return thrust;
};

BaddieOne.prototype.applyJumpAccel = function (accelY, du) {
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
   var maxY = g_canvas.height*2;

   // Make dude collide with platforms.
   // I know it's ugly!
   for (var i = 0; i < entityManager._level[0].colTileLoc.length; i++) {
      if ((this.cx >= entityManager._level[0].colTileLoc[i].x &&
         this.cx < entityManager._level[0].colTileLoc[i].x+this.cellWidth) &&
         this.cy >= entityManager._level[0].colTileLoc[i].y-this.cellHeight) {
         maxY = entityManager._level[0].colTileLoc[i].y - this.cellHeight/2;
      }
      else if (this._isDying) {
         maxY = g_canvas.height;
      }
   }

   // Ignore the bounce if the dude is already in
   // the "border zone" (to avoid trapping him there)
   if (this.cy > maxY) {
      // Do nothing
   } else if (nextY >= maxY) {
      if (this._isDying) {
         this.killMeNow();
      }
      else {
         this.velY = oldVelY * -0.1;
         intervalVelY = this.velY;
      }
   } else if (nextY < minY) {
      this.velY = oldVelY * -1.0;
      intervalVelY = this.velY;
   };

   // s = s + v_ave * t
   this.cy += intervalVelY * du;
};

BaddieOne.prototype.getRadius = function () {
   return this.cellWidth * 0.4;
};

BaddieOne.prototype.getVision = function () {
   return this.cellWidth * 2.5;
}

BaddieOne.prototype.reset = function () {
   this.setPos(this.reset_cx, this.reset_cy);
};

BaddieOne.prototype.render = function (ctx) {
   this.sprite.drawFrameAt(
      ctx,
      this.cx - this.cellWidth/2,
      this.cy - this.cellHeight/2,
      this.cellWidth,
      this.cellHeight,
      this.frame
   );

   // draw line from baddie to dude
   if (g_renderSpatialDebug) {
      ctx.strokeStyle = "red";
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(entityManager._dude[0].cx, entityManager._dude[0].cy);
      ctx.stroke();
   }
};
