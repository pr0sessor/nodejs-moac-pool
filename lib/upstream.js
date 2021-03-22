const Web3 = require('web3')
const io = require('socket.io-client')

const logger = require('./logger')
const utils = require('./utils')

const config = require('../config')

const web3 = new Web3(new Web3.providers.HttpProvider(`http://${config.upstream}`))
const socket = io(`http://${config.socket.host}:${config.socket.port}`)

socket.on('connect_error', () => {
  logger('error', 'socket', 'Connection to socket.io server failed')
  process.exit()
})

class Upstream {
  constructor () {
    this.jobs = []
    this.broadcastJob = null
  }

  setJob (work) {
    const blockHeight = Number(work[3])
    const jobId = work[0].substr(work[0].length - 16)
    if (this.jobs.findIndex(job => job.jobId === jobId) !== -1) return
    if (this.jobs.findIndex(job => job.blockHeight > blockHeight) !== -1) return
    if (this.jobs.findIndex(job => job.blockHeight === blockHeight) !== -1) return
    this.jobs = this.jobs.filter(job => job.blockHeight > (blockHeight - config.stratumServer.maxBackLog))
    this.jobs.push({ jobId: jobId, powHash: work[0], seedHash: work[1], blockTarget: work[2], blockHeight: blockHeight })
    logger('info', 'upstream', `New block to mine at height ${blockHeight}. Job #${jobId}`)
    if (this.broadcastJob) this.broadcastJob()
  }

  getBlockNumber (cb) {
    web3.eth.getBlockNumber((err, res) => {
      if (err) return logger('error', 'upstream', 'Failed to get latest block number')
      cb(res)
    })
  }

  refreshWork () {
    web3.eth.getWork().then(work => {
      this.setJob(work)
    })
  }

  getWorkCallback () {
    return (header) => {
      web3.eth.getWork().then(job => {
        this.setJob(job)
      })
    }
  }

  getWork () {
    web3.eth.getWork().then(job => {
      this.setJob(job)
      web3.eth.subscribe('newBlockHeaders').on('data', this.getWorkCallback())
    })
  }

  getTopJob () {
    return this.jobs[this.jobs.length - 1]
  }

  setFunction (func) {
    this.broadcastJob = func
  }

  submitWork (nonce, powHash, mixHash, height, miner) {
    web3.eth.submitWork(nonce, powHash, mixHash).then((result) => {
      if (result) {
        web3.eth.getBlock(height).then((block) => {
          if (block) {
            socket.emit('block', {
              address: miner.address,
              number: height,
              nonce,
              hash: block.hash,
              solo: miner.solo,
              difficulty: block.difficulty
            })
            logger('warn', 'stratum', `Block #${height} was mined by ${miner.address}@${miner.ip}`)
          }
        })
      } else {
        logger('success', 'stratum', `Valid share received from ${miner.address}@${miner.ip}`)
      }
    })
  }

  findJob (jobId) {
    const index = this.jobs.findIndex(job => job.jobId === jobId)
    if (index !== -1) {
      return this.jobs[index]
    }
    return false
  }

  processShare (params, miner, ethash, sendReply) {
    if (!params || params.length !== 3) return sendReply('Malformed PoW result', null)
    if (!miner) return sendReply('Not subscribed', null)
    if (!ethash) return sendReply('Validator is not yet ready', null)
    const job = this.getTopJob()
    if (job.powHash !== params[1]) return sendReply('Stale share', null)

    const r = ethash.doHash(Buffer.from(utils.rmPreHex(params[1]), 'hex'), Buffer.from(utils.rmPreHex(params[0]), 'hex'))
    r.mix_hash = utils.preHex(r.mix_hash.toString('hex'))
    miner.active = true
    miner.lastActivity = new Date()
    socket.emit('share', {
      address: miner.address,
      workerName: miner.workerName,
      difficulty: miner.difficulty * config.coinDifficulty
    })
    this.submitWork(params[0], utils.preHex(job.powHash), r.mix_hash, job.blockHeight, miner)
    sendReply(null, true)
  }

  processNHShare (params, miner, ethash, sendReply) {
    if (!params || params.length !== 3) return sendReply('Malformed PoW result', null)
    if (!miner) return sendReply('Not subscribed', null)
    if (!ethash) return sendReply('Validator is not yet ready', null)
    if (params[1].length !== config.nonceSize + 16) return sendReply('Invalid job id', null)
    const jobId = params[1].substr(config.nonceSize)
    const extraNonce = params[1].substr(0, config.nonceSize)

    const job = this.findJob(jobId)
    if (!job) return sendReply('Job not found', null)

    const r = ethash.doHash(Buffer.from(utils.rmPreHex(job.powHash), 'hex'), Buffer.from(extraNonce + params[2], 'hex'))
    r.mix_hash = utils.preHex(r.mix_hash.toString('hex'))
    miner.active = true
    miner.lastActivity = new Date()
    socket.emit('share', {
      address: miner.address,
      workerName: miner.workerName,
      difficulty: miner.difficulty * config.coinDifficulty * 4
    })
    this.submitWork(utils.preHex(extraNonce + params[2]), utils.preHex(job.powHash), r.mix_hash, job.blockHeight, miner)
    sendReply(null, true)
  }
}

module.exports = Upstream
