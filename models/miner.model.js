const mongoose = require('mongoose')
const { toJSON, paginate } = require('./plugins')

const Schema = mongoose.Schema(
  {
    uniqueId: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true
    },
    address: {
      type: String,
      trim: true,
      lowercase: true
    },
    workerName: {
      type: String,
      trim: true
    },
    ip: {
      type: String
    },
    port: {
      type: Number
    },
    lastShare: {
      type: Date
    },
    status: {
      type: String,
      enum: ['online', 'offline'],
      default: 'offline'
    }
  },
  {
    timestamps: true
  }
)

// add plugin that converts mongoose to json
Schema.plugin(toJSON)
Schema.plugin(paginate)

const Miner = mongoose.model('Miner', Schema)

module.exports = Miner
