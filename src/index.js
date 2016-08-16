import {utils} from 'js-data'
import {
  Adapter,
  reserved
} from 'js-data-adapter'
import {DocumentClient} from 'documentdb'
import underscore from 'mout/string/underscore'

const R_OPTS_DEFAULTS = {
  db: 'test'
}
const INSERT_OPTS_DEFAULTS = {}
const UPDATE_OPTS_DEFAULTS = {}
const DELETE_OPTS_DEFAULTS = {}
const RUN_OPTS_DEFAULTS = {}

const checkIfNameExists = function (name, parameters) {
  let exists = false
  parameters.forEach(function (parameter) {
    if (parameter.name === name) {
      exists = true
      return false
    }
  })
  return exists
}

const addParameter = function (field, value, parameters) {
  const name = `@${field}`
  let newName = name
  let count = 1

  while (checkIfNameExists(newName, parameters)) {
    newName = name + count
    count++
  }
  parameters.push({
    name: newName,
    value
  })
  return newName
}

const equal = function (field, value, parameters, collectionId) {
  return `${collectionId}.${field} = ${addParameter(field, value, parameters)}`
}

const notEqual = function (field, value, parameters, collectionId) {
  return `${collectionId}.${field} != ${addParameter(field, value, parameters)}`
}

/**
 * Default predicate functions for the filtering operators.
 *
 * @name module:js-data-documentdb.OPERATORS
 * @property {Function} = Equality operator.
 * @property {Function} == Equality operator.
 * @property {Function} != Inequality operator.
 * @property {Function} > "Greater than" operator.
 * @property {Function} >= "Greater than or equal to" operator.
 * @property {Function} < "Less than" operator.
 * @property {Function} <= "Less than or equal to" operator.
 * @property {Function} isectEmpty Operator to test that the intersection
 * between two arrays is empty.
 * @property {Function} isectNotEmpty Operator to test that the intersection
 * between two arrays is NOT empty.
 * @property {Function} in Operator to test whether a value is found in the
 * provided array.
 * @property {Function} notIn Operator to test whether a value is NOT found in
 * the provided array.
 * @property {Function} contains Operator to test whether an array contains the
 * provided value.
 * @property {Function} notContains Operator to test whether an array does NOT
 * contain the provided value.
 */
export const OPERATORS = {
  '=': equal,
  '==': equal,
  '===': equal,
  '!=': notEqual,
  '!==': notEqual,
  '>': function (field, value, parameters, collectionId) {
    return `${collectionId}.${field} > ${addParameter(field, value, parameters)}`
  },
  '>=': function (field, value, parameters, collectionId) {
    return `${collectionId}.${field} >= ${addParameter(field, value, parameters)}`
  },
  '<': function (field, value, parameters, collectionId) {
    return `${collectionId}.${field} < ${addParameter(field, value, parameters)}`
  },
  '<=': function (field, value, parameters, collectionId) {
    return `${collectionId}.${field} <= ${addParameter(field, value, parameters)}`
  },
  'in': function (field, value, parameters, collectionId) {
    return `${collectionId}.${field} IN ${addParameter(field, value, parameters)}`
  },
  'notIn': function (field, value, parameters, collectionId) {
    return `${collectionId}.${field} NOT IN ${addParameter(field, value, parameters)}`
  }
}

Object.freeze(OPERATORS)

/**
 * DocumentDBAdapter class.
 *
 * @example
 * // Use Container instead of DataStore on the server
 * import {Container} from 'js-data'
 * import {DocumentDBAdapter} from 'js-data-documentdb'
 *
 * // Create a store to hold your Mappers
 * const store = new Container()
 *
 * // Create an instance of DocumentDBAdapter with default settings
 * const adapter = new DocumentDBAdapter()
 *
 * // Mappers in "store" will use the DocumentDB adapter by default
 * store.registerAdapter('documentdb', adapter, { default: true })
 *
 * // Create a Mapper that maps to a "user" table
 * store.defineMapper('user')
 *
 * @class DocumentDBAdapter
 * @extends Adapter
 * @param {Object} [opts] Configuration options.
 * @param {boolean} [opts.debug=false] See {@link Adapter#debug}.
 * @param {Object} [opts.deleteOpts={}] See {@link DocumentDBAdapter#deleteOpts}.
 * @param {Object} [opts.insertOpts={}] See {@link DocumentDBAdapter#insertOpts}.
 * @param {Object} [opts.operators={@link module:js-data-documentdb.OPERATORS}] See {@link DocumentDBAdapter#operators}.
 * @param {Object} [opts.r] See {@link DocumentDBAdapter#r}.
 * @param {boolean} [opts.raw=false] See {@link Adapter#raw}.
 * @param {Object} [opts.documentOpts={}] See {@link DocumentDBAdapter#documentOpts}.
 * @param {Object} [opts.runOpts={}] See {@link DocumentDBAdapter#runOpts}.
 * @param {Object} [opts.updateOpts={}] See {@link DocumentDBAdapter#updateOpts}.
 */
