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
