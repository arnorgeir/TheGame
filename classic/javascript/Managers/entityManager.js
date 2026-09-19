/*
A module which handles arbitrary entity-management.
*/

"use strict";

var entityManager = {
   // "PRIVATE" DATA

   _level   : [],
   _dude    : [],
   _coins   : [],
   _baddies : [],

   // PUBLIC DATA

   moveMap : false,
   score : 0,
   lives : 3,

   // "PRIVATE" METHODS

   _forEachOf: function(aCategory, fn) {
      for (var i = 0; i < aCategory.length; ++i) {
         fn.call(aCategory[i]);
      }
   },

   // PUBLIC METHODS

   // A special return value, used by other objects,
   // to request the blessed release of death!
   KILL_ME_NOW : -1,

   // Some things must be deferred until after initial construction
   // i.e. thing which need `this` to be defined.
   deferredSetup : function () {
      this._categories = [this._level, this._coins, this._baddies, this._dude];
   },

   initLevelOne: function() {
      this.deferredSetup();

      this.generateLevelOne();
      this.generateDudeOne();
   },

   initLevelTwo : function () {
      this.deferredSetup();

      this.generateLevelTwo();
      this.generateDudeTwo();
   },

   generateLevelOne : function() {
      this._level.push(new LevelOne());
   },

   generateLevelTwo : function() {
      this._level.push(new LevelTwo());
   },

   generateDudeOne : function(descr) {
      this._dude.push(new DudeOne(descr));
   },

   generateDudeTwo : function(descr) {
      this._dude.push(new DudeTwo(descr));
   },

   generateCollectables : function(descr) {
      this._coins.push(new Collectables(descr));
   },

   generateBaddieOne : function(descr) {
      this._baddies.push(new BaddieOne(descr));
   },

   generateBaddieTwo : function (descr) {
      this._baddies.push(new BaddieTwo(descr));
   },

   flush: function() {
      // Remove all entities.
      for (var i = 0; i < this._categories.length; i++) {
         var aCategory = this._categories[i];
         for (var j = 0; j < aCategory.length; j++) {
            aCategory[j].killMeNow();
         }
      }

      // Clean the entity container.
      for (var i = 0; i < this._categories.length; i++) {
         this._categories.splice(i, this._categories.length);
      }

      // Ahoy matey!
      gameFlowManager.consumeEvent('progress');

      console.log(this._categories);
      console.log(spatialManager._entities);
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
            }
            else {
               ++i;
            }
         }
      }
   },

   render: function(ctx) {
      var debugX = 10, debugY = 100;

      for (var c = 0; c < this._categories.length; ++c) {
         var aCategory = this._categories[c];

         if (!this._bShowRocks && aCategory == this._rocks) {
            continue;
         }

         for (var i = 0; i < aCategory.length; ++i) {
            aCategory[i].render(ctx);
         }
         
         debugY += 10;
      }
   }
}
