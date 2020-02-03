const ObjectId = require('mongodb').ObjectId;
const db = require('./mongoHelper').getDb();
const collectionPromise = db.then(db => db.collection('users')).catch(console.error);

module.exports.retrieve = (options = null) => collectionPromise.
then(c => c.find({}, options).toArray()).catch(console.error);

module.exports.deleteId = id => collectionPromise.
then(c => c.deleteOne({_id: ObjectId(id)})).catch(console.error);

/* pushes a new searchID into the users favourites list */
module.exports.pushNewFavourite = (id, searchID) => collectionPromise.then(
    c=>c.findOneAndUpdate({_id: ObjectId(id)}, {$push: {favourites: searchID}})).catch(console.error);