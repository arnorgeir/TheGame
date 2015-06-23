// ================
// BADDIE TWO STUFF
// ================

// A generic contructor which accepts an arbitrary descriptor object
function BaddieTwo(descr) {

    // Common inherited setup logic from Entity
    this.setup(descr);

    this.rememberResets();
    
    // Default sprite, if not otherwise specified
    this.sprite = this.sprite || g_sprites.baddieTwo;

    this.frame = this._imageMapBaddie[this.cellNum];
};

BaddieTwo.prototype = new Entity();

BaddieTwo.prototype.rememberResets = function () {
    // Remember my reset positions
    this.reset_cx = this.cx;
    this.reset_cy = this.cy;
};

// Initial, inheritable, default values
BaddieTwo.prototype.velX = 0;
BaddieTwo.prototype.velY = 0;

BaddieTwo.prototype._walkLeft = false;
BaddieTwo.prototype._walkUp = false;
BaddieTwo.prototype._walkRight = false;
BaddieTwo.prototype._walkDown = false;

BaddieTwo.prototype._nextFrame = 0;

BaddieTwo.prototype._randIndex = 0;
BaddieTwo.prototype._oldIndex = 0;
BaddieTwo.prototype._stackSize = 0;
BaddieTwo.prototype._prevFrameX = 0;
BaddieTwo.prototype._prevFrameY = 0;
BaddieTwo.prototype._nextFrameX = 0;
BaddieTwo.prototype._nextFrameY = 0;

BaddieTwo.prototype._prevDirections = [];
BaddieTwo.prototype._generatedPath = [];
BaddieTwo.prototype._canFindPath = true;

BaddieTwo.prototype._dirCounter = [0, 0, 0, 0];

BaddieTwo.prototype.cellWidth = 24;
BaddieTwo.prototype.cellHeight = 24;
BaddieTwo.prototype.numCels = 2;
BaddieTwo.prototype.cellNum = 0;

BaddieTwo.prototype.isBaddie = true;
BaddieTwo.prototype._doThrust = false;
BaddieTwo.prototype._isDying = false;

BaddieTwo.prototype.flipCounter = 0;
BaddieTwo.prototype.flipThresh = 500 / SECS_TO_NOMINALS;

BaddieTwo.prototype._imageMapBaddie = [
    {x: 0, y: 0},       // 0
    {x: 24, y: 0}      // 1
];

BaddieTwo.prototype.update = function (du) {
    spatialManager.unregister(this);

    if (this._isDeadNow)
        return entityManager.KILL_ME_NOW;

    if (this._canFindPath)
        this.findNextFrame();
    
    this.moveToNextFrame();

    this.flipCounter += du;
    if (this.flipCounter >= this.flipThresh) {
        this.animate();
        this.flipCounter = 0;   
    }

    spatialManager.register(this);
};

// Artificial anxiety brought on by constant decision making!
//
// Dat Recursion!
// Klára seinna!
BaddieTwo.prototype.generateRandomDirection = function (availableDirections) {
    /*
        Old 0 > 3,0,1
        Old 1 > 0,1,2
        Old 2 > 1,2,3
        Old 3 > 2,3,0
    */
    if (this._stackSize < 50)
        this._stackSize++;
    else {
        this._randIndex = -1;
        return this._randIndex;   
    }
    
    if (this._randIndex === -1) {
        // Do nothing!
    }
    else
        this._oldIndex = this._randIndex;
    
    //var dirCount = 0;
    
    console.log("stack" + this._stackSize)
    console.log("index" + this._randIndex)

    if (this._oldIndex === 0)
        availableDirections[2] = false;
    if (this._oldIndex === 1)
        availableDirections[3] = false;
    if (this._oldIndex === 2)
        availableDirections[0] = false;
    if (this._oldIndex === 3)
        availableDirections[1] = false;

  /*  console.log("newAv")
    console.log(availableDirections)

    for (var i = 0; i < availableDirections.length; i++) {
        if (availableDirections[i] === true)
            dirCount++;
    }

    // Only 2 possible directions? Just stay on course!
    for (var i = 0; i < availableDirections.length; i++) {
        if (availableDirections[i] === true) {
            // put genious stuff here!
            if (dirCount < 2) {
                return this._randIndex = availableDirections[i];
            }
        }
    }*/

    this._randIndex = Math.round(util.randRange(0, 3));

    if (availableDirections[this._randIndex] === true) {
        //this._prevDirections.push(this._randIndex);
        this._dirCounter[this._randIndex]++;
        console.log(this._dirCounter)
        return this._randIndex;
    }
    else
        this.generateRandomDirection(availableDirections);
};