export function DocumentDBAdapter (opts) {
  utils.classCallCheck(this, DocumentDBAdapter)
  opts || (opts = {})

  // Setup non-enumerable properties
  Object.defineProperties(this, {
    /**
     * The DocumentDB client used by this adapter. Use this directly when you
     * need to write custom queries.
     *
     * @example <caption>Use default instance.</caption>
     * import {DocumentDBAdapter} from 'js-data-documentdb'
     * const adapter = new DocumentDBAdapter()
     * adapter.client.createDatabase('foo', function (err, db) {...})
     *
     * @example <caption>Configure default instance.</caption>
     * import {DocumentDBAdapter} from 'js-data-documentdb'
     * const adapter = new DocumentDBAdapter({
     *   documentOpts: {
     *     urlConnection: 'your-endpoint',
     *     auth: {
     *       masterKey: '1asdfa8s0dfa9sdf98'
     *     }
     *   }
     * })
     * adapter.client.createDatabase('foo', function (err, db) {...})
     *
     * @example <caption>Provide a custom instance.</caption>
     * import {DocumentClient} from 'documentdb'
     * import {DocumentDBAdapter} from 'js-data-documentdb'
     * const client = new DocumentClient(...)
     * const adapter = new DocumentDBAdapter({
     *   client: client
     * })
     * adapter.client.createDatabase('foo', function (err, db) {...})
     *
     * @name DocumentDBAdapter#r
     * @type {Object}
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
  })

  Adapter.call(this, opts)

  /**
   * Default options to pass to r#insert.
   *
   * @name DocumentDBAdapter#insertOpts
   * @type {Object}
   * @default {}
   */
  this.insertOpts || (this.insertOpts = {})
  utils.fillIn(this.insertOpts, INSERT_OPTS_DEFAULTS)

  /**
   * Default options to pass to r#update.
   *
   * @name DocumentDBAdapter#updateOpts
   * @type {Object}
   * @default {}
   */
  this.updateOpts || (this.updateOpts = {})
  utils.fillIn(this.updateOpts, UPDATE_OPTS_DEFAULTS)

  /**
   * Default options to pass to r#delete.
   *
   * @name DocumentDBAdapter#deleteOpts
   * @type {Object}
   * @default {}
   */
  this.deleteOpts || (this.deleteOpts = {})
  utils.fillIn(this.deleteOpts, DELETE_OPTS_DEFAULTS)

  /**
   * Default options to pass to r#run.
   *
   * @name DocumentDBAdapter#runOpts
   * @type {Object}
   * @default {}
   */
  this.runOpts || (this.runOpts = {})
  utils.fillIn(this.runOpts, RUN_OPTS_DEFAULTS)

  /**
   * Override the default predicate functions for the specified operators.
   *
   * @name DocumentDBAdapter#operators
   * @type {Object}
   * @default {}
   */
  this.operators || (this.operators = {})
  utils.fillIn(this.operators, OPERATORS)

  /**
   * Options to pass to a new `DocumentClient` instance, if one was not provided
   * at {@link DocumentDBAdapter#client}. See the [DocumentClient API][readme]
   * for instance options.
   *
   * [readme]: http://azure.github.io/azure-documentdb-node/DocumentClient.html
   *
   * @name DocumentDBAdapter#documentOpts
   * @see http://azure.github.io/azure-documentdb-node/DocumentClient.html
   * @type {Object}
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
  this.documentOpts || (this.documentOpts = {})
  utils.fillIn(this.documentOpts, R_OPTS_DEFAULTS)

  if (!this.client) {
    this.client = new DocumentClient(
      this.documentOpts.urlConnection,
      this.documentOpts.auth,
      this.documentOpts.connectionPolicy,
      this.documentOpts.consistencyLevel
    )
  }
}

Adapter.extend({
  constructor: DocumentDBAdapter,

  _count (mapper, query, opts) {
    opts || (opts = {})
    query || (query = {})

    const collectionId = mapper.collection || underscore(mapper.name)
    opts.select = `${collectionId}.${mapper.idAttribute}`

    return this._findAll(mapper, query, opts)
      .then((result) => [result[0].length, { found: result[0].length }])
  },

  _create (mapper, props, opts) {
    props || (props = {})
    opts || (opts = {})

    const createOpts = this.getOpt('createOpts', opts)

    return new utils.Promise((resolve, reject) => {
      this.client.createDocument(
        this.getCollectionLink(mapper, opts),
        props,
        createOpts,
        (err, document) => {
          if (err) {
            return reject(err)
          }
          return resolve([document, { created: 1 }])
        }
      )
    })
  },

  _createMany (mapper, props, opts) {
    props || (props = {})
    opts || (opts = {})

    const insertOpts = this.getOpt('insertOpts', opts)
    insertOpts.returnChanges = true

    return utils.Promise.all(props.map((record) => this._create(mapper, record, opts)))
      .then((results) => results.map((result) => result[0]))
      .then((results) => [results, { created: results.length }])
  },

  _destroy (mapper, id, opts) {
    opts || (opts = {})

    const collLink = this.getCollectionLink(mapper, opts)
    const deleteOpts = this.getOpt('deleteOpts', opts)

    return new utils.Promise((resolve, reject) => {
      this.client.deleteDocument(`${collLink}/docs/${id}`, deleteOpts, (err) => {
        if (err) {
          if (err.code === 404) {
            return resolve([undefined, { deleted: 0 }])
          }
          return reject(err)
        }
        return resolve([undefined, { deleted: 1 }])
      })
    })
  },

  _destroyAll (mapper, query, opts) {
    query || (query = {})
    opts || (opts = {})

    const destroyFn = (document) => this._destroy(mapper, document.id, opts)

    return this._findAll(mapper, query, opts)
      .then((results) => utils.Promise.all(results[0].map(destroyFn)))
      .then((results) => [undefined, { deleted: results.length }])
  },

  _find (mapper, id, opts) {
    opts || (opts = {})

    const docLink = `${this.getCollectionLink(mapper, opts)}/docs/${id}`

    return new utils.Promise((resolve, reject) => {
      this.client.readDocument(docLink, (err, document) => {
        if (err) {
          if (err.code === 404) {
            return resolve([undefined, { found: 0 }])
          }
          return reject(err)
        }
        return resolve([document, { found: document ? 1 : 0 }])
      })
    })
  },

  _findAll (mapper, query, opts) {
    opts || (opts = {})
    query || (query = {})

    const collLink = this.getCollectionLink(mapper, opts)
    const queryDocumentsOpts = this.getOpt('queryDocumentsOpts', opts)

    const querySpec = this.getQuerySpec(mapper, query, opts)

    return new utils.Promise((resolve, reject) => {
      this.client.queryDocuments(collLink, querySpec, queryDocumentsOpts).toArray((err, documents) => {
        if (err) {
          return reject(err)
        }
        return resolve([documents, { found: documents.length }])
      })
    })
  },

  _sum (mapper, field, query, opts) {
    if (!utils.isString(field)) {
      throw new Error('field must be a string!')
    }
    opts || (opts = {})
    query || (query = {})

    const collectionId = mapper.collection || underscore(mapper.name)
    opts.select = `${collectionId}.${mapper.idAttribute}, ${collectionId}.${field}`

    return this._findAll(mapper, query, opts)
      .then((result) => {
        const sum = result[0].reduce((sum, cur) => sum + cur[field], 0)
        return [sum, { found: result[0].length }]
      })
  },

  _update (mapper, id, props, opts) {
    props || (props = {})
    opts || (opts = {})

    const updateOpts = this.getOpt('updateOpts', opts)
    updateOpts.returnChanges = true

    return this.getCollectionLink(mapper, opts)
      .get(id)
      .update(props, updateOpts)
      .run(this.getOpt('runOpts', opts))
      .then((cursor) => {
        let record
        this._handleErrors(cursor)
        if (cursor && cursor.changes && cursor.changes.length && cursor.changes[0].new_val) {
          record = cursor.changes[0].new_val
        } else {
          throw new Error('Not Found')
        }
        return [record, cursor]
      })
  },

  _updateAll (mapper, props, query, opts) {
    props || (props = {})
    query || (query = {})
    opts || (opts = {})

    const updateOpts = this.getOpt('updateOpts', opts)
    updateOpts.returnChanges = true

    return this.filterSequence(this.getCollectionLink(mapper, opts), query)
      .update(props, updateOpts)
      .run(this.getOpt('runOpts', opts))
      .then((cursor) => {
        let records = []
        this._handleErrors(cursor)
        if (cursor && cursor.changes && cursor.changes.length) {
          records = cursor.changes.map((change) => change.new_val)
        }
        return [records, cursor]
      })
  },

  _updateMany (mapper, records, opts) {
    records || (records = [])
    opts || (opts = {})

    const insertOpts = this.getOpt('insertOpts', opts)
    insertOpts.returnChanges = true
    insertOpts.conflict = 'update'

    return this.getCollectionLink(mapper, opts)
      .insert(records, insertOpts)
      .run(this.getOpt('runOpts', opts))
      .then((cursor) => {
        records = []
        this._handleErrors(cursor)
        if (cursor && cursor.changes && cursor.changes.length) {
          records = cursor.changes.map((change) => change.new_val)
        }
        return [records, cursor]
      })
  },

  _applyWhereFromObject (where) {
    const fields = []
    const ops = []
    const predicates = []
    utils.forOwn(where, (clause, field) => {
      if (!utils.isObject(clause)) {
        clause = {
          '==': clause
        }
      }
      utils.forOwn(clause, (expr, op) => {
        fields.push(field)
        ops.push(op)
        predicates.push(expr)
      })
    })
    return {
      fields,
      ops,
      predicates
    }
  },

  _applyWhereFromArray (where) {
    const groups = []
    where.forEach((_where, i) => {
      if (utils.isString(_where)) {
        return
      }
      const prev = where[i - 1]
      const parser = utils.isArray(_where) ? this._applyWhereFromArray : this._applyWhereFromObject
      const group = parser.call(this, _where)
      if (prev === 'or') {
        group.isOr = true
      }
      groups.push(group)
    })
    groups.isArray = true
    return groups
  },

  _testObjectGroup (sql, group, parameters, collectionId, opts) {
    let i
    const fields = group.fields
    const ops = group.ops
    const predicates = group.predicates
    const len = ops.length
    for (i = 0; i < len; i++) {
      let op = ops[i]
      const isOr = op.charAt(0) === '|'
      op = isOr ? op.substr(1) : op
      const predicateFn = this.getOperator(op, opts)
      if (predicateFn) {
        const subSql = predicateFn(fields[i], predicates[i], parameters, collectionId)
        if (isOr) {
          sql = sql ? `${sql} OR (${subSql})` : subSql
        } else {
          sql = sql ? `${sql} AND (${subSql})` : subSql
        }
      } else {
        throw new Error(`Operator ${op} not supported!`)
      }
    }
    return sql
  },

  _testArrayGroup (sql, groups, parameters, collectionId, opts) {
    let i
    const len = groups.length
    for (i = 0; i < len; i++) {
      const group = groups[i]
      let subQuery
      if (group.isArray) {
        subQuery = this._testArrayGroup(sql, group, parameters, collectionId, opts)
      } else {
        subQuery = this._testObjectGroup(null, group, parameters, collectionId, opts)
      }
      if (groups[i - 1]) {
        if (group.isOr) {
          sql += ` OR (${subQuery})`
        } else {
          sql += ` AND (${subQuery})`
        }
      } else {
        sql = sql ? sql + ` AND (${subQuery})` : subQuery
      }
    }
    return sql
  },

  /**
   * Apply the specified selection query to the provided RQL sequence.
   *
   * @name DocumentDBAdapter#getQuerySpec
   * @method
   * @param {Object} mapper The mapper.
   * @param {Object} [query] Selection query.
   * @param {Object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.operators] Override the default predicate functions
   * for specified operators.
   */
  getQuerySpec (mapper, query, opts) {
    query = utils.plainCopy(query || {})
    opts || (opts = {})
    opts.operators || (opts.operators = {})
    query.where || (query.where = {})
    query.orderBy || (query.orderBy = query.sort)
    query.orderBy || (query.orderBy = [])
    query.skip || (query.skip = query.offset)
    const collectionId = mapper.collection || underscore(mapper.name)

    const select = opts.select || '*'
    let sql = `${select} FROM ${collectionId}`
    let whereSql
    const parameters = []

    // Transform non-keyword properties to "where" clause configuration
    utils.forOwn(query, (config, keyword) => {
      if (reserved.indexOf(keyword) === -1 && utils.isObject(query.where)) {
        if (utils.isObject(config)) {
          query.where[keyword] = config
        } else {
          query.where[keyword] = {
            '==': config
          }
        }
        delete query[keyword]
      }
    })

    // Filter
    let groups

    if (utils.isObject(query.where) && Object.keys(query.where).length !== 0) {
      groups = this._applyWhereFromArray([query.where])
    } else if (utils.isArray(query.where)) {
      groups = this._applyWhereFromArray(query.where)
    }

    if (groups) {
      whereSql = this._testArrayGroup(null, groups, parameters, collectionId, opts)
    }

    if (whereSql) {
      sql = `${sql} WHERE ${whereSql}`
    }

    // Sort
    if (query.orderBy) {
      if (utils.isString(query.orderBy)) {
        query.orderBy = [
          [query.orderBy, 'asc']
        ]
      }
      let orderBySql = ''
      for (var i = 0; i < query.orderBy.length; i++) {
        if (utils.isString(query.orderBy[i])) {
          query.orderBy[i] = [query.orderBy[i], 'asc']
        }
        const subOrderBySql = (query.orderBy[i][1] || '').toUpperCase() === 'DESC' ? `${collectionId}.${query.orderBy[i][0]} DESC` : `${collectionId}.${query.orderBy[i][0]}`
        if (orderBySql) {
          orderBySql = `${orderBySql}, ${subOrderBySql}`
        } else {
          orderBySql = subOrderBySql
        }
      }
      if (orderBySql) {
        orderBySql = `ORDER BY ${orderBySql}`
      }
    }

    // Offset
    // if (query.skip) {
    //   sql += ` SKIP ${+query.skip}`
    // }

    // Limit
    if (query.limit) {
      sql = `TOP ${+query.limit} ${sql}`
    }

    // console.log(`sql: "${sql}"`)
    // console.log('parameters', JSON.stringify(parameters, null, 2))
    return {
      query: `SELECT ${sql}`,
      parameters
    }
  },

  getDbLink (opts) {
    return `dbs/${opts.db === undefined ? this.documentOpts.db : opts.db}`
  },

  getCollectionLink (mapper, opts) {
    return `${this.getDbLink(opts)}/colls/${mapper.collection || underscore(mapper.name)}`
  },

  waitForDb (opts) {
    opts || (opts = {})
    const dbId = utils.isUndefined(opts.db) ? this.documentOpts.db : opts.db
    if (!this.databases[dbId]) {
      this.databases[dbId] = new utils.Promise((resolve, reject) => {
        this.client.readDatabases().toArray((err, dbs) => {
          if (err) {
            return reject(err)
          }
          let existing
          dbs.forEach((db) => {
            if (dbId === db.id) {
              existing = db
              return false
            }
          })
          if (!existing) {
            return this.client.createDatabase({ id: dbId }, (err, db) => {
              if (err) {
                return reject(err)
              }
              return resolve(db)
            })
          }
          return resolve(existing)
        })
      })
    }
    return this.databases[dbId]
  },

  waitForCollection (mapper, opts) {
    opts || (opts = {})
    const collectionId = utils.isString(mapper) ? mapper : (mapper.collection || underscore(mapper.name))
    let dbId = utils.isUndefined(opts.db) ? this.documentOpts.db : opts.db
    return this.waitForDb(opts).then(() => {
      this.collections[dbId] = this.collections[dbId] || {}
      if (!this.collections[dbId][collectionId]) {
        this.collections[dbId][collectionId] = new utils.Promise((resolve, reject) => {
          this.client.readCollections(`dbs/${dbId}`).toArray((err, collections) => {
            if (err) {
              return reject(err)
            }
            let existing
            collections.forEach((collection) => {
              if (collectionId === collection.id) {
                existing = collection
                return false
              }
            })
            if (!existing) {
              return this.client.createCollection(`dbs/${dbId}`, { id: collectionId }, (err, collection) => {
                if (err) {
                  return reject(err)
                }
                return resolve(collection)
              })
            }
            return resolve(existing)
          })
        })
      }
      return this.collections[dbId][collectionId]
    })
  },

  waitForIndex (table, index, opts) {
    opts || (opts = {})
    // let db = utils.isUndefined(opts.db) ? this.documentOpts.db : opts.db
    return this.waitForDb(opts).then(() => this.waitForCollection(table, opts)).then(() => {
      // this.indices[db] = this.indices[db] || {}
      // this.indices[db][table] = this.indices[db][table] || {}
      // if (!this.collections[db][table][index]) {
      //   this.collections[db][table][index] = this.r.branch(this.r.db(db).table(table).indexList().contains(index), true, this.r.db(db).table(table).indexCreate(index)).run().then(() => {
      //     return this.r.db(db).table(table).indexWait(index).run()
      //   })
      // }
      // return this.collections[db][table][index]
    })
  },

  /**
   * Return the number of records that match the selection query.
   *
   * @name DocumentDBAdapter#count
   * @method
   * @param {Object} mapper the mapper.
   * @param {Object} [query] Selection query.
   * @param {Object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {Object} [opts.runOpts] Options to pass to r#run.
   * @return {Promise}
   */
  count (mapper, query, opts) {
    opts || (opts = {})
    query || (query = {})

    return this.waitForCollection(mapper, opts)
      .then(() => Adapter.prototype.count.call(this, mapper, query, opts))
  },

  /**
   * Create a new record.
   *
   * @name DocumentDBAdapter#create
   * @method
   * @param {Object} mapper The mapper.
   * @param {Object} props The record to be created.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.insertOpts] Options to pass to r#insert.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {Object} [opts.runOpts] Options to pass to r#run.
   * @return {Promise}
   */
  create (mapper, props, opts) {
    props || (props = {})
    opts || (opts = {})

    return this.waitForCollection(mapper, opts)
      .then(() => Adapter.prototype.create.call(this, mapper, props, opts))
  },

  /**
   * Create multiple records in a single batch.
   *
   * @name DocumentDBAdapter#createMany
   * @method
   * @param {Object} mapper The mapper.
   * @param {Object} props The records to be created.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.insertOpts] Options to pass to r#insert.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {Object} [opts.runOpts] Options to pass to r#run.
   * @return {Promise}
   */
  createMany (mapper, props, opts) {
    props || (props = {})
    opts || (opts = {})

    return this.waitForCollection(mapper, opts)
      .then(() => Adapter.prototype.createMany.call(this, mapper, props, opts))
  },

  /**
   * Destroy the record with the given primary key.
   *
   * @name DocumentDBAdapter#destroy
   * @method
   * @param {Object} mapper The mapper.
   * @param {(string|number)} id Primary key of the record to destroy.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.deleteOpts] Options to pass to r#delete.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {Object} [opts.runOpts] Options to pass to r#run.
   * @return {Promise}
   */
  destroy (mapper, id, opts) {
    opts || (opts = {})

    return this.waitForCollection(mapper, opts)
      .then(() => Adapter.prototype.destroy.call(this, mapper, id, opts))
  },

  /**
   * Destroy the records that match the selection query.
   *
   * @name DocumentDBAdapter#destroyAll
   * @method
   * @param {Object} mapper the mapper.
   * @param {Object} [query] Selection query.
   * @param {Object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.deleteOpts] Options to pass to r#delete.
   * @param {Object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {Object} [opts.runOpts] Options to pass to r#run.
   * @return {Promise}
   */
  destroyAll (mapper, query, opts) {
    opts || (opts = {})
    query || (query = {})

    return this.waitForCollection(mapper, opts)
      .then(() => Adapter.prototype.destroyAll.call(this, mapper, query, opts))
  },

  /**
   * Retrieve the record with the given primary key.
   *
   * @name DocumentDBAdapter#find
   * @method
   * @param {Object} mapper The mapper.
   * @param {(string|number)} id Primary key of the record to retrieve.
   * @param {Object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {Object} [opts.runOpts] Options to pass to r#run.
   * @param {string[]} [opts.with=[]] Relations to eager load.
   * @return {Promise}
   */
  find (mapper, id, opts) {
    opts || (opts = {})
    opts.with || (opts.with = [])

    const relationList = mapper.relationList || []
    let tasks = [this.waitForCollection(mapper, opts)]

    relationList.forEach((def) => {
      const relationName = def.relation
      const relationDef = def.getRelation()
      if (!opts.with || opts.with.indexOf(relationName) === -1) {
        return
      }
      if (def.foreignKey && def.type !== 'belongsTo') {
        if (def.type === 'belongsTo') {
          tasks.push(this.waitForIndex(mapper.table || underscore(mapper.name), def.foreignKey, opts))
        } else {
          tasks.push(this.waitForIndex(relationDef.table || underscore(relationDef.name), def.foreignKey, opts))
        }
      }
    })
    return Promise.all(tasks).then(() => Adapter.prototype.find.call(this, mapper, id, opts))
  },

  /**
   * Retrieve the records that match the selection query.
   *
   * @name DocumentDBAdapter#findAll
   * @method
   * @param {Object} mapper The mapper.
   * @param {Object} [query] Selection query.
   * @param {Object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {Object} [opts.runOpts] Options to pass to r#run.
   * @param {string[]} [opts.with=[]] Relations to eager load.
   * @return {Promise}
   */
  findAll (mapper, query, opts) {
    opts || (opts = {})
    opts.with || (opts.with = [])
    query || (query = {})

    const relationList = mapper.relationList || []
    let tasks = [this.waitForCollection(mapper, opts)]

    relationList.forEach((def) => {
      const relationName = def.relation
      const relationDef = def.getRelation()
      if (!opts.with || opts.with.indexOf(relationName) === -1) {
        return
      }
      if (def.foreignKey && def.type !== 'belongsTo') {
        if (def.type === 'belongsTo') {
          tasks.push(this.waitForIndex(mapper.table || underscore(mapper.name), def.foreignKey, opts))
        } else {
          tasks.push(this.waitForIndex(relationDef.table || underscore(relationDef.name), def.foreignKey, opts))
        }
      }
    })
    return Promise.all(tasks).then(() => Adapter.prototype.findAll.call(this, mapper, query, opts))
  },

  /**
   * Resolve the predicate function for the specified operator based on the
   * given options and this adapter's settings.
   *
   * @name DocumentDBAdapter#getOperator
   * @method
   * @param {string} operator The name of the operator.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @return {*} The predicate function for the specified operator.
   */
  getOperator (operator, opts) {
    opts || (opts = {})
    opts.operators || (opts.operators = {})
    let ownOps = this.operators || {}
    return utils.isUndefined(opts.operators[operator]) ? ownOps[operator] : opts.operators[operator]
  },

  /**
   * Return the sum of the specified field of records that match the selection
   * query.
   *
   * @name DocumentDBAdapter#sum
   * @method
   * @param {Object} mapper The mapper.
   * @param {string} field The field to sum.
   * @param {Object} [query] Selection query.
   * @param {Object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {Object} [opts.runOpts] Options to pass to r#run.
   * @return {Promise}
   */
  sum (mapper, field, query, opts) {
    opts || (opts = {})
    query || (query = {})

    return this.waitForCollection(mapper, opts)
      .then(() => Adapter.prototype.sum.call(this, mapper, field, query, opts))
  },

  /**
   * Apply the given update to the record with the specified primary key.
   *
   * @name DocumentDBAdapter#update
   * @method
   * @param {Object} mapper The mapper.
   * @param {(string|number)} id The primary key of the record to be updated.
   * @param {Object} props The update to apply to the record.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.updateOpts] Options to pass to r#update.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {Object} [opts.runOpts] Options to pass to r#run.
   * @return {Promise}
   */
  update (mapper, id, props, opts) {
    props || (props = {})
    opts || (opts = {})

    return this.waitForCollection(mapper, opts)
      .then(() => Adapter.prototype.update.call(this, mapper, id, props, opts))
  },

  /**
   * Apply the given update to all records that match the selection query.
   *
   * @name DocumentDBAdapter#updateAll
   * @method
   * @param {Object} mapper The mapper.
   * @param {Object} props The update to apply to the selected records.
   * @param {Object} [query] Selection query.
   * @param {Object} [query.where] Filtering criteria.
   * @param {string|Array} [query.orderBy] Sorting criteria.
   * @param {string|Array} [query.sort] Same as `query.sort`.
   * @param {number} [query.limit] Limit results.
   * @param {number} [query.skip] Offset results.
   * @param {number} [query.offset] Same as `query.skip`.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.operators] Override the default predicate functions
   * for specified operators.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {Object} [opts.runOpts] Options to pass to r#run.
   * @param {Object} [opts.updateOpts] Options to pass to r#update.
   * @return {Promise}
   */
  updateAll (mapper, props, query, opts) {
    props || (props = {})
    query || (query = {})
    opts || (opts = {})

    return this.waitForCollection(mapper, opts)
      .then(() => Adapter.prototype.updateAll.call(this, mapper, props, query, opts))
  },

  /**
   * Update the given records in a single batch.
   *
   * @name DocumentDBAdapter#updateMany
   * @method
   * @param {Object} mapper The mapper.
   * @param {Object[]} records The records to update.
   * @param {Object} [opts] Configuration options.
   * @param {Object} [opts.insertOpts] Options to pass to r#insert.
   * @param {boolean} [opts.raw=false] Whether to return a more detailed
   * response object.
   * @param {Object} [opts.runOpts] Options to pass to r#run.
   * @return {Promise}
   */
  updateMany (mapper, records, opts) {
    records || (records = [])
    opts || (opts = {})

    return this.waitForCollection(mapper, opts)
      .then(() => Adapter.prototype.updateMany.call(this, mapper, records, opts))
  }
})

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
 * @type {Object}
 * @property {string} version.full The full semver value.
 * @property {number} version.major The major version number.
 * @property {number} version.minor The minor version number.
 * @property {number} version.patch The patch version number.
 * @property {(string|boolean)} version.alpha The alpha version value,
 * otherwise `false` if the current version is not alpha.
 * @property {(string|boolean)} version.beta The beta version value,
 * otherwise `false` if the current version is not beta.
 */
export const version = '<%= version %>'

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
 * import {DocumentDBAdapter} from 'js-data-documentdb'
 * const adapter = new DocumentDBAdapter()
 *
 * @example <caption>CommonJS import</caption>
 * var DocumentDBAdapter = require('js-data-documentdb').DocumentDBAdapter
 * var adapter = new DocumentDBAdapter()
 *
 * @module js-data-documentdb
 */

/**
 * Create a subclass of this DocumentDBAdapter:
 * @example <caption>DocumentDBAdapter.extend</caption>
 * // Normally you would do: import {DocumentDBAdapter} from 'js-data-documentdb'
 * const JSDataDocumentDB = require('js-data-documentdb')
 * const {DocumentDBAdapter} = JSDataDocumentDB
 * console.log('Using JSDataDocumentDB v' + JSDataDocumentDB.version.full)
 *
 * // Extend the class using ES2015 class syntax.
 * class CustomDocumentDBAdapterClass extends DocumentDBAdapter {
 *   foo () { return 'bar' }
 *   static beep () { return 'boop' }
 * }
 * const customDocumentDBAdapter = new CustomDocumentDBAdapterClass()
 * console.log(customDocumentDBAdapter.foo())
 * console.log(CustomDocumentDBAdapterClass.beep())
 *
 * // Extend the class using alternate method.
 * const OtherDocumentDBAdapterClass = DocumentDBAdapter.extend({
 *   foo () { return 'bar' }
 * }, {
 *   beep () { return 'boop' }
 * })
 * const otherDocumentDBAdapter = new OtherDocumentDBAdapterClass()
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
 * const anotherDocumentDBAdapter = new AnotherDocumentDBAdapterClass()
 * console.log(anotherDocumentDBAdapter.created_at)
 * console.log(anotherDocumentDBAdapter.foo())
 * console.log(AnotherDocumentDBAdapterClass.beep())
 *
 * @method DocumentDBAdapter.extend
 * @param {Object} [props={}] Properties to add to the prototype of the
 * subclass.
 * @param {Object} [props.constructor] Provide a custom constructor function
 * to be used as the subclass itself.
 * @param {Object} [classProps={}] Static properties to add to the subclass.
 * @returns {Constructor} Subclass of this DocumentDBAdapter class.
 * @since 3.0.0
 */
