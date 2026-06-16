import { pino } from 'pino'

export { logger }

const logger = pino({
  // Feed lifecycle categories, visible at the info level
  customLevels: {
    serve: 31,
    new: 32,
    refresh: 33,
    delete: 34,
    done: 35
  },
  base: undefined,
  timestamp: false,
  formatters: {
    level: label => ({ level: label.toUpperCase() })
  },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      customColors:
        'info:blue,serve:green,new:cyan,refresh:yellow,delete:magenta,done:green,warn:yellow,error:red',
      customLevels:
        'info:30,serve:31,new:32,refresh:33,delete:34,done:35,warn:40,error:50'
    }
  }
})
