//const assert = require('assert'); //used by Mongo in their example code
//const MongoClient = require('mongodb').MongoClient;
//const mongoOptions = require('../config/mongodb-options');
//const collectionName = 'messages';
const ObjectId = require('mongodb').ObjectId;
const db = require('./mongoHelper').getDb();
const collectionPromise = db.then(db => db.collection('users')).catch(console.error);

module.exports.create = message => collectionPromise.
  then(c => c.insertOne(message)).
  catch(console.error);

module.exports.retrieveByUsername = (username, options = null) => collectionPromise.
    then(c => c.findOne({username: username}, options)).catch(console.error);

module.exports.deleteId = id => collectionPromise.
  then(c => c.deleteOne({_id: ObjectId(id)})).catch(console.error);

module.exports.retrieveById = id => collectionPromise.then(
    c=>c.findOne({_id: ObjectId(id)})
).catch(console.error);

module.exports.updateMessageById = (id, message) => collectionPromise.then(
    c=>c.findOneAndUpdate({_id: ObjectId(id)}, {$set: {message: message}})).catch(console.error);
