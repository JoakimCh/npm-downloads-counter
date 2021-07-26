/*
Documentation:
  Registry API:    https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
  Download counts: https://github.com/npm/registry/blob/master/docs/download-counts.md
*/

import * as https from 'https'
import * as fs from 'fs'
import * as braille from './braille.js'
let Chalk; try {Chalk = (await import('chalk')).default} catch {} // optional dependency (for colors)
let terminalLink; try {terminalLink = (await import('terminal-link')).default} catch {} // optional dependency (for links in terminal)

const wideNumber = new Intl.NumberFormat('fullwide', {maximumSignificantDigits: 21})
const maxConcurrentDownloads = 10

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.request(url, {}, response => {
      if (response.statusCode != 200) reject(Error('Response code: '+response.statusCode))
      let json = ''
      response.setEncoding('utf-8')
      response.on('data', chunk => json += chunk)
      response.on('end', () => {
        try {resolve(JSON.parse(json))} 
        catch (error) {reject(error)}
      })
    })
    .on('error', reject)
    .end()
  })
}

async function getPackages_(maintainerUsername, offset, limit) {
  if (limit > 250) throw Error('Max 250 results per query, reduce limit below this.')
  const queryResult = await getJson('https://registry.npmjs.com/-/v1/search?text=maintainer:'+maintainerUsername+'&size='+limit+'&from='+offset)
  if ('error' in queryResult) throw Error('API error: '+queryResult.error)
  return [queryResult.total, queryResult.objects.map(v => {return {...v.package, score: v.score, searchScore: v.searchScore}})]
}

/** Get all packages where `maintainerUsername` is listed as one of the maintainers (anyone publishing a package is automatically listed as one). Optionally filter out any packages not published by `publisherUsername` (this can be used to return only packages published by this user).
 @param {string} maintainerUsername Get all packages listed with this user as one of its maintainers.
 @param {string} [publisherUsername] Return only packages with this user listed as the publisher.
 @returns {Array.<object>} An array of objects with details about the packages.
*/
export async function getPackages(maintainerUsername, publisherUsername) {
  // https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#get-v1search
  // they are by default sorted by popularity it seems
  const downloadPromises = []
  let limit = 250, packages = []
  const [packageCount, page1] = await getPackages_(maintainerUsername, 0, limit)
  packages.push(...page1)
  if (packageCount > limit) {
    for (let offset = limit; offset < packageCount; offset += limit) {
      downloadPromises.push(() => getPackages_(maintainerUsername, offset, limit))
    }
  }
  const results = await allSettledQueued(downloadPromises, maxConcurrentDownloads)
  for (const result of results) {
    if (result.status == 'fulfilled') {
      packages.push(...result.value[1])
    } else {
      throw result.reason
    }
  }
  if (publisherUsername) packages = packages.filter(package_ => package_.publisher.username == publisherUsername)
  return packages
}

/**
 * Get the daily download counts of a package (or packages) in the given timeframe. If doing a bulk query then limit it to <=128 packages.
 * @param {string|Array.<string>} packages The package (or packages if an array) to query.
 * @param {string} range A range/timeframe compatible with the registry API.
 * @returns {object|Array.<object>} {packageName, dailyDownloads} (in an array if doing a bulk query)
 */
export async function getLastDownloads(packages, range) {
  if (range == undefined) throw Error('Range must be supplied!')
  let wrapIt
  if (Array.isArray(packages)) {
    if (packages.length > 128) throw Error('Can\'t bulk query more than 128 packages.')
  } else {
    wrapIt = true
    packages = [packages]
  }
  const packageNames = packages.map(package_ => package_.name)
  let queryResult = await getJson('https://api.npmjs.org/downloads/range/'+range+'/'+packageNames.join(','))
  if ('error' in queryResult) throw Error('API error: '+queryResult.error)
  if (wrapIt) {const r = {}; r[queryResult.package] = queryResult; queryResult = r}
  const result = []
  for (const package_ of packages) {
    const dailyDownloads = queryResult[package_.name].downloads.map(o => o.downloads)
    result.push({package: package_, dailyDownloads, endDate: queryResult[package_.name].end})
  }
  return result
}

