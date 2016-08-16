'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var jsData = require('js-data');
var jsDataAdapter = require('js-data-adapter');
var documentdb = require('documentdb');
var underscore = _interopDefault(require('mout/string/underscore'));

var REQUEST_OPTS_DEFAULTS = {};
var FEED_OPTS_DEFAULTS = {};

var checkIfNameExists = function checkIfNameExists(name, parameters) {
  var exists = false;
  parameters.forEach(function (parameter) {
    if (parameter.name === name) {
      exists = true;
      return false;
    }
  });
  return exists;
};

var addParameter = function addParameter(field, value, parameters) {
  var name = '@' + field;
  var newName = name;
  var count = 1;

  while (checkIfNameExists(newName, parameters)) {
    newName = name + count;
    count++;
  }
  parameters.push({
    name: newName,
    value: value
  });
  return newName;
};

var equal = function equal(field, value, parameters, collectionId) {
  return collectionId + '.' + field + ' = ' + addParameter(field, value, parameters);
};

var notEqual = function notEqual(field, value, parameters, collectionId) {
  return collectionId + '.' + field + ' != ' + addParameter(field, value, parameters);
};

/**
 * Default predicate functions for the filtering operators. These produce the
 * appropriate SQL and add the necessary parameters.
 *
 * @name module:js-data-documentdb.OPERATORS
 * @property {function} = Equality operator.
 * @property {function} == Equality operator.
 * @property {function} != Inequality operator.
 * @property {function} > "Greater than" operator.
 * @property {function} >= "Greater than or equal to" operator.
 * @property {function} < "Less than" operator.
 * @property {function} <= "Less than or equal to" operator.
 * @property {function} in Operator to test whether a value is found in the
 * provided array.
 * @property {function} notIn Operator to test whether a value is NOT found in
 * the provided array.
 * @property {function} contains Operator to test whether an array contains the
 * provided value.
 * @property {function} notContains Operator to test whether an array does NOT
 * contain the provided value.
 */
var OPERATORS = {
  '=': equal,
  '==': equal,
  '===': equal,
  '!=': notEqual,
  '!==': notEqual,
  '>': function _(field, value, parameters, collectionId) {
    return collectionId + '.' + field + ' > ' + addParameter(field, value, parameters);
  },
  '>=': function _(field, value, parameters, collectionId) {
    return collectionId + '.' + field + ' >= ' + addParameter(field, value, parameters);
  },
  '<': function _(field, value, parameters, collectionId) {
    return collectionId + '.' + field + ' < ' + addParameter(field, value, parameters);
  },
  '<=': function _(field, value, parameters, collectionId) {
    return collectionId + '.' + field + ' <= ' + addParameter(field, value, parameters);
  },
  'in': function _in(field, value, parameters, collectionId) {
    return 'ARRAY_CONTAINS(' + addParameter(field, value, parameters) + ', ' + collectionId + '.' + field + ')';
  },
  'notIn': function notIn(field, value, parameters, collectionId) {
    // return `${collectionId}.${field} NOT IN ${addParameter(field, value, parameters)}`
    return 'NOT ARRAY_CONTAINS(' + addParameter(field, value, parameters) + ', ' + collectionId + '.' + field + ')';
  },
  'contains': function contains(field, value, parameters, collectionId) {
    return 'ARRAY_CONTAINS(' + collectionId + '.' + field + ', ' + addParameter(field, value, parameters) + ')';
  },
  'notContains': function notContains(field, value, parameters, collectionId) {
    return 'NOT ARRAY_CONTAINS(' + collectionId + '.' + field + ', ' + addParameter(field, value, parameters) + ')';
  }
};

Object.freeze(OPERATORS);

/**
 * DocumentDBAdapter class.
 *
 * @example
 * // Use Container instead of DataStore on the server
 * import { Container } from 'js-data';
 * import { DocumentDBAdapter } from 'js-data-documentdb';
 *
 * // Create a store to hold your Mappers
 * const store = new Container();
 *
 * // Create an instance of DocumentDBAdapter with default settings
 * const adapter = new DocumentDBAdapter({
 *   documentOpts: {
 *     db: 'mydb',
 *     urlConnection: process.env.DOCUMENT_DB_ENDPOINT,
 *     auth: {
 *       masterKey: process.env.DOCUMENT_DB_KEY
 *     }
 *   }
 * });
 *
 * // Mappers in "store" will use the DocumentDB adapter by default
 * store.registerAdapter('documentdb', adapter, { 'default': true });
 *
 * // Create a Mapper that maps to a "user" table
 * store.defineMapper('user');
 *
 * @class DocumentDBAdapter
 * @extends Adapter
 * @param {object} [opts] Configuration options.
 * @param {object} [opts.client] See {@link DocumentDBAdapter#client}.
 * @param {boolean} [opts.debug=false] See {@link Adapter#debug}.
 * @param {object} [opts.documentOpts={}] See {@link DocumentDBAdapter#documentOpts}.
 * @param {object} [opts.feedOpts={}] See {@link DocumentDBAdapter#feedOpts}.
 * @param {object} [opts.operators={@link module:js-data-documentdb.OPERATORS}] See {@link DocumentDBAdapter#operators}.
 * @param {boolean} [opts.raw=false] See {@link Adapter#raw}.
 * @param {object} [opts.requestOpts={}] See {@link DocumentDBAdapter#requestOpts}.
 */
