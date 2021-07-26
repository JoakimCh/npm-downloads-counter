# Changelog

Changelog for the [npm-downloads-counter](https://www.npmjs.com/package/npm-downloads-counter) NPM package.

## v2.0.1 - 2021.07.26:

### Changed

* Updated the readme with details on how to get colors, etc...
* The output of --paths on Windows to only use forward slashes (Windows is compatible with them yes).


## v2.0.0 - 2021.07.23:

Some new features. E.g. support for Slack notifications and the output of score statistics.

### Added

* Support for comparing the latest statistics with the previous statistics to indicate which packages are climbing or falling in the list. With a summary of which packages climbed to higher positions. (on by default)

* Support for outputting score-statistics instead of download-statistics (`--score`).

* Support for pushing notifications to your [Slack](https://slack.com/) channel of choice whenever you run the CLI and it downloaded updated statistics (e.g. to receive daily download and/or score stats).

* Support for changing some options (mostly in regards to the output) by editing a config.json file (this is also where you would configure the Slack notifications).

* Support for a smaller bar chart (optional) where each braille symbol can represent two bars (two days).

* CLI colors enabled when [chalk](https://www.npmjs.com/package/chalk) is detected¹ (can be turned off).

* CLI links enabled when [terminal-link](https://www.npmjs.com/package/terminal-link) is detected¹ (can be turned off).

*1: Detected as in installed as a dependency or globally available package.*

### Fixed

* In the downloads-graph use U+2800 (Braille Pattern Blank) instead of space to maintain a monospaced (fixed width) graph.

* A bug limiting the package list to only the most 20 popular packages.


## v1.0.0 - 2021.07.08:

Initial release.

Basic functionality for outputting a list showing the download activity of every package with the specified NPM username listed as author or maintainer.
