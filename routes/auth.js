const BCRYPT = {
    SALT_LENGTH: 8
};
const collectionName = 'users';

const express=require('express');
var router = express.Router();
module.exports = router;
const bcrypt = require('bcryptjs');
const passport = require('passport');
const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;
const mongoOptions = require('../config/mongodb-options');

const _client = MongoClient.connect(mongoOptions.uri);


router.get('/login', function (req, res, next) {
    res.render('auth/login');
});
router.post('/login',
    passport.authenticate('local', {
        failureRedirect: '/login', // go back to the login page if authentication fails
        successReturnToOrRedirect: '/' //go to home page if no other page set in session.returnTo
    }), //include a backstop function in case authenticate doesn't know what to do:
    function (req, res) {
        console.log("Hey, David was wrong; we did call that backstop function after all!");
        res.redirect('/');
    }
);

router.get('/register', function(req,res) {
    res.render('auth/register');
});
router.post('/register', function(req,res) {
    const plainPassword = req.body.password;
    /* @todo: make sure password meets rules? */
    const username = req.body.username.trim();
    /* @todo: make sure username is not already taken */
    const email = req.body.email.trim();

    bcrypt.hash(plainPassword, BCRYPT.SALT_LENGTH, function(err, hash){
        assert.equal(null, err);
        var user = {
            email: email,
            username: username,
            passhash: hash,
            favourites: []
        };
        //shared Promise version of MongoClient.connect
        _client.then(
            client => {
                const db = client.db(mongoOptions.dbName);
                return db.collection(collectionName).insertOne(user);
            }
        ).
        then(()=>res.redirect(req.baseUrl+'/login')).
        catch(console.error);

    }); //bcrypt.hash
}); //post to /register
