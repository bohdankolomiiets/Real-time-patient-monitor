var mongoClient = require('mongodb').MongoClient;
var mongoDb;
var dbName;

function connectToMongDb(dataBaseName){
  dbName = dataBaseName;
  mongoClient.connect(`mongodb://localhost:27017/${dbName}`, (err, client) => {
    if(err)
      return console.log(err);
    console.log('Connected to mongoDB server');
    mongoDb = client.db(dbName);
  });
}

function getMongoDb() {
  if(mongoDb == undefined || mongoDb == null) {
    connectToMongDb();
  }
  return mongoDb;
}

function getRecords() {
  return getMongoDb().collection('Records');
}

function insertOneRecord(object, callback) {
  getRecords().insertOne(object, (err, res) => {
    if(err)
      return console.log('Unable to insert record', err);
    console.log(JSON.stringify(res.ops));
    callback(res);
  });
}

function findOneAndUpdateRecord(query, setData, options, callback) {
  getRecords().findOneAndUpdate(query, setData, options, (err, document) => {
    if(err)
      return console.log('Unable to find document', err);
    if(document == null) {
      callback(document);
      return console.log(`Record with ${query} was not found`);
    }
    console.log(`Updated: ${JSON.stringify(document)}`);
    callback(document);
  });
}

function findOneRecord(query, projection, callback) {
  getRecords().findOne(query, projection, (err, document) => {
    if(err)
      return console.log('Unable to find document', err);
    if(document == null) {
      return console.log(`Record with ${query} was not found`);
    }
    console.log(`Found: ${JSON.stringify(document)}`);
    callback(document);
  });
}

function getAllRecords() {
  return getRecords().find().toArray();
}

module.exports = {
    getMongoDb: getMongoDb,
    connectToMongDb: connectToMongDb,
    insertOneRecord: insertOneRecord,
    findOneRecord: findOneRecord,
    findOneAndUpdateRecord: findOneAndUpdateRecord,
    getAllRecords: getAllRecords
}