function DocumentDBAdapter(opts) {
  jsData.utils.classCallCheck(this, DocumentDBAdapter);
  opts || (opts = {});

  // Setup non-enumerable properties
  Object.defineProperties(this, {
    /**
     * The DocumentDB client used by this adapter. Use this directly when you
     * need to write custom queries.
     *
     * @example <caption>Use default instance.</caption>
     * import { DocumentDBAdapter } from 'js-data-documentdb';
     * const adapter = new DocumentDBAdapter()
     * adapter.client.createDatabase('foo', function (err, db) {...});
     *
     * @example <caption>Configure default instance.</caption>
     * import { DocumentDBAdapter } from 'js-data-documentdb';
     * const adapter = new DocumentDBAdapter({
     *   documentOpts: {
     *     db: 'mydb',
     *     urlConnection: process.env.DOCUMENT_DB_ENDPOINT,
     *     auth: {
     *       masterKey: process.env.DOCUMENT_DB_KEY
     *     }
     *   }
     * });
     * adapter.client.createDatabase('foo', function (err, db) {...});
     *
     * @example <caption>Provide a custom instance.</caption>
     * import { DocumentClient } from 'documentdb';
     * import { DocumentDBAdapter } from 'js-data-documentdb';
     * const client = new DocumentClient(...)
     * const adapter = new DocumentDBAdapter({
     *   client: client
     * });
     * adapter.client.createDatabase('foo', function (err, db) {...});
     *
     * @name DocumentDBAdapter#client
     * @type {object}
     */
    client: {
      writable: true,
      value: undefined
    },
    databases: {
      value: {}
    },
    indices: {
      value: {}
    },
    collections: {
      value: {}
    }
  });

  jsDataAdapter.Adapter.call(this, opts);

  /**
   * Default options to pass to DocumentClient requests.
   *
   * @name DocumentDBAdapter#requestOpts
   * @type {object}
   * @default {}
   */
  this.requestOpts || (this.requestOpts = {});
  jsData.utils.fillIn(this.requestOpts, REQUEST_OPTS_DEFAULTS);

  /**
   * Default options to pass to DocumentClient#queryDocuments.
   *
   * @name DocumentDBAdapter#feedOpts
   * @type {object}
   * @default {}
   */
  this.feedOpts || (this.feedOpts = {});
  jsData.utils.fillIn(this.feedOpts, FEED_OPTS_DEFAULTS);

  /**
   * Override the default predicate functions for the specified operators.
   *
   * @name DocumentDBAdapter#operators
   * @type {object}
   * @default {}
   */
  this.operators || (this.operators = {});
  jsData.utils.fillIn(this.operators, OPERATORS);

  /**
   * Options to pass to a new `DocumentClient` instance, if one was not provided
   * at {@link DocumentDBAdapter#client}. See the [DocumentClient API][readme]
   * for instance options.
   *
   * [readme]: http://azure.github.io/azure-documentdb-node/DocumentClient.html
   *
   * @name DocumentDBAdapter#documentOpts
   * @see http://azure.github.io/azure-documentdb-node/DocumentClient.html
   * @type {object}
   * @property {string} db The default database to use.
   * @property {string} urlConnection The service endpoint to use to create the
   * client.
   * @property {object} auth An object that is used for authenticating requests
   * and must contains one of the auth options.
   * @property {object} auth.masterkey The authorization master key to use to
   * create the client.
   * Keys for the object are resource Ids and values are the resource tokens.
   * @property {object[]} auth.resourceTokens An object that contains resources tokens.
   * Keys for the object are resource Ids and values are the resource tokens.
   * @property {string} auth.permissionFeed An array of Permission objects.
   * @property {string} [connectionPolicy] An instance of ConnectionPolicy class.
   * This parameter is optional and the default connectionPolicy will be used if
   * omitted.
   * @property {string} [consistencyLevel] An optional parameter that represents
   * the consistency level. It can take any value from ConsistencyLevel.
   */
  this.documentOpts || (this.documentOpts = {});

  if (!this.client) {
    this.client = new documentdb.DocumentClient(this.documentOpts.urlConnection, this.documentOpts.auth, this.documentOpts.connectionPolicy, this.documentOpts.consistencyLevel);
  }
}

