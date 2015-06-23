// =================
// KEYBOARD HANDLING
// =================

var keys = [];

function handleKeydown(evt) {
    keys[evt.keyCode] = true;
}

function handleKeyup(evt) {
    keys[evt.keyCode] = false;
}

function preventPageScroll(evt) {
	switch (true)  {
		case(keys[32] || keys[37] || keys[38] || keys[39] || keys[40]):
			var key = evt.keyCode;
		break;
	}

  	return !(evt.keyCode === key);
}

/*
    This allows a keypress to be "one-shot" e.g. for toggles
    ..until the auto-repeat kicks in, that is.
*/
function eatKey(keyCode) {
    var isDown = keys[keyCode];
    keys[keyCode] = false;
    return isDown;
}

// A tiny little convenience function
function keyCode(keyChar) {
    return keyChar.charCodeAt(0);
}

window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);

// Prevent page down when the spacebar or arrow keys are pressed!
window.onkeydown = preventPageScroll;
