
/**
 * Module dependencies.
 */

var express = require('express');

var app = module.exports = express.createServer();

var io = require('socket.io').listen(app);

var UserModel = require('./user.js').User
  , User = new UserModel('localhost', 27017);

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'your secret here' }));
  app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Helpers for views -----

app.dynamicHelpers({
  session: function (req, res) {
    return req.session;
  },

  flash: function (req, res) {
    return req.flash();
  }
});

// Socket.io -----

var connections = {};
var online_users = {}; // online user list for view

// check empty object
function is_empthy_obj(obj) {
  for (var prop in obj)
      return false;
  return true;
}

// public chat room
var public_room = io.of('/room').on('connection', function (socket) {
  // add and share new user
  socket.set('name', current_user.name);
  socket.get('name', function (err, name) {
    // check concurrence
    if (!connections[name]) {
      connections[name] = { sockets: {} };
      online_users[name] = true;

      public_room.emit('online_users', online_users);
      public_room.emit('msg', { to: null, msg: '<b>' + name + '</b> is joined' } );
    } else {
      socket.emit('online_users', online_users);
      socket.emit('msg', { to: null, msg: '<b>' + name + '</b> is joined' } );
    }

    connections[name].sockets[socket.id] = socket;
  });

  socket.on('msg', function (data) {
    socket.get('name', function (err, name) {
      if (data.to && connections[data.to])
        for (user_socket in connections[data.to].sockets) {
          connections[data.to].sockets[user_socket].emit('msg', { to: name, msg: data.to + ": " + data.msg } );
          socket.emit('msg', { to: data.to, msg: "me: " + data.msg } );
        }
      else
        public_room.emit('msg', { to: data.to, msg: '<b>' + name + '</b>: ' + data.msg } );
    });
  });

  // remove and share disconnected user
  socket.on('disconnect', function () {
    socket.get('name', function (err, name) {
      delete connections[name].sockets[socket.id];
      if (is_empthy_obj(connections[name].sockets)) {
        delete connections[name];
        delete online_users[name];

        public_room.emit('online_users', online_users);
        public_room.emit('msg', { to: null, msg: '<b>' + name + '</b> is left' } );
      } else {
        socket.emit('online_users', online_users);
        socket.emit('msg', { to: null, msg: '<b>' + name + '</b> is joined' } );
      }
    });
  });
});

// Routes -----

app.get('/', function(req, res) {
  res.render('index');
});

app.get('/join', function (req, res) {
  res.render('user/join.jade', {
    title: 'Join'
  });
});

app.post('/join', function (req, res) {
  if (req.param('password') == req.param('password_confirmation')) {
    User.save({
      name: req.param('name'),
      password: req.param('password')
    }, function (error, docs) {
      req.session.user = user;
      current_user = user;
      req.flash('info', 'Register is successfully. Now you can login');
      res.redirect('/');
    });
  }
});

app.get('/login', function(req, res) {
  if (!req.session.user)
    res.render('user/login.jade', {
      title: 'Login'
    });
  else
    res.redirect('/');
});

var current_user = false;

app.post('/login', function (req, res) {
try {
    User.findByName(req.param('name'), function (error, user) {
    if (error) {
      req.flash('error', 'Login is failed');
      res.redirect('/login');
    } else {
      if (!req.session.user && user && user.password == req.param('password')) {
        req.session.user = user;
        current_user = user;
        req.flash('info', 'Successfully loged in');
      } else {
	if(!user)
	        req.flash('error', 'No such user exists');
	else
        	req.flash('error', 'Login is failed');
      }
      res.redirect('/login');
    }
  });
}
catch (error) {
    console.log("Error:", error)
}

});

app.get('/user/:name?', function (req, res) {
  if (req.params.name)
    User.findByName(req.params.name, function (error, user) {
      title = user.name;
      if (req.session.user)
        if (req.session.user.name == req.params.name)
          title = 'My profile';
      res.render('user/show.jade', {
        title: title,
        user: user
      });
    });
  else
    User.findAll( function (error, users) {
      res.render('user/index.jade', {
        title: 'Users',
        users: users
      });
    });
});

app.get('/logout', function (req, res) {
  req.session.user = null;
  current_user = false;
  res.redirect('/');
});

app.get('/room/:name?', function (req, res) {
  if (req.params.name) {}
  else
    if (req.session.user) {
      User.findAll( function (error, users) {
        res.render('room.jade', {
          title: 'Public chat room'
        });
      });
    } else
      res.redirect('/login');
});

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