jsDataAdapter.Adapter.extend({
  constructor: DocumentDBAdapter,

  _count: function _count(mapper, query, opts) {
    opts || (opts = {});
    query || (query = {});

    var collectionId = mapper.collection || underscore(mapper.name);
    opts.select = collectionId + '.' + mapper.idAttribute;

    return this._findAll(mapper, query, opts).then(function (result) {
      return [result[0].length, { found: result[0].length }];
    });
  },
  _create: function _create(mapper, props, opts) {
    var _this = this;

    props || (props = {});
    opts || (opts = {});

    return new jsData.utils.Promise(function (resolve, reject) {
      _this.client.createDocument(_this.getCollectionLink(mapper, opts), jsData.utils.plainCopy(props), _this.getOpt('requestOpts', opts), function (err, document) {
        if (err) {
          return reject(err);
        }
        return resolve([document, { created: 1 }]);
      });
    });
  },
  _createMany: function _createMany(mapper, props, opts) {
    var _this2 = this;

    props || (props = {});
    opts || (opts = {});

    return jsData.utils.Promise.all(props.map(function (record) {
      return _this2._create(mapper, record, opts);
    })).then(function (results) {
      return results.map(function (result) {
        return result[0];
      });
    }).then(function (results) {
      return [results, { created: results.length }];
    });
  },
  _destroy: function _destroy(mapper, id, opts) {
    var _this3 = this;

    opts || (opts = {});

    var collLink = this.getCollectionLink(mapper, opts);
    var requestOpts = this.getOpt('requestOpts', opts);

    return new jsData.utils.Promise(function (resolve, reject) {
      _this3.client.deleteDocument(collLink + '/docs/' + id, requestOpts, function (err) {
        if (err) {
          if (err.code === 404) {
            return resolve([undefined, { deleted: 0 }]);
          }
          return reject(err);
        }
        return resolve([undefined, { deleted: 1 }]);
      });
    });
  },
  _destroyAll: function _destroyAll(mapper, query, opts) {
    var _this4 = this;

    query || (query = {});
    opts || (opts = {});

    var destroyFn = function destroyFn(document) {
      return _this4._destroy(mapper, document.id, opts);
    };

    return this._findAll(mapper, query, opts).then(function (results) {
      return jsData.utils.Promise.all(results[0].map(destroyFn));
    }).then(function (results) {
      return [undefined, { deleted: results.length }];
    });
  },
  _find: function _find(mapper, id, opts) {
    var _this5 = this;

    opts || (opts = {});

    var docLink = this.getCollectionLink(mapper, opts) + '/docs/' + id;
    var requestOpts = this.getOpt('requestOpts', opts);

    return new jsData.utils.Promise(function (resolve, reject) {
      _this5.client.readDocument(docLink, requestOpts, function (err, document) {
        if (err) {
          if (err.code === 404) {
            return resolve([undefined, { found: 0 }]);
          }
          return reject(err);
        }
        return resolve([document, { found: document ? 1 : 0 }]);
      });
    });
  },
  _findAll: function _findAll(mapper, query, opts) {
    var _this6 = this;

    opts || (opts = {});
    query || (query = {});

    var collLink = this.getCollectionLink(mapper, opts);
    var feedOpts = this.getOpt('feedOpts', opts);
    var querySpec = this.getQuerySpec(mapper, query, opts);

    return new jsData.utils.Promise(function (resolve, reject) {
      _this6.client.queryDocuments(collLink, querySpec, feedOpts).toArray(function (err, documents) {
        if (err) {
          return reject(err);
        }
        return resolve([documents, { found: documents.length }]);
      });
    });
  },
  _sum: function _sum(mapper, field, query, opts) {
    if (!jsData.utils.isString(field)) {
      throw new Error('field must be a string!');
    }
    opts || (opts = {});
    query || (query = {});

    var collectionId = mapper.collection || underscore(mapper.name);
    opts.select = collectionId + '.' + mapper.idAttribute + ', ' + collectionId + '.' + field;

    return this._findAll(mapper, query, opts).then(function (result) {
      var sum = result[0].reduce(function (sum, cur) {
        return sum + cur[field];
      }, 0);
      return [sum, { found: result[0].length }];
    });
  },
  _update: function _update(mapper, id, props, opts) {
    var _this7 = this;

    props || (props = {});
    opts || (opts = {});

    var docLink = this.getCollectionLink(mapper, opts) + '/docs/' + id;
    var requestOpts = this.getOpt('requestOpts', opts);

    return this._find(mapper, id, opts).then(function (result) {
      var document = result[0];
      if (!document) {
        throw new Error('Not Found');
      }
      jsData.utils.deepMixIn(document, jsData.utils.plainCopy(props));
      return new jsData.utils.Promise(function (resolve, reject) {
        _this7.client.replaceDocument(docLink, document, requestOpts, function (err, updatedDocument) {
          if (err) {
            return reject(err);
          }
          return resolve([updatedDocument, { updated: updatedDocument ? 1 : 0 }]);
        });
      });
    });
  },
  _updateAll: function _updateAll(mapper, props, query, opts) {
    var _this8 = this;

    props || (props = {});
    query || (query = {});
    opts || (opts = {});

    props = jsData.utils.plainCopy(props);

    var requestOpts = this.getOpt('requestOpts', opts);
    var collLink = this.getCollectionLink(mapper, opts);

    return this._findAll(mapper, query, opts).then(function (result) {
      var documents = result[0];
      documents.forEach(function (document) {
        jsData.utils.deepMixIn(document, props);
      });
      return jsData.utils.Promise.all(documents.map(function (document) {
        return new jsData.utils.Promise(function (resolve, reject) {
          var docLink = collLink + '/docs/' + document.id;
          _this8.client.replaceDocument(docLink, document, requestOpts, function (err, updatedDocument) {
            if (err) {
              return reject(err);
            }
            return resolve(updatedDocument);
          });
        });
      }));
    }).then(function (documents) {
      return [documents, { updated: documents.length }];
    });
  },
  _updateMany: function _updateMany(mapper, records, opts) {
    var _this9 = this;

    records || (records = []);
    opts || (opts = {});

    records = records.filter(function (record) {
      return record && record.id !== undefined;
    });

    return jsData.utils.Promise.all(records.map(function (record) {
      return _this9._update(mapper, record.id, record, opts);
    })).then(function (results) {
      return [results.map(function (result) {
        return result[0];
      }), { updated: results.length }];
    });
  },
  _applyWhereFromObject: function _applyWhereFromObject(where) {
    var fields = [];
    var ops = [];
    var predicates = [];
    jsData.utils.forOwn(where, function (clause, field) {
      if (!jsData.utils.isObject(clause)) {
        clause = {
          '==': clause
        };
      }
      jsData.utils.forOwn(clause, function (expr, op) {
        fields.push(field);
        ops.push(op);
        predicates.push(expr);
      });
    });
    return {
      fields: fields,
      ops: ops,
      predicates: predicates
    };
  },
  _applyWhereFromArray: function _applyWhereFromArray(where) {
    var _this10 = this;

    var groups = [];
    where.forEach(function (_where, i) {
      if (jsData.utils.isString(_where)) {
        return;
      }
      var prev = where[i - 1];
      var parser = jsData.utils.isArray(_where) ? _this10._applyWhereFromArray : _this10._applyWhereFromObject;
      var group = parser.call(_this10, _where);
      if (prev === 'or') {
        group.isOr = true;
      }
      groups.push(group);
    });
    groups.isArray = true;
    return groups;
  },
  _testObjectGroup: function _testObjectGroup(sql, group, parameters, collectionId, opts) {
    var i = void 0;
    var fields = group.fields;
    var ops = group.ops;
    var predicates = group.predicates;
    var len = ops.length;
    for (i = 0; i < len; i++) {
      var op = ops[i];
      var isOr = op.charAt(0) === '|';
      op = isOr ? op.substr(1) : op;
      var predicateFn = this.getOperator(op, opts);
      if (predicateFn) {
        var subSql = predicateFn(fields[i], predicates[i], parameters, collectionId);
        if (isOr) {
          sql = sql ? sql + ' OR (' + subSql + ')' : '(' + subSql + ')';
        } else {
          sql = sql ? sql + ' AND (' + subSql + ')' : '(' + subSql + ')';
        }
      } else {
        throw new Error('Operator ' + op + ' not supported!');
      }
    }
    return sql;
  },
  _testArrayGroup: function _testArrayGroup(sql, groups, parameters, collectionId, opts) {
    var i = void 0;
    var len = groups.length;
    for (i = 0; i < len; i++) {
      var group = groups[i];
      var subQuery = void 0;
      if (group.isArray) {
        subQuery = this._testArrayGroup(sql, group, parameters, collectionId, opts);
      } else {
        subQuery = this._testObjectGroup(null, group, parameters, collectionId, opts);
      }
      if (groups[i - 1]) {
        if (group.isOr) {
          sql += ' OR (' + subQuery + ')';
        } else {
          sql += ' AND (' + subQuery + ')';
        }
      } else {
        sql = sql ? sql + (' AND (' + subQuery + ')') : '(' + subQuery + ')';
      }
    }
    return sql;
  },


  /**
   * Generate the querySpec object for DocumentClient#queryDocuments.
   *
   * @name DocumentDBAdapter#getQuerySpec
   * @method
   * @param {object} mapper The mapper.
   * @param {object} [query] Selection query.
   * @param {object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {object} [opts] Configuration options.
   * @param {object} [opts.operators] Override the default predicate functions
   * for specified operators.
   */
  getQuerySpec: function getQuerySpec(mapper, query, opts) {
    query = jsData.utils.plainCopy(query || {});
    opts || (opts = {});
    opts.operators || (opts.operators = {});
    query.where || (query.where = {});
    query.orderBy || (query.orderBy = query.sort);
    query.orderBy || (query.orderBy = []);
    query.skip || (query.skip = query.offset);
    var collectionId = mapper.collection || underscore(mapper.name);

    var select = opts.select || '*';
    var sql = select + ' FROM ' + collectionId;
    var whereSql = void 0;
    var parameters = [];

    // Transform non-keyword properties to "where" clause configuration
    jsData.utils.forOwn(query, function (config, keyword) {
      if (jsDataAdapter.reserved.indexOf(keyword) === -1 && jsData.utils.isObject(query.where)) {
        if (jsData.utils.isObject(config)) {
          query.where[keyword] = config;
        } else {
          query.where[keyword] = {
            '==': config
          };
        }
        delete query[keyword];
      }
    });

    // Filter
    var groups = void 0;

    if (jsData.utils.isObject(query.where) && Object.keys(query.where).length !== 0) {
      groups = this._applyWhereFromArray([query.where]);
    } else if (jsData.utils.isArray(query.where)) {
      groups = this._applyWhereFromArray(query.where);
    }

    if (groups) {
      whereSql = this._testArrayGroup(null, groups, parameters, collectionId, opts);
    }

    if (whereSql) {
      sql = sql + ' WHERE ' + whereSql;
    }

    // Sort
    var orderBySql = '';
    if (query.orderBy) {
      if (jsData.utils.isString(query.orderBy)) {
        query.orderBy = [[query.orderBy, 'asc']];
      }
      for (var i = 0; i < query.orderBy.length; i++) {
        if (jsData.utils.isString(query.orderBy[i])) {
          query.orderBy[i] = [query.orderBy[i], 'asc'];
        }
        var subOrderBySql = (query.orderBy[i][1] || '').toUpperCase() === 'DESC' ? collectionId + '.' + query.orderBy[i][0] + ' DESC' : collectionId + '.' + query.orderBy[i][0];
        if (orderBySql) {
          orderBySql = orderBySql + ', ' + subOrderBySql;
        } else {
          orderBySql = subOrderBySql;
        }
      }
      if (orderBySql) {
        orderBySql = 'ORDER BY ' + orderBySql;
      }
    }

    // Offset
    // if (query.skip) {
    //   sql += ` SKIP ${+query.skip}`
    // }

    // Limit
    if (query.limit) {
      sql = 'TOP ' + +query.limit + ' ' + sql;
    }

    sql = 'SELECT ' + sql + (orderBySql ? ' ' + orderBySql : '');
    return {
      query: sql,
      parameters: parameters
    };
  },
  getDbLink: function getDbLink(opts) {
    return 'dbs/' + (opts.db === undefined ? this.documentOpts.db : opts.db);
  },
  getCollectionLink: function getCollectionLink(mapper, opts) {
    return this.getDbLink(opts) + '/colls/' + (mapper.collection || underscore(mapper.name));
  },
  waitForDb: function waitForDb(opts) {
    var _this11 = this;

    opts || (opts = {});
    var dbId = jsData.utils.isUndefined(opts.db) ? this.documentOpts.db : opts.db;
    if (!this.databases[dbId]) {
      this.databases[dbId] = new jsData.utils.Promise(function (resolve, reject) {
        _this11.client.readDatabases().toArray(function (err, dbs) {
          if (err) {
            return reject(err);
          }
          var existing = void 0;
          dbs.forEach(function (db) {
            if (dbId === db.id) {
              existing = db;
              return false;
            }
          });
          if (!existing) {
            return _this11.client.createDatabase({ id: dbId }, function (err, db) {
              if (err) {
                return reject(err);
              }
              return resolve(db);
            });
          }
          return resolve(existing);
        });
      });
    }
    return this.databases[dbId];
  },
  waitForCollection: function waitForCollection(mapper, opts) {
    var _this12 = this;

    opts || (opts = {});
    var collectionId = jsData.utils.isString(mapper) ? mapper : mapper.collection || underscore(mapper.name);
    var dbId = jsData.utils.isUndefined(opts.db) ? this.documentOpts.db : opts.db;
    return this.waitForDb(opts).then(function () {
      _this12.collections[dbId] = _this12.collections[dbId] || {};
      if (!_this12.collections[dbId][collectionId]) {
        _this12.collections[dbId][collectionId] = new jsData.utils.Promise(function (resolve, reject) {
          _this12.client.readCollections('dbs/' + dbId).toArray(function (err, collections) {
            if (err) {
              return reject(err);
            }
            var existing = void 0;
            collections.forEach(function (collection) {
              if (collectionId === collection.id) {
                existing = collection;
                return false;
              }
            });
            if (!existing) {
              return _this12.client.createCollection('dbs/' + dbId, { id: collectionId }, function (err, collection) {
                if (err) {
                  return reject(err);
                }
                return resolve(collection);
              });
            }
            return resolve(existing);
          });
        });
      }
      return _this12.collections[dbId][collectionId];
    });
  },


  /**
   * Return the number of records that match the selection query.
   *
   * @name DocumentDBAdapter#count
   * @method
   * @param {object} mapper the mapper.
   * @param {object} [query] Selection query.
   * @param {object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {object} [opts] Configuration options.
   * @param {object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {object} [opts.requestOpts] Options to pass to the DocumentClient request.
   * @return {Promise}
   */
  count: function count(mapper, query, opts) {
    var _this13 = this;

    opts || (opts = {});
    query || (query = {});

    return this.waitForCollection(mapper, opts).then(function () {
      return jsDataAdapter.Adapter.prototype.count.call(_this13, mapper, query, opts);
    });
  },


  /**
   * Create a new record.
   *
   * @name DocumentDBAdapter#create
   * @method
   * @param {object} mapper The mapper.
   * @param {object} props The record to be created.
   * @param {object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {object} [opts.requestOpts] Options to pass to the DocumentClient request.
   * @return {Promise}
   */
  create: function create(mapper, props, opts) {
    var _this14 = this;

    props || (props = {});
    opts || (opts = {});

    return this.waitForCollection(mapper, opts).then(function () {
      return jsDataAdapter.Adapter.prototype.create.call(_this14, mapper, props, opts);
    });
  },


  /**
   * Create multiple records in a single batch.
   *
   * @name DocumentDBAdapter#createMany
   * @method
   * @param {object} mapper The mapper.
   * @param {object} props The records to be created.
   * @param {object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {object} [opts.requestOpts] Options to pass to the DocumentClient request.
   * @return {Promise}
   */
  createMany: function createMany(mapper, props, opts) {
    var _this15 = this;

    props || (props = {});
    opts || (opts = {});

    return this.waitForCollection(mapper, opts).then(function () {
      return jsDataAdapter.Adapter.prototype.createMany.call(_this15, mapper, props, opts);
    });
  },


  /**
   * Destroy the record with the given primary key.
   *
   * @name DocumentDBAdapter#destroy
   * @method
   * @param {object} mapper The mapper.
   * @param {(string|number)} id Primary key of the record to destroy.
   * @param {object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {object} [opts.requestOpts] Options to pass to the DocumentClient request.
   * @return {Promise}
   */
  destroy: function destroy(mapper, id, opts) {
    var _this16 = this;

    opts || (opts = {});

    return this.waitForCollection(mapper, opts).then(function () {
      return jsDataAdapter.Adapter.prototype.destroy.call(_this16, mapper, id, opts);
    });
  },


  /**
   * Destroy the records that match the selection query.
   *
   * @name DocumentDBAdapter#destroyAll
   * @method
   * @param {object} mapper the mapper.
   * @param {object} [query] Selection query.
   * @param {object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {object} [opts] Configuration options.
   * @param {object} [opts.feedOpts] Options to pass to the DocumentClient#queryDocuments.
   * @param {object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {object} [opts.requestOpts] Options to pass to the DocumentClient request.
   * @return {Promise}
   */
  destroyAll: function destroyAll(mapper, query, opts) {
    var _this17 = this;

    opts || (opts = {});
    query || (query = {});

    return this.waitForCollection(mapper, opts).then(function () {
      return jsDataAdapter.Adapter.prototype.destroyAll.call(_this17, mapper, query, opts);
    });
  },


  /**
   * Retrieve the record with the given primary key.
   *
   * @name DocumentDBAdapter#find
   * @method
   * @param {object} mapper The mapper.
   * @param {(string|number)} id Primary key of the record to retrieve.
   * @param {object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {object} [opts.requestOpts] Options to pass to the DocumentClient request.
   * @param {string[]} [opts.with=[]] Relations to eager load.
   * @return {Promise}
   */
  find: function find(mapper, id, opts) {
    var _this18 = this;

    opts || (opts = {});

    return this.waitForCollection(mapper, opts).then(function () {
      return jsDataAdapter.Adapter.prototype.find.call(_this18, mapper, id, opts);
    });
  },


  /**
   * Retrieve the records that match the selection query.
   *
   * @name DocumentDBAdapter#findAll
   * @method
   * @param {object} mapper The mapper.
   * @param {object} [query] Selection query.
   * @param {object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {object} [opts] Configuration options.
   * @param {object} [opts.feedOpts] Options to pass to the DocumentClient#queryDocuments.
   * @param {object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {object} [opts.requestOpts] Options to pass to the DocumentClient request.
   * @param {string[]} [opts.with=[]] Relations to eager load.
   * @return {Promise}
   */
  findAll: function findAll(mapper, query, opts) {
    var _this19 = this;

    opts || (opts = {});
    query || (query = {});

    return this.waitForCollection(mapper, opts).then(function () {
      return jsDataAdapter.Adapter.prototype.findAll.call(_this19, mapper, query, opts);
    });
  },


  /**
   * Resolve the predicate function for the specified operator based on the
   * given options and this adapter's settings.
   *
   * @name DocumentDBAdapter#getOperator
   * @method
   * @param {string} operator The name of the operator.
   * @param {object} [opts] Configuration options.
   * @param {object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @return {*} The predicate function for the specified operator.
   */
  getOperator: function getOperator(operator, opts) {
    opts || (opts = {});
    opts.operators || (opts.operators = {});
    var ownOps = this.operators || {};
    return jsData.utils.isUndefined(opts.operators[operator]) ? ownOps[operator] : opts.operators[operator];
  },


  /**
   * Return the sum of the specified field of records that match the selection
   * query.
   *
   * @name DocumentDBAdapter#sum
   * @method
   * @param {object} mapper The mapper.
   * @param {string} field The field to sum.
   * @param {object} [query] Selection query.
   * @param {object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {object} [opts] Configuration options.
   * @param {object} [opts.feedOpts] Options to pass to the DocumentClient#queryDocuments.
   * @param {object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {object} [opts.requestOpts] Options to pass to the DocumentClient request.
   * @return {Promise}
   */
  sum: function sum(mapper, field, query, opts) {
    var _this20 = this;

    opts || (opts = {});
    query || (query = {});

    return this.waitForCollection(mapper, opts).then(function () {
      return jsDataAdapter.Adapter.prototype.sum.call(_this20, mapper, field, query, opts);
    });
  },


  /**
   * Apply the given update to the record with the specified primary key.
   *
   * @name DocumentDBAdapter#update
   * @method
   * @param {object} mapper The mapper.
   * @param {(string|number)} id The primary key of the record to be updated.
   * @param {object} props The update to apply to the record.
   * @param {object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {object} [opts.requestOpts] Options to pass to the DocumentClient request.
   * @return {Promise}
   */
  update: function update(mapper, id, props, opts) {
    var _this21 = this;

    props || (props = {});
    opts || (opts = {});

    return this.waitForCollection(mapper, opts).then(function () {
      return jsDataAdapter.Adapter.prototype.update.call(_this21, mapper, id, props, opts);
    });
  },


  /**
   * Apply the given update to all records that match the selection query.
   *
   * @name DocumentDBAdapter#updateAll
   * @method
   * @param {object} mapper The mapper.
   * @param {object} props The update to apply to the selected records.
   * @param {object} [query] Selection query.
   * @param {object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {object} [opts] Configuration options.
   * @param {object} [opts.feedOpts] Options to pass to the DocumentClient#queryDocuments.
   * @param {object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {object} [opts.requestOpts] Options to pass to the DocumentClient request.
   * @return {Promise}
   */
  updateAll: function updateAll(mapper, props, query, opts) {
    var _this22 = this;

    props || (props = {});
    query || (query = {});
    opts || (opts = {});

    return this.waitForCollection(mapper, opts).then(function () {
      return jsDataAdapter.Adapter.prototype.updateAll.call(_this22, mapper, props, query, opts);
    });
  },


  /**
   * Update the given records in a single batch.
   *
   * @name DocumentDBAdapter#updateMany
   * @method
   * @param {object} mapper The mapper.
   * @param {Object[]} records The records to update.
   * @param {object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {object} [opts.requestOpts] Options to pass to the DocumentClient request.
   * @return {Promise}
   */
  updateMany: function updateMany(mapper, records, opts) {
    var _this23 = this;

    records || (records = []);
    opts || (opts = {});

    return this.waitForCollection(mapper, opts).then(function () {
      return jsDataAdapter.Adapter.prototype.updateMany.call(_this23, mapper, records, opts);
    });
  }
});

