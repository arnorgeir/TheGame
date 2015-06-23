// Multi-Image Preloader

"use strict";

var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");

Image.prototype.asyncLoad = function(src, asyncCallback) {
    
    this.onload = asyncCallback;
    this.onerror = asyncCallback;
    
    console.log("requesting image src of ", src);
    this.src = src;
};

/*
    imagePreload

    Makes use of "closures" to handle the necessary state-tracking between the
    intermediate callback handlers without resorting to global variables.

    IN  : `requiredImages` - an object of <name:uri> pairs for each image
    OUT : `loadedImages` - object to which our <name:Image> pairs will be added
    IN  : `completionCallback` - will be executed when everything is done
*/
function imagesPreload(requiredImages,
                       loadedImages,
                       completionCallback) {

    var numImagesRequired,
        numImagesHandled = 0,
        currentName,
        currentImage,
        preloadHandler;

    numImagesRequired = Object.keys(requiredImages).length;

    /*
        A handler which will be called when required images are finally
        loaded (or when the fail to load).
    
        At the time of the call, `this` will point to an Image object, 
        whose `name` property will have been set.
    */
    preloadHandler = function () {

        console.log("preloadHandler called with this=", this);
        loadedImages[this.name] = this;

        if (0 === this.width) {
            console.log("loading failed for", this.name);
        }

        // Allow this handler closure to eventually be GC'd (!)
        this.onload = null;
        this.onerror = null;

        numImagesHandled += 1;

        if (numImagesHandled === numImagesRequired) {
            console.log("all preload images handled");
            console.log("loadedImages=", loadedImages);
            console.log("");
            console.log("performing completion callback");

            completionCallback();

            console.log("completion callback done");
            console.log("");
        }
    };

    for (currentName in requiredImages) {
        if (requiredImages.hasOwnProperty(currentName)) {

            console.log("preloading image", currentName);
            currentImage = new Image();
            currentImage.name = currentName;

            currentImage.asyncLoad(requiredImages[currentName], preloadHandler);
        }
    }
}
