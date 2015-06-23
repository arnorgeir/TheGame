/*
A module which handles spatial lookup, as required for general collision detection.
*/

"use strict";

var spatialManager = {

// "PRIVATE" DATA

_nextSpatialID : 1,

_entities : [],

// PUBLIC METHODS

getNewSpatialID : function() {
    return this._nextSpatialID++;

},

register: function(entity) {
    var pos = entity.getPos();
    var spatialID = entity.getSpatialID();
    
    this._entities[spatialID] = entity;
},

unregister: function(entity) {
    var spatialID = entity.getSpatialID();

    delete this._entities[spatialID];
},

findEntityInRange: function(posX, posY, radius) {
    for (var ID in this._entities) {
        var e = this._entities[ID];
        var pos = e.getPos();

        var distSq = util.distSq(pos.posX, pos.posY, posX, posY);


        var rad = e.getRadius() + radius;
        var radSq = rad*rad;

        if(distSq < radSq)
            return e;
    }
},

render: function(ctx) {
    var oldStyle = ctx.strokeStyle;
    ctx.strokeStyle = "white";
    
    // Render entity collision border
    for (var ID in this._entities) {
        var e = this._entities[ID];
        var pos = e.getPos();
        
        util.strokeCircle(ctx, pos.posX, pos.posY, e.getRadius());
    }

    // Render entity vision
    ctx.strokeStyle = "blue";
    for (var ID in this._entities) {
        var e = this._entities[ID];
        var pos = e.getPos();
        util.strokeCircle(ctx, pos.posX, pos.posY, e.getVision());
    }

    ctx.strokeStyle = oldStyle;
}

}