BaddieTwo.prototype.findNextFrame = function () {
    var availableDirections = [];
    this._prevFrameX = this.cx;
    this._prevFrameY = this.cy;
    
    if (this._generatedPath.length > 0) {
        this._prevFrameX = this._nextFrameX;
        this._prevFrameY = this._nextFrameY;
    }

    for (var i = 0; i < entityManager._level[0].walkTileLoc.length; i++) {
        if (this._prevFrameX === entityManager._level[0].walkTileLoc[i].cx &&
            this._prevFrameY === entityManager._level[0].walkTileLoc[i].cy && 
            this._nextFrame === 0) {

            availableDirections.push(entityManager._level[0].walkTileLoc[i].walkLeft);
            availableDirections.push(entityManager._level[0].walkTileLoc[i].walkUp);
            availableDirections.push(entityManager._level[0].walkTileLoc[i].walkRight);
            availableDirections.push(entityManager._level[0].walkTileLoc[i].walkDown);
        }
    }

    this.generateRandomDirection(availableDirections);
    this._stackSize = 0;

    switch (this._randIndex) {
        case 0:
            this._nextFrameX = this._prevFrameX - this.cellWidth;
            this._nextFrameY = this._prevFrameY;
        break;
        case 1:
            this._nextFrameX = this._prevFrameX;
            this._nextFrameY = this._prevFrameY - this.cellHeight;
        break;
        case 2:
            this._nextFrameX = this._prevFrameX + this.cellWidth;
            this._nextFrameY = this._prevFrameY;
        break;
        case 3:
            this._nextFrameX = this._prevFrameX;
            this._nextFrameY = this._prevFrameY + this.cellHeight;
        break;
        case -1:
            console.log("hello ")
            this.findNextFrame();
        break;
    }

    this._generatedPath.push({
        randIndex: this._randIndex, 
        prevX: this._prevFrameX, 
        prevY: this._prevFrameY, 
        nextX: this._nextFrameX, 
        nextY: this._nextFrameY});

    //console.log(this._generatedPath)

    this._canFindPath = false;
};

BaddieTwo.prototype.moveToNextFrame = function () {
    this.velX = 3;
    this.velY = 3;

    switch (this._generatedPath[this._generatedPath.length-1].randIndex) {
        case 0:
            if (this.cx > this._generatedPath[this._generatedPath.length-1].nextX) {
                this.cx -= this.velX;
            }
            else
                this._canFindPath = true;
        break;
        case 1:
            if (this.cy > this._generatedPath[this._generatedPath.length-1].nextY) {
                this.cy -= this.velY;
            }
            else 
                this._canFindPath = true;
        break;
        case 2:
            if (this.cx < this._generatedPath[this._generatedPath.length-1].nextX) {
                this.cx += this.velX;
            }
            else
                this._canFindPath = true;
        break;
        case 3:
            if (this.cy < this._generatedPath[this._generatedPath.length-1].nextY) {
                this.cy += this.velY;
            }
            else
                this._canFindPath = true;
        break;
    }
    
    /*if (this.cx > this._generatedPath[this._generatedPath.length-1].nextX)
        this.cx -= this.velX;
    if (this.cx < this._generatedPath[this._generatedPath.length-1].nextX)
        this.cx += this.velX;
    if (this.cy > this._generatedPath[this._generatedPath.length-1].nextY)
        this.cy -= this.velY;
    if (this.cy < this._generatedPath[this._generatedPath.length-1].nextY)
        this.cy += this.velY;*/
    /*
    switch (true) {
        case (this._walkLeft):
            if (this.cx > this._nextFrame) {
                this.cx -= this.velX;
            }
            else {
                this._nextFrame = 0;
                this._walkLeft = false;
            }
        break;
        case (this._walkUp):
            if (this.cy > this._nextFrame) {
                this.cy -= this.velY;
            }
            else {
                this._nextFrame = 0;
                this._walkUp = false;
            }
        break;  
        case (this._walkRight):
            if (this.cx < this._nextFrame) {
                this.cx += this.velX;
            }
            else {
                this._nextFrame = 0;
                this._walkRight = false;
            }
        break;
        case (this._walkDown):
            if (this.cy < this._nextFrame) {
                this.cy += this.velY;
            }
            else {
                this._nextFrame = 0;
                this._walkDown = false;
            }
        break;
    }*/
};

BaddieTwo.prototype.animate = function () {
    this.frame = this._imageMapBaddie[this.cellNum];

    this.cellNum++;

    if (this.cellNum === this._imageMapBaddie.length)
        this.cellNum = 0;
};

BaddieTwo.prototype.collideWithDude = function () {
    // Nothing to see here, move along!
    return;
};

BaddieTwo.prototype.killMeNow = function () {
    this._isDeadNow = true;
};

BaddieTwo.prototype.getRadius = function () {
    return this.cellWidth * 0.4;
};

BaddieTwo.prototype.getVision = function () {
    return this.cellWidth * 2.5;
}

BaddieTwo.prototype.reset = function () {
    this.setPos(this.reset_cx, this.reset_cy);
};

BaddieTwo.prototype.render = function (ctx) {
    this.sprite.drawFrameAt(
    	ctx,
    	this.cx - this.cellWidth/2,
    	this.cy - this.cellHeight/2,
    	this.cellWidth,
    	this.cellHeight,
    	this.frame);

    // draw line from baddie to dude
    /*if (g_renderSpatialDebug) {
        ctx.strokeStyle = "red";
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(entityManager._dude[0].cx, entityManager._dude[0].cy)
        ctx.stroke();
    }*/

    if (g_renderSpatialDebug) {
        ctx.strokeStyle = "black";
        for (var i = 0; i < this._generatedPath.length; i++) {  
            ctx.moveTo(this._generatedPath[i].prevX, this._generatedPath[i].prevY);
            ctx.lineTo(this._generatedPath[i].nextX, this._generatedPath[i].nextY);
        }
        ctx.stroke();
    }
};
