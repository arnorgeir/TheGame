// ===============
// LEVEL TWO STUFF
// ===============

"use strict";

// A generic contructor which accepts an arbitrary descriptor object
function LevelTwo(descr) {

    // Common inherited setup logic from Entity
    this.setup(descr);

    // Default sprite, if not otherwise specified
    this.sprite = this.sprite || g_sprites.mapTwo;

    this.readMapJSON();
};

LevelTwo.prototype = new Entity();

LevelTwo.prototype._tileWidth = 24;
LevelTwo.prototype._tileHeight = 24;
LevelTwo.prototype._mapWidth = 600;
LevelTwo.prototype._mapHeight = 600;

LevelTwo.prototype.walkTileLoc = [];

LevelTwo.prototype.update = function (du) {
    spatialManager.unregister(this);

    if (this._isDeadNow)
        return entityManager.KILL_ME_NOW;
    
    spatialManager.register(this);
   
};

LevelTwo.prototype.killMeNow = function () {
    return this._isDeadNow = true;
};

// More infinite JSON strings.
LevelTwo.prototype.readMapJSON = function () {
    var walkingPath = JSON.parse('{"data":[1, 2, 2, 2, 2, 2, 2, 3, 1, 2, 2, 2, 2, 2, 2, 2, 3, 1, 2, 2, 2, 2, 2, 2, 3, 9, 10, 10, 10, 10, 10, 10, 11, 9, 10, 10, 10, 10, 10, 10, 10, 11, 9, 10, 10, 10, 10, 10, 10, 11, 9, 10, 4, 18, 18, 5, 10, 11, 9, 10, 4, 5, 10, 4, 5, 10, 11, 9, 10, 4, 18, 18, 5, 10, 11, 9, 10, 12, 2, 2, 13, 10, 12, 13, 10, 11, 9, 10, 11, 9, 10, 12, 13, 10, 12, 2, 2, 13, 10, 11, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 9, 10, 11, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 9, 10, 4, 5, 10, 4, 18, 18, 5, 10, 11, 9, 10, 11, 9, 10, 4, 18, 18, 5, 10, 4, 5, 10, 11, 9, 10, 11, 9, 10, 12, 2, 2, 13, 10, 12, 13, 10, 12, 13, 10, 12, 2, 2, 13, 10, 11, 9, 10, 11, 9, 10, 11, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 9, 10, 11, 9, 10, 11, 9, 10, 4, 5, 10, 4, 5, 10, 4, 18, 5, 10, 4, 5, 10, 4, 5, 10, 11, 9, 10, 11, 9, 10, 12, 13, 10, 11, 9, 10, 12, 13, 10, 12, 2, 13, 10, 12, 13, 10, 11, 9, 10, 12, 13, 10, 11, 9, 10, 10, 10, 10, 11, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 9, 10, 10, 10, 10, 11, 9, 10, 4, 18, 18, 19, 17, 5, 10, 4, 18, 5, 10, 4, 18, 5, 10, 4, 19, 17, 18, 18, 5, 10, 11, 9, 10, 12, 2, 2, 2, 2, 13, 10, 11, 10, 10, 10, 10, 10, 9, 10, 12, 2, 2, 2, 2, 13, 10, 11, 9, 10, 10, 10, 10, 10, 10, 10, 10, 11, 10, 10, 10, 10, 10, 9, 10, 10, 10, 10, 10, 10, 10, 10, 11, 17, 18, 18, 18, 5, 10, 4, 5, 10, 12, 2, 2, 2, 2, 2, 13, 10, 4, 5, 10, 4, 18, 18, 18, 19, 2, 2, 2, 2, 13, 10, 11, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 9, 10, 12, 2, 2, 2, 2, 10, 10, 10, 10, 10, 10, 11, 17, 5, 10, 4, 5, 10, 4, 5, 10, 4, 19, 9, 10, 10, 10, 10, 10, 10, 18, 18, 18, 18, 5, 10, 12, 2, 13, 10, 12, 13, 10, 12, 13, 10, 12, 2, 13, 10, 4, 18, 18, 18, 18, 1, 2, 2, 2, 13, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 12, 2, 2, 2, 3, 9, 10, 10, 10, 10, 10, 4, 5, 10, 4, 18, 5, 10, 4, 18, 5, 10, 4, 5, 10, 10, 10, 10, 10, 11, 9, 10, 4, 18, 5, 10, 12, 13, 10, 12, 3, 9, 10, 11, 1, 13, 10, 12, 13, 10, 4, 18, 5, 10, 11, 9, 10, 11, 0, 9, 10, 10, 10, 10, 10, 11, 9, 10, 11, 9, 10, 10, 10, 10, 10, 11, 0, 9, 10, 11, 9, 10, 12, 2, 13, 10, 4, 18, 5, 10, 12, 13, 10, 12, 13, 10, 4, 18, 5, 10, 12, 2, 13, 10, 11, 9, 10, 10, 10, 10, 10, 11, 0, 9, 10, 10, 10, 10, 10, 10, 10, 11, 0, 9, 10, 10, 10, 10, 10, 11, 17, 18, 18, 18, 18, 18, 19, 0, 17, 18, 18, 18, 18, 18, 18, 18, 19, 0, 17, 18, 18, 18, 18, 18, 19]}');
    var collectables = JSON.parse('{"data":[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50, 49, 49, 49, 49, 49, 0, 0, 49, 49, 49, 49, 49, 49, 49, 0, 0, 49, 49, 49, 49, 49, 50, 0, 0, 49, 0, 0, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 0, 0, 49, 0, 0, 49, 0, 0, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 0, 0, 49, 0, 0, 49, 49, 49, 49, 49, 49, 49, 49, 49, 0, 0, 49, 0, 0, 49, 49, 49, 49, 49, 49, 49, 49, 49, 0, 0, 49, 0, 0, 49, 0, 0, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 49, 49, 49, 49, 0, 0, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 0, 0, 49, 49, 49, 49, 0, 0, 49, 0, 0, 0, 0, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0, 49, 0, 0, 0, 0, 0, 0, 49, 0, 0, 49, 0, 0, 0, 0, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0, 49, 0, 0, 0, 0, 0, 0, 49, 0, 0, 49, 49, 49, 49, 49, 49, 49, 49, 0, 0, 0, 0, 0, 0, 0, 49, 49, 49, 49, 49, 49, 49, 49, 0, 0, 0, 0, 0, 0, 49, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0, 49, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 49, 0, 0, 49, 49, 49, 49, 49, 49, 49, 49, 49, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 49, 0, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 49, 0, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 0, 0, 0, 0, 0, 0, 49, 49, 49, 49, 49, 0, 0, 49, 0, 0, 0, 49, 0, 0, 0, 49, 0, 0, 49, 49, 49, 49, 49, 0, 0, 49, 0, 0, 0, 49, 0, 0, 49, 0, 0, 0, 49, 0, 0, 0, 49, 0, 0, 49, 0, 0, 0, 49, 0, 0, 49, 0, 0, 0, 49, 49, 49, 49, 49, 0, 0, 49, 0, 0, 49, 49, 49, 49, 49, 0, 0, 0, 49, 0, 0, 49, 0, 0, 0, 49, 0, 0, 0, 49, 0, 0, 49, 0, 0, 49, 0, 0, 0, 49, 0, 0, 0, 49, 0, 0, 51, 49, 49, 49, 49, 0, 0, 0, 49, 49, 49, 49, 49, 49, 49, 0, 0, 0, 49, 49, 49, 49, 51, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}');
    var baddieSpawn = JSON.parse('{"data":[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 52, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 52, 52, 52, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}');
    
    for (var i = 0; i < walkingPath.data.length; i++) {
        if (walkingPath.data[i] === 10) {
            var left = false;
            var right = false;
            var down = false;
            var up = false;

            if (walkingPath.data[i-1] === 10)
                left = true;
            if (walkingPath.data[i+1] === 10)
                right = true;
            if (walkingPath.data[i+25] === 10)
                down = true;
            if (walkingPath.data[i-25] === 10)
                up = true;

            this.walkTileLoc.push({
                x: (i%25)*this._tileWidth, 
                y: Math.floor(i/25)*this._tileHeight,
                cx: ((i%25)*this._tileWidth)+this._tileWidth/2,
                cy: (Math.floor(i/25)*this._tileHeight)+this._tileHeight/2, 
                reset_x: (i%25)*this._tileWidth, 
                reset_y: Math.floor(i/25)*this._tileHeight,
                walkLeft: left,
                walkRight: right,
                walkDown: down,
                walkUp: up,
                n: i});
        }
    }

    for (var i = 0; i < collectables.data.length; i++) {
        if (collectables.data[i] === 49) {
            // Add coin
            entityManager.generateCollectables({
                cx : (i%25)*this._tileWidth+this._tileWidth/2,
                cy : Math.floor(i/25)*this._tileHeight+this._tileHeight/2,
                sprite : g_sprites.coinTwo,
                isCoin : true,
                level : 2
            });
        }
        if (collectables.data[i] === 50) {
            // Add extra life
            entityManager.generateCollectables({
                cx : (i%25)*this._tileWidth+this._tileWidth/2,
                cy : Math.floor(i/25)*this._tileHeight + this._tileHeight/2,
                sprite : g_sprites.extraLifeTwo,
                isExtraLife : true,
                level : 2
            });
        }
        if (collectables.data[i] === 51) {
            // Add extra speed
            entityManager.generateCollectables({
                cx : (i%25)*this._tileWidth+this._tileWidth/2,
                cy : Math.floor(i/25)*this._tileHeight + this._tileHeight/2,
                sprite : g_sprites.extraSpeed,
                isExtraSpeed : true,
                level : 2
            });
        }
    }

    for (var i = 0; i < baddieSpawn.data.length; i++) {
        if (baddieSpawn.data[i] === 52) {
            entityManager.generateBaddieTwo({
                cx : (i%25)*this._tileWidth+this._tileWidth/2,
                cy : Math.floor(i/25)*this._tileHeight+this._tileHeight/2
            });
        }
    }
};

