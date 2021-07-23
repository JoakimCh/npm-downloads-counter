#!/usr/bin/env node

import * as dc from './npm-downloads-counter.js'
import * as n_path from 'path'
import * as n_fs from 'fs'
import * as n_os from 'os'
import {fileURLToPath} from 'url'

const {data: dataDir, config: configDir} = getAppDirs('npm-downloads-counter')
const options = { // merge default with custom config
  // noColors: true, // no colors in CLI even if chalk is installed
  // noLinks: true, // no links in CLI even if terminal-link is installed
  // separateLines: true, // graph is on a separate line
  // thinBars: true, // use thin bars in graph
  displayDate: true, // date of when download-statistics was updated
  logToTerminal: true, // output the result to terminal
  climbersSummary: true, // summary of packages climbing the list
  comparePrevious: true, // show position changes of packages
  ...loadConfig(configDir+'config.json') // merge (overwriting options above)
}
if (options.slack) {
  options.slack = { // Slack only options
    // token: 'xoxb-XXXX-XXXX', // the much needed Web API token
    // channel: 'npm-downloads-counter', // which channel to post to, name or id
    // username: 'npm-downloads-counter', // custom username for message
    // icon_emoji: ':bar_chart:', // custom icon for message
    // noScores: true, // do not push notifications about scores
    // onlyUsername: 'username', // only push notifications when checking this username
    thinBars: true, // use thin bars in graph
    separateLines: true, // graph is on a separate line
    ...options.slack, // merge (overwriting options above)
    noColors: true, // not compatible with Slack
    noLinks: true // not compatible with Slack
  }
}

if (process.argv.length < 3) {
  console.error('No arguments supplied. Read the documentation below for help.\n')
  outputHelp()
} else {
  /* Some quick and very simple parsing of args here, mainly to avoid adding a dependency for something which is simple enough to implement myself. For more advanced CLI tools you probably doesn't want to do this... */
  let optionsBeforeDefault = false, queryMaintainer = false
  const args = process.argv.slice(2)
  loop: for (let arg; arg = args.shift();) {
    switch (arg) {
      default: // should be username // [-m] username
        if (!optionsBeforeDefault && process.argv.length != 3) {
          console.error('Unrecognized option: '+arg+'. Read the documentation below for help.\n')
          outputHelp(); break loop
        }
        const username = arg
        const [downloadStatistics, prevDownStats] = await downloadStats(queryMaintainer, username)
        let text = downloadStatistics.drawDownloadStats(options, prevDownStats) // it will check that date is not the same
        if (options.logToTerminal) console.log(text)
        if (options.slack && downloadStatistics.date != prevDownStats?.date) {
          if (options.slack.onlyUsername && options.slack.onlyUsername != username) break loop
          if (options.slack) text = downloadStatistics.drawDownloadStats({
            ...options,
            ...options.slack
          }, prevDownStats)
          await dc.pushToSlack({...options.slack, text})
        }
      break loop
      case '--score': { // [-m] --score username [sortBy=final]
        const username = args.shift()
        if (!username) throw Error('No username following --score')
        const [downloadStatistics, prevScoreStats] = await downloadStats(queryMaintainer, username, true)
        const sortBy = args.shift() || 'final'
        downloadStatistics.sort(sortBy)
        prevScoreStats?.sort(sortBy)
        let text = downloadStatistics.drawScoreStats(sortBy, options, prevScoreStats)
        if (options.logToTerminal) console.log(text)
        if (options.slack && !options.slack.noScores && downloadStatistics.date != prevScoreStats?.date) {
          if (options.slack.onlyUsername && options.slack.onlyUsername != username) break loop
          if (options.slack) text = downloadStatistics.drawScoreStats(sortBy, {
            ...options,
            ...options.slack
          }, prevScoreStats)
          await dc.pushToSlack({...options.slack, text})
        }
      } break loop
      case '-m': queryMaintainer = true; break
      case '--help': outputHelp(); break loop
      case '-v':
      case '--version': {
        const scriptDirectory = n_path.dirname(fileURLToPath(import.meta.url))
        console.log('version:', JSON.parse(n_fs.readFileSync(scriptDirectory+'/../package.json', 'utf8')).version)
      } break loop
      case '--paths': {
        const {fileURLToPath} = await import('url')
        const scriptPath = fileURLToPath(import.meta.url)
        console.log({
          dataDir,
          configDir,
          scriptPath
        })
      } break loop
    }
    optionsBeforeDefault = true
  }
}

async function downloadStats(queryMaintainer, username, scoreOnly = false) {
  let fileName = scoreOnly ? 'prevScoreStats_' : 'prevDownStats_'
  fileName += queryMaintainer ? 'maintainer_' : 'publisher_'
  fileName += username+'.json'
  const query = queryMaintainer ? {maintainerUsername: username} : {publisherUsername: username}
  if (scoreOnly) query.withoutDownloads = true
  const prevDownStats = new dc.PackageStatistics().loadFromDisk(dataDir+fileName) // undefined if nothing
  const downloadStatistics = await dc.getStatistics(query)
  if (options.comparePrevious && downloadStatistics.date != prevDownStats?.date) { // also save new if date is different
    n_fs.mkdirSync(dataDir, {recursive: true}) // create the data dir if it doesn't exist
    downloadStatistics.saveToDisk(dataDir+fileName)
  }
  return [downloadStatistics, prevDownStats]
}

function outputHelp() {
  console.log(
`Documentation for npm-downloads-counter CLI:

Usage:
  npm-downloads-counter [options] npm-username

Example:
  npm-downloads-counter -m --score joakimch
  - To view score statistics of packages where joakimch is one of the maintainers.

Options:
  [default]      List any packages where this user is the publisher.
  -m             List any packages where this user is a maintainer.
  --score        Output score statistics instead of download statistics.
  --help         Output this documentation.
  -v, --version  Display version number.
  --paths        Output a list of paths possibly used by the program.

Check out the online documentation for more info:
https://github.com/JoakimCh/npm-downloads-counter#readme
`)
}

function loadConfig(path) {
  let json
  try {json = n_fs.readFileSync(path, 'utf-8')} catch {return {}}
  try {return JSON.parse(json)} catch (error) {
    console.error('Error in '+path+':')
    throw error
  }
}

function getAppDirs(appTitle) {
  const dir = {
    home: n_os.homedir()+'/'
  }
  switch (n_os.platform()) {
    case 'darwin': // I've seen lots of software use the "Linux standard" also for macOS
    case 'linux':
      dir.config = dir.home+'.config/'+appTitle+'/'
      dir.data   = dir.home+'.local/share/'+appTitle+'/'
      dir.cache  = dir.home+'.cache/'+appTitle+'/'
    return dir
    case 'win32': // Windows doesn't care if you use /
      dir.config = dir.home+'AppData/Roaming/'+appTitle+'/'
      dir.data   = dir.home+'AppData/Local/'+appTitle+'/Data/'
      dir.cache  = dir.home+'AppData/Local/'+appTitle+'/Cache/'
    return dir
  }
}
