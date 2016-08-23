/*global assert:true */
'use strict'

// prepare environment for js-data-adapter-tests
import 'babel-polyfill'

import * as JSData from 'js-data'
import JSDataAdapterTests from './node_modules/js-data-adapter/dist/js-data-adapter-tests'
import * as JSDataDocumentDB from './src/index'

const assert = global.assert = JSDataAdapterTests.assert
global.sinon = JSDataAdapterTests.sinon

import { mockClient } from './test/documentdbMock'

const adapterConfig = {
  documentOpts: {
    db: 'test',
    urlConnection: process.env.DOCUMENT_DB_ENDPOINT,
    auth: {
      masterKey: process.env.DOCUMENT_DB_KEY
    }
  }
}

let usingMock = false

if (!process.env.DOCUMENT_DB_ENDPOINT && !process.env.DOCUMENT_DB_KEY) {
  console.log('DOCUMENT_DB_ENDPOINT and DOCUMENT_DB_KEY environment variables are missing, falling back to mock documentdb.')
  console.log('Not all methods can be tested')
  adapterConfig.client = mockClient
  usingMock = true
}

beforeEach(function () {
  if (usingMock) {
    mockClient.reset()
  }
})

const config = {
  debug: false,
  JSData: JSData,
  Adapter: JSDataDocumentDB.DocumentDBAdapter,
  adapterConfig: adapterConfig,
  // js-data-documentdb does NOT support these features
  xfeatures: [
    'findAllLikeOp',
    'filterOnRelations'
  ]
}

if (usingMock) {
  config.features = []
  delete config.xfeatures

  config.xmethods = [
    'count',
    'createMany',
    'destroy',
    'destroyAll',
    'find',
    'sum',
    'updateAll',
    'updateMany'
  ]
}

JSDataAdapterTests.init(config)

describe('exports', function () {
  it('should have correct exports', function () {
    assert(JSDataDocumentDB.DocumentDBAdapter)
    assert(JSDataDocumentDB.OPERATORS)
    assert(JSDataDocumentDB.OPERATORS['=='])
    assert(JSDataDocumentDB.version)
  })
})

describe('DocumentDBAdapter#getQuerySpec', function () {
  it('should allow select to be overridden', function () {
    const User = this.$$User
    const adapter = this.$$adapter
    let userId

    let props = { name: 'John' }
    assert.debug('findAll', User.name, { age: 30 })
    return adapter.findAll(User, { age: 30 })
      .then((users) => {
        assert.debug('found', User.name, users)
        assert.equal(users.length, 0, 'users.length')

        assert.debug('create', User.name, props)
        return adapter.create(User, props)
      })
      .then((user) => {
        assert.debug('created', User.name, user)
        userId = user[User.idAttribute]

        assert.debug('findAll', User.name, { name: 'John' })
        return adapter.findAll(User, { name: 'John' }, { select: 'user.id' })
      })
      .then((users2) => {
        assert.debug('found', User.name, users2)
        assert.objectsEqual(users2, [
          {
            id: users2[0].id
          }
        ], 'Only id was selected')

        assert.equal(users2.length, 1, 'users2.length')
        assert.equal(users2[0][User.idAttribute], userId, 'users2[0][User.idAttribute]')
        assert.equal(users2[0].name, undefined, 'name was not selected')
      })
  })
  it('should allow certain fields to be selected', function () {
    const User = this.$$User
    const adapter = this.$$adapter
    let userId

    let props = { name: 'John' }
    assert.debug('findAll', User.name, { age: 30 })
    return adapter.findAll(User, { age: 30 })
      .then((users) => {
        assert.debug('found', User.name, users)
        assert.equal(users.length, 0, 'users.length')

        assert.debug('create', User.name, props)
        return adapter.create(User, props)
      })
      .then((user) => {
        assert.debug('created', User.name, user)
        userId = user[User.idAttribute]

        assert.debug('findAll', User.name, { name: 'John' })
        return adapter.findAll(User, { name: 'John' }, { fields: ['id'] })
      })
      .then((users2) => {
        assert.debug('found', User.name, users2)
        assert.objectsEqual(users2, [
          {
            id: users2[0].id
          }
        ], 'Only id was selected')

        assert.equal(users2.length, 1, 'users2.length')
        assert.equal(users2[0][User.idAttribute], userId, 'users2[0][User.idAttribute]')
        assert.equal(users2[0].name, undefined, 'name was not selected')
      })
  })
})
