//
//
// URL Shortener Project for freeCodeCamp
// by Simon Rhe, March 2020
//
//

'use strict';
require('dotenv').config(); 
const express = require('express');
const mongo = require('mongodb');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dns = require('dns'); // to validate domain name
const cors = require('cors');

const app = express();

// Basic configuration 
let port = process.env.PORT || 3000;

// Connect to database
const MONGO_URI = process.env.MONGO_URI; // MongoDB Atlas URI, username and password is stored in .env file
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
let db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("Connection to db successful! readyState: " + db.readyState);
});

// Define schemas and models for URL entry and for counter (latter collection containing only one document)
let urlEntrySchema = new mongoose.Schema({
  shorturl: {type: Number, required: true},
  originalurl: {type: String, required: true},
  visitcounter: {type: Number, default: 0} // TODO: currently not implemented
});
let UrlEntry = mongoose.model('UrlEntry', urlEntrySchema); // note: Mongoose automatically looks for the plural, lowercased version of your model name.

let incCounterSchema = new mongoose.Schema({
  incrementcounter: {type: Number, default: 1}
});
let IncrementCounter = mongoose.model('counter', incCounterSchema);


// Mount Express middleware
app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

// (API endpoint for testing purposes)
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});

// API to create new shortened URL
app.post("/api/shorturl/new", function(req, res) {
  let originalURL = req.body.url;
  const regex = /(https?:\/\/)?(www\.)?([\w\.]+)\/*/i;
  let regexresult = regex.exec(originalURL);
  let protocol = regexresult[1];
  let domain = regexresult[3];
  console.log(`Protocol: ${protocol}; Domain to check: ${domain}`);

  // Check that protocol was defined ("http://" or "https://, see regex")
  if (protocol == undefined) {
    res.json({
      error: "invalid URL; must specify protocol."
    });
    return;
  }

  // Check if domain valid
  dns.lookup(domain, function(err, address, family) {
    console.log('domain address: %j family: IPv%s', address, family);
    if (err) {
      console.log(`error: ${err}; err keys: ${Object.keys(err)}`);
      res.json({
        error: "invalid URL; domain " + domain + " not found"
      });
      return;
    }

    // Find next increment for shortened URL
    IncrementCounter.findOneAndUpdate(
      {}, // search arguments SELECT * (as there is only one doc in collection)
      {
        $inc: {incrementcounter: 1}
      }, // update; the $inc operator increments a field by a specified value
      {
        new: true, // returns updated document
        upsert: true // creates doc if doesn't exist
      },
      function(err, incCounterDoc) {
        if (err) return console.error(err);
        let incCounter = incCounterDoc.incrementcounter;
        let newUrlEntry = new UrlEntry({
          originalurl: originalURL,
          shorturl: incCounter
        });
        newUrlEntry.save(function(err, data) {
          if (err) return console.error(err);
          console.log(`UrlEntry successfully created! Data: ${data}`);
          res.json({
            original_url: originalURL,
            short_url: incCounter
          });
        });
      }
    );
  }); 
});

// To access shortened URL
app.get("/api/shorturl/:shurl", function(req, res) {
  let shortURL = req.params.shurl;
  UrlEntry.findOne({shorturl: shortURL}, function(err, doc) {
    if (err) return console.error(err);
    console.log(`Found short URL! Doc: ${doc}`);
    res.redirect(doc.originalurl);
  });
});

// Start listening
app.listen(port, function () {
  console.log(`Express listening on port ${port}`);
});