LevelTwo.prototype.render = function (ctx) {
    this.sprite.drawAt(ctx, 0, 0);

    if (g_renderSpatialDebug) {
        for (var i = 0; i < this.walkTileLoc.length; i++) {
            util.fillBox(ctx, this.walkTileLoc[i].x, this.walkTileLoc[i].y, this._tileWidth, this._tileHeight, "red");
            ctx.beginPath();
            if (this.walkTileLoc[i].walkLeft) {
                ctx.moveTo(this.walkTileLoc[i].x + this._tileWidth/2, this.walkTileLoc[i].y + this._tileHeight/2);
                ctx.lineTo(this.walkTileLoc[i].x, this.walkTileLoc[i].y + this._tileHeight/2);
            }
            if (this.walkTileLoc[i].walkRight) {
                ctx.moveTo(this.walkTileLoc[i].x + this._tileWidth/2, this.walkTileLoc[i].y + this._tileHeight/2);
                ctx.lineTo(this.walkTileLoc[i].x + this._tileWidth, this.walkTileLoc[i].y + this._tileHeight/2);
            }
            if (this.walkTileLoc[i].walkDown) {
                ctx.moveTo(this.walkTileLoc[i].x + this._tileWidth/2, this.walkTileLoc[i].y + this._tileHeight/2);
                ctx.lineTo(this.walkTileLoc[i].x + this._tileWidth/2, this.walkTileLoc[i].y + this._tileHeight);
            }
            if (this.walkTileLoc[i].walkUp) {
                ctx.moveTo(this.walkTileLoc[i].x + this._tileWidth/2, this.walkTileLoc[i].y + this._tileHeight/2);
                ctx.lineTo(this.walkTileLoc[i].x + this._tileWidth/2, this.walkTileLoc[i].y);
            }
            ctx.stroke();   
        }   
    }
};