/**
 * Details of the current version of the `js-data-documentdb` module.
 *
 * @example <caption>ES2015 modules import</caption>
 * import {version} from 'js-data-documentdb'
 * console.log(version.full)
 *
 * @example <caption>CommonJS import</caption>
 * var version = require('js-data-documentdb').version
 * console.log(version.full)
 *
 * @name module:js-data-documentdb.version
 * @type {object}
 * @property {string} version.full The full semver value.
 * @property {number} version.major The major version number.
 * @property {number} version.minor The minor version number.
 * @property {number} version.patch The patch version number.
 * @property {(string|boolean)} version.alpha The alpha version value,
 * otherwise `false` if the current version is not alpha.
 * @property {(string|boolean)} version.beta The beta version value,
 * otherwise `false` if the current version is not beta.
 */
var version = {
  full: '1.0.0-rc.1',
  major: 1,
  minor: 0,
  patch: 0
};

/**
 * {@link DocumentDBAdapter} class.
 *
 * @example <caption>ES2015 modules import</caption>
 * import {DocumentDBAdapter} from 'js-data-documentdb'
 * const adapter = new DocumentDBAdapter()
 *
 * @example <caption>CommonJS import</caption>
 * var DocumentDBAdapter = require('js-data-documentdb').DocumentDBAdapter
 * var adapter = new DocumentDBAdapter()
 *
 * @name module:js-data-documentdb.DocumentDBAdapter
 * @see DocumentDBAdapter
 * @type {Constructor}
 */

