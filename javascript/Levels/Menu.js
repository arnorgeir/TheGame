// ============
// MENU STUFF
// ============

function Menu(descr) {
    // Common inherited setup logic from Entity
    this.setup(descr);

    this.cx = g_canvas_halfWidth;

    this.scale = this.scale || 1;
};

Menu.prototype = new Entity();

Menu.prototype.KEY_PLAY   = ' '.charCodeAt(0);

Menu.prototype.velY = 3.0;

Menu.prototype.minY = g_canvas_halfHeight*0.8;
Menu.prototype.maxY = g_canvas_halfHeight;
    
Menu.prototype.update = function (du) {
    if (this._isDeadNow || gameFlowManager.getStatus() != 'menu') 
        return menuManager.KILL_ME_NOW;

    // Fancy sine wave!
    this.floatText();

    // Enter Game
    this.navigateMenu();
};

var start = 0;

Menu.prototype.floatText = function () {
    this.cy = 50 * Math.sin( start ) + g_canvas_halfHeight;
    start += 0.1;
};

Menu.prototype.navigateMenu = function () {
	if (eatKey(this.KEY_PLAY)) {
		this._isDeadNow = true;
	}
};

Menu.prototype.render = function (ctx) {
    ctx.font = "30px Bold Calibri";
    ctx.textAlign = "center";
    ctx.fillText("PRESS 'SPACE' TO PLAY", this.cx, this.cy);
    ctx.font = "15px Calibri";
    ctx.fillText("After reading the stuff here below!", this.cx, g_canvas_halfHeight*1.5);
};