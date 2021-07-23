# npm-downloads-counter

This is a [CLI](https://en.wikipedia.org/wiki/Command-line_interface) tool (and an [ES module](https://nodejs.org/api/esm.html)) to output an overview of the (last 30 days) download activity of all the packages maintained (or published) by a certain [NPM](https://www.npmjs.com/) username. I've also added support for outputting the score statistics of each package.

The tool can even push notifications (containing this output) to your Slack channel whenever there are new statistics available when the tool is ran. This could be used together with e.g. [cron](https://en.wikipedia.org/wiki/Cron) or [systemd timers](https://opensource.com/article/20/7/systemd-timers) for daily updates.

I created this mainly because I wanted an easy way to monitor the popularity of the [packages I've published](https://www.npmjs.com/~joakimch).

## Funding

If you find this useful then please consider helping me out (I'm jobless and sick). For more information visit my [GitHub profile](https://github.com/JoakimCh).

## How to use

To list all packages published by a user (e.g. to list packages published by yourself):
```bash
npx npm-downloads-counter npm_username
```

To list all packages maintained by a user (a package can have several maintainers though):
```bash
npx npm-downloads-counter -m npm_username
```

To list (only) score statistics:
```
npx npm-downloads-counter --score npm_username
```

## Example output (download stats)
```
Download count of packages published by joakimch the last 30 days:
|⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣦⣀⣿⢀⠀⠀⠀⢀⠀| npm-downloads-counter 60 0-22 
|⢀⠀⠀⠀⣀⣠⢀⢀⠀⠀⠀⠀⣿⢀⢀⠀⠀⠀⠀⢀⠀⠀⠀⠀⣿⢀⠀⠀⠀⢀| ▲1 pluggable-prng 59 0-20 
|⠀⢀⠀⢀⢀⢀⢀⣾⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⣿⢀⠀⢀⢀⢀⠀⠀⠀⠀⢀| ▼1 bit-consumer 57 0-22 
|⠀⠀⠀⢀⢀⠀⠀⣿⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⣿⢀⠀⠀⢀⢀⠀⢀⠀⠀⠀| base-endecoder 45 0-20 
|⠀⠀⠀⠀⢀⢀⠀⣾⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⠀⠀⢀⠀⠀⠀⠀⠀⢀| ▲1 bit-manipulation 44 0-21 
|⢀⠀⠀⠀⢀⠀⠀⠀⠀⠀⠀⢀⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⢀⠀⢀⠀| ▼1 platform-checker 44 0-20 
|⠀⠀⠀⢀⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⠀⢀⢀⠀⠀⣿⠀⠀⠀⠀⠀| whichever-data 30 0-24 

Summary of packages climbing the list:
pluggable-prng is up: 1
bit-manipulation is up: 1
```

## Output explained

I've designed the output from this tool to be as minimal as it can get to easily fit in most terminal windows. Hence I feel the need to explain what you're looking at.

Each line represents a different package.

It begins with a bar graph (cleverly using unicode braille characters) to represent the "download pressure" of the last 30 days. Where a space represents a download count that day equal to the least amount of daily downloads of this period. Whereas a ⣿ symbol represents the maximum amount (but is not used when the maximum is less than 8 downloads).

The graph is followed by the package name, which is then followed by a number representing the total of downloads this period and some min-max numbers representing the minimum and maximum amount of daily downloads this period.

The lines are sorted so that the packages on top are the ones with the highest amount of downloads this period.

If the package has changed its position in the list compared to when you last ran the tool then it will be indicated by a ▲ or ▼ before the package name, together with a number representing how many lines it jumped from.


## Example output (score stats)
```
Score list of packages published by joakimch sorted by final:
bit-consumer {
  final: 0.2816297020884584,
  quality: 0.5214210083588049,
  popularity: 0.024733028932926553,
  maintenance: 0.33299096986940757,
  searchScore: 0.00000006146252
}
whichever-data {
  final: 0.2810230954009417,
  quality: 0.5214210083588049,
  popularity: 0.022999866968593137,
  maintenance: 0.33299096986940757,
  searchScore: 0.000000058837163
}
[and so on...]
```

## Custom configuration

This tool supports some configuration, mainly of the output format of the statistics. Below is the code that loads the config file, you can use this as an overview of what can be written in the `config.json` file.

Tip, use `--paths` to output the `configDir` path on your platform; this is where to place the `config.json` file.
```js
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
```

## Slack notifications

### How to setup a new Slack app for notifications

Go to https://api.slack.com/apps/ and press "Create New App", then "From scratch".

Enter the page for your app and under "Add features and functionality" press "Permissions" then scroll down to "Scopes" and add these "Bot Token Scopes" by pressing "Add an OAuth Scope":
* `chat:write.public` To send messages to channels it isn't a member of.
* `chat:write.customize` To send messages with a customized username and avatar.

Then you can scroll up to "OAuth Tokens for Your Workspace" and press "Install to Workspace". This results in a "Bot User OAuth Token" which is the token you need to use. It should look similar to this:
`xoxb-1234567891230-9876543219870-theAlPhaBetRoCks1234Abcz`

Then in your `config.json` put something like this to use it:
```json
{
  "slack": {
    "token": "xoxb-1234567891230-9876543219870-theAlPhaBetRoCks1234Abcz",
    "channel": "the-channel-to-post-in"
  }
}
```

I find it useful to also add:
```json
"onlyUsername": "your_NPM_username"
```
So that you can check the download and score statistics of other NPM-usernames without having them pushed to your Slack channel.

## Usage as an ES module

I didn't design this to be a nice and useful library (I only care about the CLI tool), but I have exported the functions used by the CLI tool so that anyone can use them. Check the documentation below to learn about them.

## Module documentation

### Auto-generated documentation from JSDoc

## Classes

<dl>
<dt><a href="#PackageStatistics">PackageStatistics</a></dt>
<dd><p>Used to keep track of and work with the statistics collected by this library. I will not document its functions very well, instead check the code for usage examples.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#getPackages">getPackages(maintainerUsername, [publisherUsername])</a> ⇒ <code>Array.&lt;object&gt;</code></dt>
<dd><p>Get all packages where <code>maintainerUsername</code> is listed as one of the maintainers (anyone publishing a package is automatically listed as one). Optionally filter out any packages not published by <code>publisherUsername</code> (this can be used to return only packages published by this user).</p>
</dd>
<dt><a href="#getLastDownloads">getLastDownloads(packages, range)</a> ⇒ <code>object</code> | <code>Array.&lt;object&gt;</code></dt>
<dd><p>Get the daily download counts of a package (or packages) in the given timeframe. If doing a bulk query then limit it to &lt;=128 packages.</p>
</dd>
<dt><a href="#getStatistics">getStatistics(options)</a> ⇒ <code><a href="#PackageStatistics">PackageStatistics</a></code></dt>
<dd><p>Get either download or score statistics of all packages where <code>maintainerUsername</code> is listed as one of the maintainers (anyone publishing a package is automatically listed as one). Optionally filter out any packages not published by <code>publisherUsername</code> (this can be used to return only packages published by this user).</p>
</dd>
<dt><a href="#pushToSlack">pushToSlack(options)</a> ⇒ <code>Promise.&lt;object&gt;</code></dt>
<dd><p>Push provided text to the channel, with customizable username and icon emoji.</p>
</dd>
</dl>

<a name="getPackages"></a>

## getPackages(maintainerUsername, [publisherUsername]) ⇒ <code>Array.&lt;object&gt;</code>
Get all packages where `maintainerUsername` is listed as one of the maintainers (anyone publishing a package is automatically listed as one). Optionally filter out any packages not published by `publisherUsername` (this can be used to return only packages published by this user).

**Kind**: global function  
**Returns**: <code>Array.&lt;object&gt;</code> - An array of objects with details about the packages.  

| Param | Type | Description |
| --- | --- | --- |
| maintainerUsername | <code>string</code> | Get all packages listed with this user as one of its maintainers. |
| [publisherUsername] | <code>string</code> | Return only packages with this user listed as the publisher. |

<a name="getLastDownloads"></a>

## getLastDownloads(packages, range) ⇒ <code>object</code> \| <code>Array.&lt;object&gt;</code>
Get the daily download counts of a package (or packages) in the given timeframe. If doing a bulk query then limit it to <=128 packages.

**Kind**: global function  
**Returns**: <code>object</code> \| <code>Array.&lt;object&gt;</code> - {packageName, dailyDownloads} (in an array if doing a bulk query)  

| Param | Type | Description |
| --- | --- | --- |
| packages | <code>string</code> \| <code>Array.&lt;string&gt;</code> | The package (or packages if an array) to query. |
| range | <code>string</code> | A range/timeframe compatible with the registry API. |

<a name="getStatistics"></a>

## getStatistics(options) ⇒ [<code>PackageStatistics</code>](#PackageStatistics)
Get either download or score statistics of all packages where `maintainerUsername` is listed as one of the maintainers (anyone publishing a package is automatically listed as one). Optionally filter out any packages not published by `publisherUsername` (this can be used to return only packages published by this user).

**Kind**: global function  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>object</code> |  |  |
| options.maintainerUsername | <code>string</code> |  |  |
| options.publisherUsername | <code>string</code> |  |  |
| [options.range] | <code>string</code> | <code>&quot;&#x27;last-month&#x27;&quot;</code> | A range/timeframe compatible with the registry API (used for download stats). |
| [options.withoutDownloads] | <code>boolean</code> |  | To only get score stats. |

<a name="pushToSlack"></a>

## pushToSlack(options) ⇒ <code>Promise.&lt;object&gt;</code>
Push provided text to the channel, with customizable username and icon emoji.

**Kind**: global function  
**Returns**: <code>Promise.&lt;object&gt;</code> - The result from the Slack Web API.  

| Param | Type | Default |
| --- | --- | --- |
| options | <code>object</code> |  | 
| options.token | <code>string</code> |  | 
| options.channel | <code>string</code> |  | 
| options.text | <code>string</code> |  | 
| [options.username] | <code>string</code> | <code>&quot;&#x27;npm-downloads-counter&#x27;&quot;</code> | 
| [options.icon_emoji] | <code>string</code> | <code>&quot;&#x27;:bar_chart:&#x27;&quot;</code> | 


## The End

```
Aliens (as in extra-terrestrial and extra-dimensional beings) 
are visiting our planet, also abducting people. 
They're mostly friendly though, I had one next to my bed once, 
it just stared at me while I was sleeping.
```
