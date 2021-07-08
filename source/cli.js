/*
Todo:
  Detect and report sudden popularity?
*/

import * as dc from './npm-downloads-counter.js'
import * as n_path from 'path'
import * as n_fs from 'fs'
import {fileURLToPath} from 'url'

async function main({maintainerUsername, publisherUsername, range='last-month'}) {
  if (!maintainerUsername && publisherUsername) maintainerUsername = publisherUsername
  if (!maintainerUsername) throw Error('Please specify: {maintainerUsername}')
  const downloadStat = new DownloadStat()
  if (publisherUsername) console.log('Download count of packages published by "'+publisherUsername+'" the last 30 days:')
  else console.log('Download count of packages maintained by "'+maintainerUsername+'" the last 30 days:')
  const packageNames = (await dc.getPackages(maintainerUsername, publisherUsername)).map(package_ => package_.name)
  const promiseLaunchers = [] // push functions which when executed returns a promise which downloads the stats
  for (let i=0; i<packageNames.length; i+=128) { // do bulk queries (max 128 in one)
    const packageList = packageNames.slice(i, i+128).filter(name => {
      if (name.includes('@')) { // scoped packages can't be used in bulk queries
        promiseLaunchers.push(() => dc.getLastDownloads(name, range)) // put them in single queries
        return false // and filter them out from the bulk query
      }
      return true
    })
    promiseLaunchers.push(() => dc.getLastDownloads(packageList, range)) // add the bulk query
  }
  const results = await allSettledQueued(promiseLaunchers, 5) // max 5 simultaneous downloads
  for (const result of results) {
    if (result.status == 'fulfilled') {
      if (Array.isArray(result.value)) {
        for (const {packageName, dailyDownloads} of result.value) {
          downloadStat.add(packageName, dailyDownloads)
        }
      } else {
        downloadStat.add(result.value.packageName, result.value.dailyDownloads)
      }
    } else {
      console.error('Concurrent download promise:', result)
    }
  }
  downloadStat.sort()
  for (const stat of downloadStat.all()) {
    drawLastDownloads(stat)
  }
}

async function drawLastDownloads({packageName, totalDownloads, dailyDownloads, dailyMin, dailyMax}) {
  let pValue = 0, pChar
  function getBarChar(value) {
    const barEven = '  ⣀ ⣤ ⣶ ⣿'
    const barOddL = ' ⢀ ⣠ ⣴ ⣾'
    const barOddR = ' ⢀ ⣄ ⣦ ⣷'
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
  let line = ''
  for (const count of dailyDownloads) {
    pChar = getBarChar(count)
    line += pChar
    pValue = count
  }
  console.log('|'+line+'| '+`${packageName} ${dailyMin}-${dailyMax} (${totalDownloads})`)
}

class DownloadStat {
  #packages = []
  add(packageName, dailyDownloads) {
    let dailyMin = Number.MAX_SAFE_INTEGER, dailyMax = 0, totalDownloads = 0
    for (const count of dailyDownloads) {
      totalDownloads += count
      if (count > dailyMax) dailyMax = count
      if (count < dailyMin) dailyMin = count
    }
    this.#packages.push({packageName, totalDownloads, dailyDownloads, dailyMin, dailyMax})
  }
  sort() {
    this.#packages.sort((a, b) => b.totalDownloads - a.totalDownloads)
  }
  all() {
    return this.#packages
  }
}

/**
 * For when you want to await lots of promises but not launch them all at once. This function allows you to set a max concurrency to limit how many promises can be launched (and awaited) at the same time. This is a very good way to limit concurrent HTTP requests, etc.
 * @param {Array.<Function>} promiseLaunchers An array with functions that launches and returns a promise.
 * @param {number} [maxConcurrency=1] How many promises that will be allowed to run at the same time.
 * @returns {Promise.<Array.<object>>} An array with objects equal to the result of `Promise.allSettled`.
 */
async function allSettledQueued(promiseLaunchers, maxConcurrency = 1) {
  const result = [], workerPromises = []

  for (let i=0; i<maxConcurrency; i++) {
    workerPromises.push(new Promise(async resolve => {
      while (promiseLaunchers.length) {
        try {
          result.push({
            status: 'fulfilled',
            value: await promiseLaunchers.pop()() // pop laucher, execute it and await returned promise
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

function outputHelp() {
  console.log(
`Documentation for npm-downloads-counter CLI:

Usage:
  npm-downloads-counter options npm-username

Options:
  [default]      List any packages where this user is the publisher.
  -m             List any packages where this user is a maintainer.
  --help         Output this documentation.
  -v, --version  Display version number.`)
}

if (process.argv.length < 3) {
  console.error('No arguments supplied. Read the documentation below for help.\n')
  outputHelp()
} else {
  let optionsBeforeDefault = false, queryMaintainer = false
  for (const arg of process.argv.slice(2)) {
    switch (arg) {
      default: // should be username
        if (!optionsBeforeDefault && process.argv.length != 3) {
          console.error('Unrecognized option: '+arg+'. Read the documentation below for help.\n')
          outputHelp(); process.exit()
        }
        if (queryMaintainer) main({maintainerUsername: arg})
        else main({publisherUsername: arg})
      break
      case '-m': queryMaintainer = true; break
      case '--help': outputHelp(); break
      case '-v':
      case '--version': {
        const scriptDirectory = n_path.dirname(fileURLToPath(import.meta.url))
        console.log('version:', JSON.parse(n_fs.readFileSync(scriptDirectory+'/package.json', 'utf8')).version)
      } break
    }
    optionsBeforeDefault = true
  }
}