/**
 * Registered as `js-data-documentdb` in NPM.
 *
 * @example <caption>Install from NPM</caption>
 * npm i --save js-data-documentdb js-data documentdb
 *
 * @example <caption>ES2015 modules import</caption>
 * import { DocumentDBAdapter } from 'js-data-documentdb'
 * const adapter = new DocumentDBAdapter({
 *   documentOpts: {
 *     db: 'mydb',
 *     urlConnection: process.env.DOCUMENT_DB_ENDPOINT,
 *     auth: {
 *       masterKey: process.env.DOCUMENT_DB_KEY
 *     }
 *   }
 * })
 *
 * @example <caption>CommonJS import</caption>
 * var DocumentDBAdapter = require('js-data-documentdb').DocumentDBAdapter
 * var adapter = new DocumentDBAdapter({
 *   documentOpts: {
 *     db: 'mydb',
 *     urlConnection: process.env.DOCUMENT_DB_ENDPOINT,
 *     auth: {
 *       masterKey: process.env.DOCUMENT_DB_KEY
 *     }
 *   }
 * })
 *
 * @module js-data-documentdb
 */

/**
 * Create a subclass of this DocumentDBAdapter:
 * @example <caption>DocumentDBAdapter.extend</caption>
 * // Normally you would do: import {DocumentDBAdapter} from 'js-data-documentdb'
 * const JSDataDocumentDB = require('js-data-documentdb')
 * const { DocumentDBAdapter } = JSDataDocumentDB
 * console.log('Using JSDataDocumentDB v' + JSDataDocumentDB.version.full)
 *
 * // Extend the class using ES2015 class syntax.
 * class CustomDocumentDBAdapterClass extends DocumentDBAdapter {
 *   foo () { return 'bar' }
 *   static beep () { return 'boop' }
 * }
 * const customDocumentDBAdapter = new CustomDocumentDBAdapterClass({
 *   documentOpts: {
 *     db: 'mydb',
 *     urlConnection: process.env.DOCUMENT_DB_ENDPOINT,
 *     auth: {
 *       masterKey: process.env.DOCUMENT_DB_KEY
 *     }
 *   }
 * })
 * console.log(customDocumentDBAdapter.foo())
 * console.log(CustomDocumentDBAdapterClass.beep())
 *
 * // Extend the class using alternate method.
 * const OtherDocumentDBAdapterClass = DocumentDBAdapter.extend({
 *   foo () { return 'bar' }
 * }, {
 *   beep () { return 'boop' }
 * })
 * const otherDocumentDBAdapter = new OtherDocumentDBAdapterClass({
 *   documentOpts: {
 *     db: 'mydb',
 *     urlConnection: process.env.DOCUMENT_DB_ENDPOINT,
 *     auth: {
 *       masterKey: process.env.DOCUMENT_DB_KEY
 *     }
 *   }
 * })
 * console.log(otherDocumentDBAdapter.foo())
 * console.log(OtherDocumentDBAdapterClass.beep())
 *
 * // Extend the class, providing a custom constructor.
 * function AnotherDocumentDBAdapterClass () {
 *   DocumentDBAdapter.call(this)
 *   this.created_at = new Date().getTime()
 * }
 * DocumentDBAdapter.extend({
 *   constructor: AnotherDocumentDBAdapterClass,
 *   foo () { return 'bar' }
 * }, {
 *   beep () { return 'boop' }
 * })
 * const anotherDocumentDBAdapter = new AnotherDocumentDBAdapterClass({
 *   documentOpts: {
 *     db: 'mydb',
 *     urlConnection: process.env.DOCUMENT_DB_ENDPOINT,
 *     auth: {
 *       masterKey: process.env.DOCUMENT_DB_KEY
 *     }
 *   }
 * })
 * console.log(anotherDocumentDBAdapter.created_at)
 * console.log(anotherDocumentDBAdapter.foo())
 * console.log(AnotherDocumentDBAdapterClass.beep())
 *
 * @method DocumentDBAdapter.extend
 * @param {object} [props={}] Properties to add to the prototype of the
 * subclass.
 * @param {object} [props.constructor] Provide a custom constructor function
 * to be used as the subclass itself.
 * @param {object} [classProps={}] Static properties to add to the subclass.
 * @returns {Constructor} Subclass of this DocumentDBAdapter class.
 * @since 3.0.0
 */

exports.OPERATORS = OPERATORS;
exports.DocumentDBAdapter = DocumentDBAdapter;
exports.version = version;
//# sourceMappingURL=js-data-documentdb.js.map
