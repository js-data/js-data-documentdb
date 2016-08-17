import { utils } from 'js-data'
const guid = require('mout/random/guid')

function parseLink (link) {
  const parts = link.split('/')
  return {
    dbId: parts[1],
    collectionId: parts[3],
    documentId: parts[5]
  }
}

let dbs = {}
let collections = {}
let documents = {}

export const mockClient = {
  reset: function () {
    dbs = {}
    collections = {}
    documents = {}
  },
  readDatabases: function () {
    const dbsArray = Object.keys(dbs).map(function (dbLink) {
      return dbs[dbLink]
    })
    return {
      toArray: function (callback) {
        callback(null, dbsArray)
      }
    }
  },
  createDatabase: function (options, callback) {
    const dbLink = `dbs/${options.id}`
    const db = dbs[dbLink] = utils.plainCopy(options)
    collections[dbLink] = {}
    callback(null, db)
  },
  readCollections: function (dbLink) {
    const collectionsArray = Object.keys(collections[dbLink]).map(function (collLink) {
      return collections[collLink]
    })
    return {
      toArray: function (callback) {
        callback(null, collectionsArray)
      }
    }
  },
  createCollection: function (dbLink, options, callback) {
    const collLink = `${dbLink}/colls/${options.id}`
    const collection = collections[dbLink][collLink] = utils.plainCopy(options)
    collections[collLink] = {}
    callback(null, collection)
  },
  createDocument: function (collLink, document, options, callback) {
    const id = guid()
    const docLink = `${collLink}/docs/${id}`
    const created = utils.plainCopy(document)
    created.id = id
    collections[collLink][docLink] = created
    documents[docLink] = created
    callback(null, created)
  },
  readDocument: function (docLink, options, callback) {
    callback(null, documents[docLink])
  },
  replaceDocument: function (docLink, document, options, callback) {
    const ids = parseLink(docLink)
    collections[`dbs/${ids.dbId}/colls/${ids.collectionId}`][docLink] = document
    documents[docLink] = document
    callback(null, document)
  },
  deleteDocument: function (docLink, options, callback) {
    const ids = parseLink(docLink)
    delete collections[`dbs/${ids.dbId}/colls/${ids.collectionId}`][docLink]
    delete documents[docLink]
    callback(null)
  },
  queryDocuments: function (collLink, querySpec, options) {
    const docLinks = Object.keys(collections[collLink])
    const documentsArray = docLinks.map(function (docLink) {
      return documents[docLink]
    })

    return {
      toArray: function (callback) {
        callback(null, documentsArray)
      }
    }
  }
}
