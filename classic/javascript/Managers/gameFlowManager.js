// ================
// GAMEFLOW MANAGER
// ================

var gameFlowManager = {
	states : [],

	init: function () {
		states = [
			{
				'name'		: 'menu',
				'initial' 	: true,
				'events'	: { 'progress' : 'levelOne' }
			},
			{
				'name'		: 'levelOne',
				'events'	: { 'progress' : 'levelTwo' }
			},
			{
				'name' 		: 'levelTwo',
				'events' 	: { 'progress' : 'menu' }
			}
		]

		// Let's get this party goin!
		menuManager.init();
	},

	update: function () {
		this.updateStates(states);
	},

	updateStates: function (states) {
		this.states = states;
		this.indexes = [];

		// Am I initial? If so then make me active!
		for( var i = 0; i < this.states.length; i++) {
			this.indexes[this.states[i].name] = i;
			if (this.states[i].initial) {
				this.currentState = this.states[i];
			}
		}

		this.consumeEvent = function (event) {
			console.log("From: " + this.getStatus());

			// Falsify the state's initial property when consumed...
			// ...to avoid problems when updating the states.
			if (this.currentState.events[event]) {
				if (this.currentState.initial) {
					this.currentState.initial = false;
				}

				this.currentState = this.states[
				this.indexes[this.currentState.events[event]]];
			}

			if (this.getStatus() === 'menu') {
				menuManager.init();
			} else if (this.getStatus() === 'levelOne') {
				entityManager.initLevelOne();
			} else if (this.getStatus() === 'levelTwo') {
				entityManager.initLevelTwo();
			}

			console.log("To: " + this.getStatus());
		}

		this.getStatus = function () {
			return this.currentState.name;
		}
	}
}