/** Used to keep track of and work with the statistics collected by this library. I will not document its functions very well, instead check the code for usage examples. */
export class PackageStatistics {
  #range; #positionMap; #maintainerUsername; #publisherUsername; #date
  #stats = []

  constructor({maintainerUsername, publisherUsername, range} = {}) {
    this.#range = range
    this.#maintainerUsername = maintainerUsername
    this.#publisherUsername = publisherUsername
  }

  get date() {return this.#date}
  set date(date) {if (!this.#date) this.#date = date}

  /** Add download or score stats (not both at once). */
  add({packageName, dailyDownloads, endDate, score}) {
    if (dailyDownloads) {
      let dailyMin = Number.MAX_SAFE_INTEGER, dailyMax = 0, totalDownloads = 0
      for (const count of dailyDownloads) {
        totalDownloads += count
        if (count > dailyMax) dailyMax = count
        if (count < dailyMin) dailyMin = count
      }
      this.#stats.push({packageName, totalDownloads, dailyDownloads, dailyMin, dailyMax, score})
      this.date = endDate
    } else {
      this.#stats.push({packageName, score})
    }
  }

  /** Sort the stats array. */
  sort(by='downloads') {
    switch (by.toLowerCase()) {
      default: throw Error('Invalid sort by string: '+by)
      case 'downloads':   this.#stats.sort((a, b) => b.totalDownloads - a.totalDownloads); break
      case 'quality':     this.#stats.sort((a, b) => b.score.quality - a.score.quality); break
      case 'popularity':  this.#stats.sort((a, b) => b.score.popularity - a.score.popularity); break
      case 'maintenance': this.#stats.sort((a, b) => b.score.maintenance - a.score.maintenance); break
      case 'final':       this.#stats.sort((a, b) => b.score.final - a.score.final); break
      case 'searchscore': this.#stats.sort((a, b) => b.score.searchScore - a.score.searchScore); break
    }
    this.#createPosMap()
  }

  #createPosMap = function() {
    this.#positionMap = new Map()
    for (let i=0; i<this.#stats.length; i++) {
      this.#positionMap.set(this.#stats[i].packageName, i)
    }
  }

  /** Get the position of the package in the stats array. */
  getPosition(packageName) {
    return this.#positionMap.get(packageName)
  }
  
  /** Get the stats for just this package. */
  getPackageStats(packageName) {
    return this.#stats[this.getPosition(packageName)]
  }

  /** Save stats to disk. */
  saveToDisk(path) {
    const data = {
      range: this.#range,
      date: this.#date,
      maintainerUsername: this.#maintainerUsername,
      publisherUsername: this.#publisherUsername,
      stats: this.#stats
    }
    const json = JSON.stringify(data, null, 2)
    fs.writeFileSync(path, json)
  }

  /** Load stats from disk. */
  loadFromDisk(path) {
    try {
      const json = fs.readFileSync(path, 'utf-8')
      const data = JSON.parse(json)
      this.#range = data.range
      this.#date = data.date
      this.#maintainerUsername = data.maintainerUsername
      this.#publisherUsername = data.publisherUsername
      this.#stats = data.stats
      this.#createPosMap()
      return this
    } catch {}
  }
  
  /** Get a string containing download stats. */
  drawDownloadStats(options, prevDownStats) {
    const chalk = Chalk && !options?.noColors ? Chalk : undefined
    let text = '', range
    switch (this.#range) {
      case 'last-week': range = 'the last '+(chalk ? chalk.yellow('7 days') : '7 days'); break
      case 'last-month': range = 'the last '+(chalk ? chalk.yellow('30 days') : '30 days'); break
      default: range = 'this range '+(chalk ? chalk.yellow(this.#range) : this.#range); break
    }
    if (this.#publisherUsername) {
      text += 'Download count of packages published by '+(chalk ? chalk.yellow(this.#publisherUsername) : this.#publisherUsername)+' '+range+':\n'
    } else {
      text += 'Download count of packages maintained by '+(chalk ? chalk.yellow(this.#maintainerUsername) : this.#maintainerUsername)+' '+range+':\n'
    }
    const climbers = [] // push climbing packages
    for (let i=0; i<this.#stats.length; i++) {
      const pPos = prevDownStats?.date != this.date ? prevDownStats?.getPosition(this.#stats[i].packageName) : undefined
      const positionChange = pPos != undefined ? i - pPos : undefined
      if (positionChange < 0) climbers.push([this.#stats[i].packageName, positionChange])
      text += this.#drawDownloadStat({...this.#stats[i], positionChange}, options) + '\n'
    }
    if (options?.climbersSummary && climbers.length) {
      climbers.sort((a, b) => b - a)
      text += '\nSummary of packages climbing the list:\n'
      for (const [packageName, positionChange] of climbers) {
        text += (chalk ? chalk.green(packageName) : packageName)+' is up: '+Math.abs(positionChange)+'\n'
      }
    }
    if (options?.displayDate) text += '\nLast updated: '+this.date+' UTC (once a day)\n'
    return text.slice(0, -1)
  }

  #drawDownloadStat({packageName, totalDownloads, dailyDownloads, dailyMin, dailyMax, positionChange}, options) {
    let pValue = 0, pChar
    const chalk = Chalk && !options?.noColors ? Chalk : undefined
    function getBarChar(value) {
      const barEven = '⠀⠀⣀⠀⣤⠀⣶⠀⣿'
      const barOddL = '⠀⢀⠀⣠⠀⣴⠀⣾'
      const barOddR = '⠀⢀⠀⣄⠀⣦⠀⣷'
      let remappedValue
      if (dailyMax <= 8) remappedValue = value
      else remappedValue = Math.ceil(8 * (value - dailyMin) / (dailyMax - dailyMin)) // 0 to 8
      if (remappedValue % 2) { // odd
        if (pValue < value) return barOddL[remappedValue]
        if (pValue > value) return barOddR[remappedValue]
        if (pChar) return pChar // if same value; repeat last char
      } else { // even
        return barEven[remappedValue]
      }
    }
    function remap(value) {
      if (value == undefined) return 0
      let remappedValue
      if (dailyMax <= 4) remappedValue = value
      else remappedValue = Math.ceil(4 * (value - dailyMin) / (dailyMax - dailyMin)) // 0 to 4
      return remappedValue
    }
    let line = ''
    function drawGraph() {
      line += '|'
      if (options?.thinBars) {
        for (let i=0; i<dailyDownloads.length; i+=2) {
          line += braille.bars(remap(dailyDownloads[i]), remap(dailyDownloads[i+1]))
        }
      } else {
        for (const count of dailyDownloads) {
          pChar = getBarChar(count)
          line += pChar
          pValue = count
        }
      }
      line += '| '
      if (options?.comparePrevious && typeof positionChange == 'number') {
        const arrow = {
          up: '▲',
          down: '▼'
        }
        if (positionChange > 0) {
          const positionChangeStr = String(positionChange)
          line += chalk ? chalk.red(arrow.down+positionChangeStr) : arrow.down+positionChangeStr
        } else if (positionChange < 0) {
          const positionChangeStr = String(Math.abs(positionChange))
          line += chalk ? chalk.green(arrow.up+positionChangeStr) : arrow.up+positionChangeStr
        }
        if (positionChange != 0) line += ' '
      }
    }
    function drawStats(first) {
      let packageNameString = (chalk ? chalk.green(packageName) : packageName)
      if (terminalLink?.isSupported && !options?.noLinks) {
        packageNameString = terminalLink(packageNameString, 'https://www.npmjs.com/package/'+packageName)
      }
      line += packageNameString + ' '
      if (!options?.noTotal) line += (chalk ? chalk.yellow(totalDownloads) : totalDownloads) + ' '
      if (!options?.noMinMax) line += (chalk ? chalk.blue(`${dailyMin}-${dailyMax}`) : `${dailyMin}-${dailyMax}`)
      line += first ? ': ' : ' '
    }
    if (options?.separateLines) {
      drawStats(true)
      line += '\n'
      drawGraph()
    } else {
      drawGraph()
      drawStats()
    }

    return line
  }

  /** Get a string containing score stats. */
  drawScoreStats(sortedBy, options, prevScoreStats) {
    const chalk = Chalk && !options?.noColors ? Chalk : undefined
    let text = ''
    if (this.#publisherUsername) {
      text += 'Score list of packages published by '+(chalk ? chalk.yellow(this.#publisherUsername) : this.#publisherUsername)
    } else {
      text += 'Score list of packages maintained by '+(chalk ? chalk.yellow(this.#maintainerUsername) : this.#maintainerUsername)
    }
    text += ' sorted by '+(chalk ? chalk.yellow(sortedBy) : sortedBy)+':\n'
    const climbers = [] // push climbing packages
    for (let i=0; i<this.#stats.length; i++) {
      const pPos = prevScoreStats?.date != this.date ? prevScoreStats?.getPosition(this.#stats[i].packageName) : undefined
      const positionChange = pPos != undefined ? i - pPos : undefined
      const pFinal = prevScoreStats?.date != this.date ? prevScoreStats?.getPackageStats(this.#stats[i].packageName).score.final : undefined
      const finalDiff = pFinal != undefined ? this.#stats[i].score.final - pFinal : undefined
      if (positionChange < 0) climbers.push([this.#stats[i].packageName, positionChange])
      text += this.#drawScoreStat({...this.#stats[i], positionChange, finalDiff}, options) + '\n'
    }
    if (options?.climbersSummary && climbers.length) {
      climbers.sort((a, b) => b - a)
      text += '\nSummary of packages climbing the list:\n'
      for (const [packageName, positionChange] of climbers) {
        text += (chalk ? chalk.green(packageName) : packageName)+' is up: '+Math.abs(positionChange)+'\n'
      }
    }
    return text.slice(0, -1)
  }

  #drawScoreStat({packageName, score, positionChange, finalDiff}, options) {
    const chalk = Chalk && !options?.noColors ? Chalk : undefined
    let packageNameString = (chalk ? chalk.green(packageName) : packageName)
    if (terminalLink?.isSupported && !options?.noLinks) {
      packageNameString = terminalLink(packageNameString, 'https://www.npmjs.com/package/'+packageName)
    }
    let text = packageNameString+' '+JSON.stringify(score, (k, v) => {
      if (typeof v == 'number') return wideNumber.format(v)
      return v
    }, 2).replaceAll('"', '')
    if (Math.abs(finalDiff) >= 0.0001) {
      const string = ' (final change: '+wideNumber.format(finalDiff)+')'
      if (finalDiff > 0) text += chalk ? chalk.green(string) : string
      if (finalDiff < 0) text += chalk ? chalk.red(string) : string
    }
    return text
  }
}

async function sha256hex_fromString(message) {
  const {subtle} = (await import('crypto')).webcrypto
  const msgBuffer = new TextEncoder('utf-8').encode(message)
  const hashBuffer = await subtle.digest('SHA-256', msgBuffer)
  return Buffer.from(hashBuffer).toString('hex')
}

/**
 * Get either download or score statistics of all packages where `maintainerUsername` is listed as one of the maintainers (anyone publishing a package is automatically listed as one). Optionally filter out any packages not published by `publisherUsername` (this can be used to return only packages published by this user).
 * @param {object} options 
 * @param {string} options.maintainerUsername
 * @param {string} options.publisherUsername
 * @param {string} [options.range='last-month'] A range/timeframe compatible with the registry API (used for download stats).
 * @param {boolean} [options.withoutDownloads] To only get score stats.
 * @returns {PackageStatistics}
 */
export async function getStatistics({maintainerUsername, publisherUsername, range='last-month', withoutDownloads}) {
  if (!maintainerUsername && publisherUsername) maintainerUsername = publisherUsername
  if (!maintainerUsername) throw Error('Please specify: {maintainerUsername}')
  const packageList = await getPackages(maintainerUsername, publisherUsername)
  const downloadStat = new PackageStatistics({maintainerUsername, publisherUsername, range: withoutDownloads ? undefined : range})
  if (!withoutDownloads) { // with download stats only
    const promiseLaunchers = [] // push functions which when executed returns a promise which downloads the stats
    for (let i=0; i<packageList.length; i+=128) { // do bulk queries (max 128 in one)
      const slicedList = packageList.slice(i, i+128).filter(package_ => {
        if (package_.name.includes('@')) { // scoped packages can't be used in bulk queries
          promiseLaunchers.push(() => getLastDownloads(package_, range)) // put them in single queries
          return false // and filter them out from the bulk query
        }
        return true
      })
      promiseLaunchers.push(() => getLastDownloads(slicedList, range)) // add the bulk query
    }
    const results = await allSettledQueued(promiseLaunchers, maxConcurrentDownloads)
    for (const result of results) {
      if (result.status == 'fulfilled') {
        if (!Array.isArray(result.value)) result.value = [result.value]
        for (const {package: package_, dailyDownloads, endDate} of result.value) {
          downloadStat.add({packageName: package_.name, dailyDownloads, endDate})
        }
      } else {
        throw result.reason
      }
    }
    downloadStat.sort()
  } else { // without download stats
    let scoreHash = ''
    for (const package_ of packageList) {
      scoreHash = await sha256hex_fromString(scoreHash+package_.score.final)
      downloadStat.add({packageName: package_.name, score: {
        final:       package_.score.final,
        ...package_.score.detail,
        searchScore: package_.searchScore
      }})
    }
    downloadStat.date = scoreHash // "date" just needs to be a "unique id" for when stats was updated
  }
  return downloadStat
}

/**
 * For when you want to await lots of promises but not launch them all at once. This function allows you to set a max concurrency to limit how many promises can be launched (and awaited) at the same time. This is a very good way to limit concurrent HTTP requests, etc.
 * @param {Array.<Function>} promiseLaunchers An array with functions that launches and returns a promise.
 * @param {number} [maxConcurrency=1] How many promises that will be allowed to run at the same time.
 * @returns {Promise.<Array.<object>>} An array with objects equal to the result of `Promise.allSettled`.
 * @ignore
 */
async function allSettledQueued(promiseLaunchers, maxConcurrency = 1) {
  const result = [], workerPromises = []

  for (let i=0; i<maxConcurrency; i++) {
    workerPromises.push(new Promise(async resolve => {
      while (promiseLaunchers.length) {
        try {
          result.push({
            status: 'fulfilled',
            value: await promiseLaunchers.pop()() // pop launcher, execute it and await returned promise
          })
        } catch (error) {
          result.push({
            status: 'rejected',
            reason: error
          })
        }
      }
      resolve()
    }))
  }

  await Promise.allSettled(workerPromises)
  return result
}

async function slackWebApi(method, token, payload) {
  const webApiUrl = 'https://slack.com/api/'
  const result = await new Promise((resolve, reject) => {
    const json = JSON.stringify(payload)
    https.request(webApiUrl+method, {method: 'POST', headers: {
      'authorization': 'Bearer '+token,
      'content-type': 'application/json; charset=utf-8'
    }}, response => {
      if (response.statusCode != 200) reject(Error('Response code: '+response.statusCode))
      let json = ''
      response.setEncoding('utf-8')
      response.on('data', chunk => json += chunk)
      response.on('end', () => {
        try {resolve(JSON.parse(json))} 
        catch (error) {reject(error)}
      })
    })
    .on('error', reject)
    .end(json)
  })
  if (result.ok == false) throw Error(result.error)
  if (result.warning) console.warn(result.warning)
  return result
}

function mandatory(parameter, message) {
  throw Error(message+' (missing the `'+parameter+'` parameter)')
}

/**
 * Push provided text to the channel, with customizable username and icon emoji.
 * @param {object} options 
 * @param {string} options.token
 * @param {string} options.channel
 * @param {string} options.text
 * @param {string} [options.username='npm-downloads-counter']
 * @param {string} [options.icon_emoji=':bar_chart:']
 * @returns {Promise.<object>} The result from the Slack Web API.
 */
export function pushToSlack({
  token, channel, text,
  username = 'npm-downloads-counter',
  icon_emoji = ':bar_chart:'
} = {}) {
  token ?? mandatory('token', 'A Slack Web API token is required.')
  channel ?? mandatory('channel', 'Which Slack channel should we push to?')
  text ?? mandatory('text', 'Which text to push to the Slack channel?')
  const parameters = {channel, text, username}
  if (icon_emoji) parameters.icon_emoji = icon_emoji
  return slackWebApi('chat.postMessage', token, parameters)
}
