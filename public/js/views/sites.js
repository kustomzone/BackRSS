define([
  "marionette",
  "globals"
], function(Marionette, BackRss){
  "use strict";

  BackRss.Views.SiteItemView = Backbone.Marionette.ItemView.extend({
    tagName: "li",
    template: '#site-item-template',

    modelEvents: {
      'markSelected': 'addActiveClass',
      'markUnselected': 'removeActiveClass',
      'change': 'fieldsChanged'
    },

    fieldsChanged: function() {
      this.render();
    },

    addActiveClass: function() {
      this.$el.addClass('active');
    },

    removeActiveClass: function() {
      this.$el.removeClass('active');
    }
  });

  BackRss.Views.SitesCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: "ul",
    className: "nav nav-sidebar",
    childView: BackRss.Views.SiteItemView,

    initialize : function() {
      this.listenTo(this.collection, "reset", this.render);
    }
  });

  BackRss.Views.ManageSiteItemView = Backbone.Marionette.ItemView.extend({
    tagName: "tr",
    template: '#manage-sites-item-template'
  });

  BackRss.Views.ManageSitesView = Backbone.Marionette.CompositeView.extend({
    template: '#manage-sites-template',

    childView: BackRss.Views.ManageSiteItemView,
    childViewContainer: "table",

    events: {
      'click .btnDeleteSite': "deleteSite"
    },

    filter: function (child, index, collection) {
      return child.get('_id') !== null;
    },

    deleteSite: function(e) {
      e.preventDefault();

      var siteId = $(e.currentTarget).data("id");
      var that = this;

      bootbox.confirm("Are you sure?", function(result) {
        if (result) {
          var site = that.collection.findWhere({ _id: siteId });
          var allSites = that.collection.findWhere({ _id: null });
          allSites.set('count', allSites.get('count') - site.get('count'));

          site.destroy({ wait: true });
        }
      });
    }
  });

  BackRss.Views.ManageSitesAddSiteView = Backbone.Marionette.ItemView.extend({
    template: "#add-site-template",

    events: {
      'click #btnAddSite': "addSite"
    },

    ui: {
      inputTitle: '#title',
      inputUrl: '#url'
    },

    onShow: function() {
      this.ui.inputTitle.focus();
    },

    addSite: function(e) {
      e.preventDefault();

      if (!this.ui.inputTitle.val() || !this.ui.inputUrl.val()) {
        return false;
      }

      var model = new BackRss.Entities.Site();
      var that = this;

      model.save({title: this.ui.inputTitle.val(), url: this.ui.inputUrl.val()}, {
        success: function(model, resp) {
          that.collection.add(resp.data);
          Backbone.history.navigate("sites", { trigger: true });
        }, error: function() {
          BackRss.vent.trigger("error", "Error occured");
        }, wait: true
      });
    }
  });

  return BackRss;
});
