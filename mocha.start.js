/*global assert:true */
'use strict'

// prepare environment for js-data-adapter-tests
import 'babel-polyfill'

import * as JSData from 'js-data'
import JSDataAdapterTests from './node_modules/js-data-adapter/dist/js-data-adapter-tests'
import * as JSDataDocumentDB from './src/index'

const assert = global.assert = JSDataAdapterTests.assert
global.sinon = JSDataAdapterTests.sinon

JSDataAdapterTests.init({
  debug: false,
  JSData: JSData,
  Adapter: JSDataDocumentDB.DocumentDBAdapter,
  adapterConfig: {
    documentOpts: {
      db: 'test',
      urlConnection: process.env.DOCUMENT_DB_ENDPOINT,
      auth: {
        masterKey: process.env.DOCUMENT_DB_KEY
      }
    }
  },
  // js-data-documentdb does NOT support these features
  xfeatures: [
    'findAllLikeOp',
    'filterOnRelations'
  ]
})

describe('exports', function () {
  it('should have correct exports', function () {
    assert(JSDataDocumentDB.DocumentDBAdapter)
    assert(JSDataDocumentDB.OPERATORS)
    assert(JSDataDocumentDB.OPERATORS['=='])
    assert(JSDataDocumentDB.version)
  })
})
