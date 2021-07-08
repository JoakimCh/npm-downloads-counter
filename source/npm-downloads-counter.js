/*
Documentation:
  Registry API:    https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
  Download counts: https://github.com/npm/registry/blob/master/docs/download-counts.md
*/

import * as https from 'https'

function getJson(url) {
  // console.log('GET', url)
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

/** Get all packages where `maintainerUsername` is listed as one of the maintainers (anyone publishing a package is automatically listed as one). Optionally filter out any packages not published by `publisherUsername` (this can be used to return only packages published by this user).
 @param {string} maintainerUsername Get all packages listed with this user as one of its maintainers.
 @param {string} [publisherUsername] Return only packages with this user listed as the publisher.
 @returns {Array.<object>} An array of objects with details about the packages.
*/
export async function getPackages(maintainerUsername, publisherUsername) {
  const queryResult = await getJson('https://registry.npmjs.com/-/v1/search?text=maintainer:'+maintainerUsername)
  if ('error' in queryResult) throw Error('API error: '+queryResult.error)
  let packages = queryResult.objects.map(v => v.package)
  if (publisherUsername) packages = packages.filter(package_ => package_.publisher.username == publisherUsername)
  return packages
}

/**
 * Get the daily download counts of a package (or packages) in the given timeframe. If doing a bulk query then limit it to <=128 packages.
 * @param {string|Array.<string>} packageName The package (or packages if an array) to query.
 * @param {string} range A range/timeframe compatible with the registry API.
 * @returns {object|Array.<object>} {packageName, dailyDownloads} (in an array if doing a bulk query)
 */
export async function getLastDownloads(packageName, range) {
  if (range == undefined) throw Error('Range must be supplied!')
  if (Array.isArray(packageName)) {
    if (packageName.length > 128) throw Error('Can\'t bulk query more than 128 packages.')
    const queryResult = await getJson('https://api.npmjs.org/downloads/range/'+range+'/'+packageName.join(','))
    if ('error' in queryResult) throw Error('API error: '+queryResult.error)
    const result = []
    for (const package_ of packageName) {
      const dailyDownloads = queryResult[package_].downloads.map(o => o.downloads)
      result.push({packageName: package_, dailyDownloads})
    }
    return result
  } else {
    const queryResult = await getJson('https://api.npmjs.org/downloads/range/'+range+'/'+packageName)
    if ('error' in queryResult) throw Error('API error: '+queryResult.error)
    const dailyDownloads = queryResult.downloads.map(o => o.downloads)
    return {packageName, dailyDownloads}
  }
}
