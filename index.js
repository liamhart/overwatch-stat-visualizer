//////////// INITIALIZATION /////////
var express = require('express');
const assert = require('assert');
var app = express();

const request = require('request');

const favouritesDb = require('./lib/favourites');

app.set('port', process.env.PORT || 3000);

var handlebars = require('express-handlebars').create({
    defaultLayout: 'main',
    helpers: {
        section: function (name, options) {
            if (!this._sections) this._sections = {};
            this._sections[name] = options.fn(this);
            return null;
        },
        urlEncode: function (string) {
            return encodeURIComponent(string);
        },
        /* register helper function for determining if an array in JSON format contains an element */
        ifNotIn: function(elem, list, options) {
            if(list.indexOf(elem) === -1) {
                return options.fn(this);
            }
            return options.inverse(this);
        },
        formUrl: function(base, index, ext) {
            return base + index + ext;
        },
        playTime: function(timeInSeconds) {
            return (timeInSeconds / 3600).toFixed(2);
        }
    }
});

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

var session = require('express-session');

const bcrypt = require('bcryptjs');
const MongoClient = require('mongodb').MongoClient;
const mongoOptions = require('./config/mongodb-options');
MongoClient.connect(mongoOptions.uri, function(err,db) {
    if(err) {
        console.error("Could not connect to MongoDB: "+err.message);
    } else {
        console.log("Connection to MongoDB succeeded!");
        db.close();
    }
});

var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
var passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy;
passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (user, done) {
    done(null, user);
});
passport.use(new LocalStrategy(
    function (username, password, done) {
        //done is a callback; expects (error|null, user|false) as its parameters.
        console.log("Attempting local login for " + username);
        MongoClient.connect(mongoOptions.uri, function(err,client) {
            assert.equal(null, err);
            console.log("Connected to MongoDB to register user");
            const db = client.db(mongoOptions.dbName);
            const col = db.collection('users');/* @todo figure out what config file or something should tell me this name */
            col.find({username: username}).limit(1).toArray(function(err,docs){
                assert.equal(null,err);
                console.log("Retrieved these users: "+JSON.stringify(docs));
                if(docs.length !== 1) {
                    console.log("Username not found; no document");
                    return done(null, false); // must return here; cannot continue!
                }
                const user = docs[0];
                bcrypt.compare(password, user.passhash, function(err, res) {
                    if(res){
                        console.log("Password matches hash");
                        return done(null, user);
                    } // the password matches
                    else {
                        console.log("Password did not match hash.");
                        return done(null, false);
                    }
                });//bcrypt.compare
            });//toArray (of collection find...)
        });//mongoClient.connect
    }//function upd
));//passport use

///////// PIPELINE /////////////

// For any URL that matches the path of a file within the specified folder,
// static will server that file. Otherwise, it will continue to the next
// item in the pipeline.
// Mark the static directory as a "Resource Route" in Webstorm and it will know
// that files can be found there and warn you when not found.
app.use(express.static(__dirname + '/static'));

app.use(session(require('./config/express-session-options')));

app.use(passport.initialize());

app.use(passport.session());

app.use(require('body-parser').urlencoded({extended: true}));


app.get('/', function (req, res, next) {
    res.render('home', {
        user: req.user
    });
});


var authRouter=require('./routes/auth');
app.use('/auth', authRouter);

/* Dealing with the searching function */

app.get('/results', function(req,res) {
    res.render('api/results', {
        search: req.searchID
    });
});

/* Managing the search function */


app.post('/', function(req,res) {
    if(req.body.searchID) {
        const searchID = req.body.searchID.trim();

        /* Searching API for user statistics */

        request('https://ovrstat.com/stats/pc/us/' + searchID, { json: true }, (err, response, body) => {
            if(req.user) {
                console.log("User " + req.user.username + " is searching for: " + req.body.searchID);
                //  probably call user redefine function here

                updateUser(req);

                console.log("Session User: " + JSON.stringify(req.session.passport.user));
                console.log("Request User: " + JSON.stringify(req.user));
            }
            else {
                console.log("Visitor is searching for: " + req.body.searchID);
            }

            if (err) {
                return console.log(err);
            }

            var index = [];

            for (var x in body.quickPlayStats.topHeroes) {
                index.push(x);
            }


            res.render('api/results', {
                //  user information
                user: req.user,
                searchID: req.body.searchID,
                //  search results information
                username: body.name,
                img: body.icon,
                rating: body.rating,
                ratingIcon: body.ratingIcon,
                heroIndex: index,
                heroData: body.quickPlayStats.topHeroes
            });


        })
    }
    else {
        res.redirect('/');
    }
});

/* write a function to update req.user

get user by userID and set req.user to the user returned in the document
 */

function updateUser(req) {

    MongoClient.connect(mongoOptions.uri, function(err,client) {
        assert.equal(null, err);
        console.log("Connected to MongoDB to update user " + req.user.username);
        const db = client.db(mongoOptions.dbName);
        const col = db.collection('users');
        col.find({username: req.user.username}).limit(1).toArray(function(err,docs){
            assert.equal(null,err);
            console.log(docs[0]);
            /* credit to https://github.com/jaredhanson/passport/issues/208 for solution */
            req.login(docs[0], function(err) {
                if (err) return next(err);

                console.log("After relogin: ");
                console.info(req.user);
            });

        });
    }); //  mongoClient.connect

}

/* managing the adding and deletion of favourites */

app.post('/api/results', function(req, res) {


    console.log("Adding " + req.body.searchID + " as one of " + req.user.username + "'s favourites..");

    favouritesDb.pushNewFavourite(req.user._id, req.body.searchID).
    then(()=> {
        res.redirect('/');
    })
        .catch(function(err) {
            console.error(err);
            res.status(500).json({error: 'Could not favourite user', data: null});
        });
});






/////// ERROR HANDLING

/**
 * This app.use catches any unknown URLs, giving a 404
 * A URL is unknown if it doesn't match anything we
 * specified previously.
 */
app.use(function (req, res) {
    //res.type('text/plain');
    res.status(404);
    res.render('404');
});

/**
 * An app.use callback with FOUR (4) parameters is an
 * error handler; the err is in the first
 * parameter to the function.
 * This lets you gracefully catch errors in your
 * code without crashing your whole application
 */
app.use(function (err, req, res, next) {
    console.log(err.stack);
    //res.type('text/plain');
    res.status(500); // server error
    res.render("500");
});


////////// STARTUP

app.listen(app.get('port'), function () {
    console.log('Express started on http://localhost:' + app.get('port') + "; press Ctrl+C to end.");
});