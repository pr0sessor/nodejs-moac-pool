const moment = require('moment')
const deasync = require('deasync')
const http = require('http').createServer()
const io = require('socket.io')(http)

const logger = require('./logger')
const config = require('../config')

const { Miner, Round, Hashrate, Block } = require('../models')

io.on('connection', (socket) => {
  socket.on('miner_connect', (data) => {
    Miner.findOne({ address: data.address, workerName: data.workerName }, (err, res) => {
      if (err) logger('error', 'mongo', err.message)
      if (!res) {
        Miner.create(data)
      }
    })
  })
  socket.on('miner_disconnect', (data) => {
    Miner.findOne({ uniqueId: data.uniqueId }, (err, res) => {
      if (err) logger('error', 'mongo', err.message)
      if (res) {
        Object.assign(res, {
          status: 'offline'
        }).save()
      }
    })
  })
  socket.on('share', (data) => {
    Round.create(data)
    Hashrate.create(data)
  })
  socket.on('block', (data) => {
    Block.create(data)
  })
  socket.on('immature', (data) => {
    let rounds = null
    Round.find({}, (err, res) => {
      if (err) return false
      rounds = res
    })
    deasync.loopWhile(() => { return !rounds })
    const tmpRounds = []
    rounds.forEach(round => {
      if (!tmpRounds[round.address]) tmpRounds[round.address] = round.difficulty
      else tmpRounds[round.address] = tmpRounds[round.address].add(round.difficulty)
    })
    console.log(tmpRounds)
  })
})

http.listen(config.socket.port, () => {
  logger('info', 'socket', `Socket.io listening to port ${config.socket.port}`)
})
