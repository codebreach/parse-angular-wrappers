"use strict";

angular.module('ngParseWrappers', [])
  .factory('ParseQueryAngular', ['$q', '$timeout',
    function($q, $timeout) {


      // we use $timeout 0 as a trick to bring resolved promises into the Angular digest
      var angularWrapper = $timeout;

      return function(query, options) {

        // if unspecified, the default function to call is 'find'
        var functionToCall = "find";
        if (!_.isUndefined(options) && !_.isUndefined(options.functionToCall)) {
          functionToCall = options.functionToCall;
        }

        // create a promise to return
        var defer = $q.defer();

        // this is the boilerplate stuff that you would normally have to write for every Parse call
        var defaultParams = [{
          success: function(data) {

            /* We're using $timeout as an "angular wrapper" that will force a digest
             * and kind of bring back the data in Angular realm.
             * You could use the classic $scope.$apply as well but here we don't need
             * to pass any $scope as a parameter.
             * Another trick is to inject $rootScope and use $apply on it, but well, $timeout is sexy.
             */
            angularWrapper(function() {
              defer.resolve(data);
            });
          },
          error: function(data, err) {
            angularWrapper(function() {
              defer.reject(err);
            });
          }
        }];
        // Pass custom params if needed.
        if (options && options.params) {
          defaultParams = options.params.concat(defaultParams);
        }
        if (options && options.mergeParams) {
          defaultParams[0] = _.extend(defaultParams[0], options.mergeParams);
        }

        // this is where the async call is made outside the Angular digest
        query[functionToCall].apply(query, defaultParams);

        return defer.promise;

      };

    }
  ])

.factory('ParseAbstractService', ['ParseQueryAngular',
  function(ParseQueryAngular) {
    var object = function(originalClass) {
      originalClass.prototype = _.extend(originalClass.prototype, {
        fetchAngular: function() {
          return ParseQueryAngular(this, {
            functionToCall: "fetch"
          });
        },
        saveAngular: function(data) {
          if (data && typeof data == "object") this.set(data);
          return ParseQueryAngular(this, {
            functionToCall: "save",
            params: [null]
          });
        },
        destroyAngular: function() {
          return ParseQueryAngular(this, {
            functionToCall: "destroy"
          });
        }
      });
      return originalClass;
    };

    return {
      EnhanceObject: object
    };

  }
])

// ExtendParseSDK
.run(['ParseAbstractService', 'ParseQueryAngular',
  function(ParseAbstractService, ParseQueryAngular) {

    var enhancedIterator = function(extensions) {
      return function(func) {
        extensions[func + 'Angular'] = function() {
          var options = {
            functionToCall: func
          };
          if (arguments.length) {
            options['params'] = Array.prototype.slice.call(arguments);
          }
          return ParseQueryAngular(this, options);
        };
      }
    };

    var staticEnhancer = function(object, functions) {
      _.each(functions, function(func) {
        object[func + 'Angular'] = function() {
          var options = {
            functionToCall: func
          };
          if (arguments.length) {
            options['params'] = Array.prototype.slice.call(arguments);
          }
          return ParseQueryAngular(object, options);
        };
      });
    };
    var unavailableIterator = function(func) {
      queryExtensions[func + 'Angular'] = function() {
        throw Error('This function is not enhanced :/');
      }
    };

    var queryExtensions = {};
    _.each(['count', 'find', 'first'], enhancedIterator(queryExtensions));
    _.each(['each'], unavailableIterator);
    Parse.Query.prototype = _.extend(Parse.Query.prototype, queryExtensions);

    var userExtensions = {};
    _.each(['login', 'signUp'], enhancedIterator(userExtensions));
    Parse.User.prototype = _.extend(Parse.User.prototype, userExtensions);
    staticEnhancer(Parse.User, ['logIn', 'signUp', 'become']);

    staticEnhancer(Parse.FacebookUtils, ['link', 'logIn', 'unlink']);
  }
])
.run(['ParseAbstractService', function(ParseAbstractService) {
  Parse.Object.extendAngular = function(options) {
      return ParseAbstractService.EnhanceObject(options);
    };
  }
])
.factory('ParseCloudCodeAngular', ['$q', '$timeout', 'ParseQueryAngular',
  function($q, $timeout, ParseQueryAngular) {
    return function(name, params) {
      return ParseQueryAngular(Parse.Cloud, {
        functionToCall: "run",
        params: [name, params]
      });
    }
  }
]);
