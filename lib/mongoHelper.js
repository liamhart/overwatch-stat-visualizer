const MongoClient = require('mongodb').MongoClient;
const mongoOptions = require('../config/mongodb-options');
const clientPromise = MongoClient.connect(mongoOptions.uri);
module.exports.getDb = () => clientPromise.
then(client => client.db(mongoOptions.dbName)).
catch(console.error);