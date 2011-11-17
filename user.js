var Db          = require('mongodb').Db
  , Connection  = require('mongodb').Connection
  , Server      = require('mongodb').Server
  , BSON        = require('mongodb').BSON
  , ObjectID    = require('mongodb').ObjectID;

User = function (host, port) {
  this.db = new Db('exchat', new Server(host, port, {auto_reconnect: true}, {}));
  this.db.open(function (){});
}

User.prototype.getCollection = function (callback) {
  this.db.collection( 'user', function (error, user_collection) {
    if (error) callback(error);
    else callback(null, user_collection);
  });
}

User.prototype.findAll = function (callback) {
  this.getCollection( function (error, user_collection) {
    if (error) callback(error);
    else {
      user_collection.find().toArray( function (error, results) {
        if (error) callback(error);
        else callback(null, results);
      });
    }
  });
}

User.prototype.findByName = function (name, callback) {
  this.getCollection( function (error, user_collection) {
    if (error) callback(error,null);
    else {
      user_collection.findOne({name: name}, function (error, results) {
        if (error) callback(error,null);
        else callback(null, results);
      });
    }
  });
}

User.prototype.findById = function (id, callback) {
  this.getCollection( function (error, user_collection) {
    if (error) callback(error);
    else {
      user_collection.findOne({_id: user_collection.db.bson_serializer.ObjectID.createFromHexString(id)}, function (error, results) {
        if (error) callback(error);
        else callback(null, results);
      });
    }
  });
}

User.prototype.save = function (users, callback) {
  this.getCollection( function (error, user_collection) {
    if (error) callback(error);
    else {
      if (typeof(users.length) == "undefined")
        users = [users];

      for (var i = 0; i < users.length; i++) {
        user = users[i];
        user.created_at = new Date();
      }
    }

    user_collection.insert(users, function () {
      callback(null, users);
    });
  });
}

exports.User = User;
