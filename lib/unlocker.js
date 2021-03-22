const async = require('async')

const logger = require('./logger')

const config = require('../config')

const { Block } = require('../models')

function unlocker () {
  async.waterfall([

    // Get all block candidates
    function (callback) {
      Block.find({}, (err, blocks) => {
        if (err) {
          logger('error', 'unlocker', `Error trying to get pending blocks from database ${[err]}`)
          callback(true)
        }
        if (blocks.length === 0) {
          logger('info', 'unlocker', 'No blocks candidates in database')
          callback(true)
        }
      })
    }

  ])
}
