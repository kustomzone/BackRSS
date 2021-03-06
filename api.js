"use strict";

var _ = require('underscore');
var async = require('async');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var FeedParser = require('feedparser');
var request = require('request');
var path = require('path');

var Datastore = require('nedb');
var db = {};
var env = process.env.NODE_ENV || 'development'
var getFeedsInterval = null;

if (env == 'test') {
  db.sites = new Datastore();
  db.feeds = new Datastore();
} else {
  db.sites = new Datastore({ filename: path.join(__dirname,'sites'), autoload: true });
  db.feeds = new Datastore({ filename: path.join(__dirname,'feeds'), autoload: true });
}

var onError = function (error) {
  console.error('Error: ' + error);
};

var saveFeedData = function(feed) {
  db.feeds.find({ guid: feed.guid, site_id: feed.site_id }, function (err, feeds) {
    if (feeds.length === 0)
    {
      db.feeds.insert(feed, function (err, feed) {
        if (err)
        {
          console.log('Error occured during feed save');
        }
      });
    }
  });
};

var getFeedData = function (site) {
  console.log('Fetching feeds for: ' + site.url);

  try {
    request(site.url)
      .pipe(new FeedParser())
      .on('error', onError)
      .on('readable', function() {
        var stream = this, item;
        var add_feed = false;

        while (item = stream.read()) {
          item.site_id = site._id;
          item.seen = false;

          saveFeedData(item);
        }
      });
  } catch(e) {
    console.log('Error occured during fetching feed: ' + e);
  }
};

var getFeeds = function () {
  db.sites.find({}, function (err, sites) {
    if (err) {
      console.log('Error occured during fetching site list');
    } else {
      sites.forEach(getFeedData);
    }
  });
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

app.get('/api/sites', function (req, res) {
  var fetchSites = function(callback) {
    db.sites.find({}).sort({ title: 1 }).exec(callback);
  };

  var fetchSitesCount = function(sites, callback) {
    var funcs = _.map(sites, function(site) {
      return function(cb) {
        db.feeds.count({ seen: false, site_id: site._id }, function (err, count) {
          site.count = count;
          cb(err);
        });
      };
    });

    async.parallel(funcs, function(err){
      callback(err, sites);
    });
  };

  async.waterfall([
    fetchSites.bind(this),
    fetchSitesCount.bind(this)
  ], function(err, result){
    if (err) {
      res.send({ error: err });
    } else {
      res.send({ data: result });
    }
  });
});

app.post('/api/sites', function (req, res) {
  db.sites.insert(req.body, function (err, site) {
    if (err) {
      res.send({ error: err });
    } else {
      res.send({ data: site });
    }
  });
});

app.delete('/api/sites/:id', function (req, res) {
  var deleteSite = function(callback) {
    db.sites.remove({ _id: req.params.id }, callback);
  };

  var deleteFeedsForSite = function(arg1, callback) {
    db.feeds.remove({ site_id: req.params.id }, { multi: true }, callback);
  };

  async.waterfall([
    deleteSite.bind(this),
    deleteFeedsForSite.bind(this)
  ], function(err, result){
    if (err) {
      res.send({ error: err });
    } else {
      res.send({ data: result });
    }
  });
});

app.get('/api/feeds/:site_id?', function (req, res) {
  var queryParams = { seen: false };

  if (req.params.site_id)
  {
    queryParams.site_id = req.params.site_id;
  }

  db.feeds.find(queryParams).sort({ pubDate: -1 }).exec(function (err, docs) {
    if (err) {
      res.send({ error: err });
    } else {
      res.send({ data: docs });
    }
  });
});

app.put('/api/feeds/:site_id?', function (req, res) {
  db.feeds.update({ _id: req.body._id }, { $set: { seen: true } }, {}, function (err, numReplaced) {
    if (err) {
      res.send({ error: err });
    } else {
      res.send({ data: req.body });
    }
  });
});

app.get('*', function(req, res) {
  res.sendFile('/public/index.html', { root: __dirname });
});

module.exports = {
  start: function() {
    getFeedsInterval = setInterval(getFeeds, 1000 * 30);

    this._server = app.listen(8080, function () {
      var port = this._server.address().port;

      if (env != 'test') {
        console.log('App listening at http://localhost:%s', port);
      }
    }.bind(this));
  },

  stop: function() {
    clearInterval(getFeedsInterval);

    this._server.close();
  }
};

