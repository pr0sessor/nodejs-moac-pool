const mongoose = require('mongoose')

const logger = require('./lib/logger')
const config = require('./config')

mongoose.connect(config.mongoose.url, config.mongoose.options, (err) => {
  if (err) {
    logger('error', 'mongo', 'Error connecting to MongoDB')
    process.exit()
  }
})

// const workers = []

if (config.stratumServer.enabled) {
  require('./lib/socket.js')
  require('./lib/stratum.js')
}
/* if (cluster.isMaster) {
  if (config.stratumServer.enabled) {
    logger('info', 'process', `Stratum Master ${process.pid} is running`)
    let numCPUs = os.cpus().length

    if (numCPUs > config.stratumServer.cpu) {
      numCPUs = config.stratumServer.cpu
    }
    for (let i = 0; i < numCPUs; i++) {
      const worker = cluster.fork({
        type: 'stratum'
      })
      workers.push(worker)
    }

    cluster.on('exit', (worker, code, signal) => {
      logger('error', 'process', `Worker ${worker.process.pid} died`)
    })
  }
}

if (cluster.isWorker) {
  require(`./lib/${process.env.type}.js`)
} */
