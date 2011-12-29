
/**
 * Module dependencies.
 */

var express = require('express');

var app = module.exports = express.createServer();

var io = require('socket.io').listen(app);

var UserModel = require('./user.js').User
  , User = new UserModel('localhost', 27017);
//1
var parseCookie = require('connect').utils.parseCookie;
    MemoryStore = express.session.MemoryStore;
    sessionStore = new MemoryStore();
var Session = require('connect').middleware.session.Session;
//end1
// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({store: sessionStore
        , secret: 'secret'
        , key: 'express.sid'}));
  //app.use(express.session({ secret: 'your secret here' }));
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
var user_sockets = {};

// check empty object
function is_empthy_obj(obj) {
  for (var prop in obj)
      return false;
  return true;
}

//function setmyname(){
//    socket.on('myname',function(args){
//      console.log('My name is %s',args.name);
//	return args.name;
//     });
//}

//1-1
//io.set('authorization', function (data, accept) {
//    if (data.headers.cookie) {
//        data.cookie = parseCookie(data.headers.cookie);
//        data.sessionID = data.cookie['express.sid'];
//        // save the session store to the data object 
//        // (as required by the Session constructor)
//        data.sessionStore = sessionStore;
//        sessionStore.get(data.sessionID, function (err, session) {
//            if (err || !session) {
//                accept('Error', false);
//            } else {
//                // create a session object, passing data as request and our
//                // just acquired session data
//                data.session = new Session(data, session);
//                accept(null, true);
//            }
//        });
//    } else {
//       return accept('No cookie transmitted.', false);
//    }
//});
//end1-1

io.configure(function (){
  io.set('authorization', function (handshakeData, callback) {
    handshakeData.name = current_user.name;
    console.log('Global Handshake initialized');
    handshakeData.name = current_user.name;
    console.log('Global Name: %s',handshakeData.name);
    callback(null, true); // error first callback style 
  });
});

// public chat room
var public_room = io.of('/room').on('connection', function (socket) {
  // add and share new user
  //console.log(__filename);
  var address=socket.handshake.address;
  console.log("New connection from " + address.address + ":" + address.port);
  console.log("RemoteAddress: %s",socket.remoteAddress);
  console.log("Room: Global name: %s",socket.handshake.name);
  console.dir(socket.handshake);
  socket.set('name', socket.handshake.name);//current_user.name);
  socket.get('name', function (err, name) {
//    var myname=setmyname();
    // check concurrence
    if (!connections[name]) {
      user_sockets[name] = socket;
      connections[name] = { sockets: {} };
      online_users[name] = true;
      
      public_room.emit('online_users', online_users);
      public_room.emit('msg', { to: null, msg: '<b>' + name + '</b> is joined' } );
    } else {
      //Broadcast that new user is joined
      socket.emit('online_users', online_users);
      socket.emit('msg', { to: null, msg: '<b>' + name+ '</b> is joined' } );
    }

    connections[name].sockets[socket.id] = socket;
  });

  socket.on('msg', function (data) {
    socket.get('name', function (err, name) {
      //If Private message to connected user
      if (data.to && connections[data.to])
        for (user_socket in connections[data.to].sockets) {
          console.log('Private message: %j',data);
          console.log('User_Socket_id %j',user_socket);
          if(data.from!=data.to)
          connections[data.to].sockets[user_socket].emit('msg', 
			{from: data.from, to: data.to, msg: data.from + ": " + data.msg } );
  //connections[data.to].sockets[data.from].emit('msg',{to: name, msg: data.to + ":" + data.msg});
          //My message   
          socket.emit('msg', { to: data.to, msg: "me: " + data.msg } );
        }
      //If Public message, broadcast to all
      else{
        console.log('Public message: %j',data);
        public_room.emit('msg', { to: data.to, msg: '<b>' + data.from + '</b>: ' + data.msg } );
	}
    });
  });

  // remove and share disconnected user
  socket.on('disconnect', function () {
    socket.get('name', function (err, name) {
      delete connections[name].sockets[socket.id];
      if (is_empthy_obj(connections[name].sockets) && !user_sockets[name]) {
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
  User.findByName(req.param('name'), function (error, user) {
	  if(!req.session.user && user){
	      req.flash('error', 'Existing user name');
	      res.redirect('/join');
	  }  
  else{
	  if (req.param('password') == req.param('password_confirmation')) {
	    User.save({
	      name: req.param('name'),
	      password: req.param('password')
	      }, function (error, docs) {
		      req.session.user = user;
		      current_user = user;
		      req.flash('info', 'Register is successfully. Now you can login');
		      res.redirect('/');
	      })
	  }
	}
});
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
  delete user_sockets[req.params.name];
  res.redirect('/');
});

app.get('/room/:name?', function (req, res) {
  console.log('Remote Connection Address: ',req.connection.remoteAddress);
  console.log('Remote Socket Address: ',req.socket.remoteAddress);
  console.log('Remote Connection Address: ',req.socket.address());
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
