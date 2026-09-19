// ============
// MENU MANAGER
// ============

var menuManager = {
	// PRIVATE DATA

	_menu : [],

	// PUBLIC METHODS

	KILL_ME_NOW : -1,

	deferredSetup : function () {
		this._categories = [this._menu];
	},

	init : function () {
		this.generateMenu();
	},

	generateMenu : function (descr) {
		this._menu.push(new Menu(descr));
	},

	update: function(du) {
		for (var c = 0; c < this._categories.length; ++c) {
			var aCategory = this._categories[c];
			var i = 0;

			while (i < aCategory.length) {
				var status = aCategory[i].update(du);

				if (status === this.KILL_ME_NOW) {
					// Remove the dead guy, and shuffle the others down to
					// prevent a confusing gap from appearing in the array.
					aCategory.splice(i,1);

					gameFlowManager.consumeEvent('progress');
				} else {
					++i;
				}
			}
		}
	},

	render: function(ctx) {
		var debugX = 10, debugY = 100;

		for (var c = 0; c < this._categories.length; ++c) {
			var aCategory = this._categories[c];

			for (var i = 0; i < aCategory.length; ++i) {
				aCategory[i].render(ctx);
			}

			debugY += 10;
		}
	}
}

menuManager.deferredSetup();
