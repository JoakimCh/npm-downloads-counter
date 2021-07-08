# npm-downloads-counter

This is a [CLI](https://en.wikipedia.org/wiki/Command-line_interface) tool (and an [ES module](https://nodejs.org/api/esm.html)) to output an overview of the (last 30 days) download activity of all the packages maintained (or published) by a certain [NPM](https://www.npmjs.com/) username.

I created this mainly because I wanted an easy way to monitor the popularity of the [packages I've published](https://www.npmjs.com/~joakimch). The list returned is sorted so the most popular packages are on top.

## How to use
To list all packages published by a user (e.g. to list packages published by yourself):
```bash
npx npm-downloads-counter npm_username
```

To list all packages maintained by a user (a package can have several maintainers though):
```bash
npx npm-downloads-counter -m npm_username
```

## Example output:
Please note that some text renders doesn't output the [unicode glyphs](https://en.wikipedia.org/wiki/Braille_Patterns) below in a monospaced format (but my terminal emulator does, and if yours doesn't you might want to get one that does).
```
Download count of packages published by "joakimch" the last 30 days:
|⢀⢀⢀    ⢀⢀⣀ ⢀ ⢀⢀⢀⢀⣾         ⢀ ⣿| bit-consumer 0-22 (62)
|⢀ ⢀          ⢀⢀  ⣿       ⢀   ⣿| base-endecoder 0-20 (43)
|      ⢀       ⢀⢀ ⣾           ⣿| bit-manipulation 0-21 (42)
|      ⢀   ⢀   ⣀⣠⢀⢀    ⣿⢀⢀    ⢀| pluggable-prng 0-19 (38)
|⢀         ⢀   ⢀      ⢀⣿       | platform-checker 0-18 (23)
|⢀⢀⢀      ⢀   ⢀⣀          ⢀    | whichever-data 0-2 (8)

Download count of packages maintained by "bnjmnt4n" the last 30 days:
|⣿⣿⣿⣿⣷⢀⢀⣾⣿⣿⣿⣶ ⢀⣾⣿⣿⣿⣷⢀⢀⣾⣿⣿⣿⣶⢀⢀⣶⣾| lodash 2006900-7970449 (177202296)
|⣿⣿⣿⣿⣷⢀⢀⣾⣿⣿⣿⣶⢀⢀⣾⣿⣿⣿⣷⢀⢀⣿⣿⣿⣿⣶ ⢀⣶⣾| regjsgen 599779-3022651 (65719706)
|⣿⣿⣿⣿⣷⢀⢀⣾⣿⣿⣿⣶⢀⢀⣾⣿⣿⣿⣶⢀⢀⣿⣿⣿⣿⣶ ⢀⣶⣾| json3 344146-1848174 (39503830)
|⣿⣿⣿⣿⣷⢀⢀⣾⣿⣿⣿⣶⢀⢀⣾⣿⣿⣿⣷⢀⢀⣾⣿⣿⣿⣶ ⢀⣶⣿| lodash-es 146802-987157 (20893231)
|⣿⣿⣿⣿⣷⢀⢀⣾⣿⣿⣿⣶ ⢀⣿⣿⣿⣿⣷⢀⢀⣿⣿⣿⣿⣷⢀⢀⣶⣿| platform 91968-394454 (8783505)
|⣾⣷⣾⣿⣶⢀⢀⣾⣶⣾⣶⣶⢀⢀⣶⣿⣿⣷⣶⢀⢀⣾⣾⣿⣶⣤⢀ ⣴⣶| lodash-webpack-plugin 5042-50066 (915812)
|⣀⢀⢀⣀   ⢀⢀⢀⢀⢀ ⢀⢀ ⢀       ⣿   ⢀ | reveal-code-focus 0-18 (38)
| ⢀⢀⢀⢀⢀    ⢀ ⢀⢀⢀  ⢀    ⣀ ⣿   ⢀ | spotlight 0-18 (37)

Download count of packages published by "bnjmnt4n" the last 30 days:
|⣿⣿⣿⣿⣷⢀⢀⣾⣿⣿⣿⣶ ⢀⣾⣿⣿⣿⣷⢀⢀⣾⣿⣿⣿⣶⢀⢀⣶⣾| lodash 2006900-7970449 (177202296)
|⣿⣿⣿⣿⣷⢀⢀⣾⣿⣿⣿⣶⢀⢀⣾⣿⣿⣿⣷⢀⢀⣾⣿⣿⣿⣶ ⢀⣶⣿| lodash-es 146802-987157 (20893231)
|⣾⣷⣾⣿⣶⢀⢀⣾⣶⣾⣶⣶⢀⢀⣶⣿⣿⣷⣶⢀⢀⣾⣾⣿⣶⣤⢀ ⣴⣶| lodash-webpack-plugin 5042-50066 (915812)
```

## Output explained

I've designed the output from this tool to be as minimal as it can get to easily fit in most terminal windows. Hence I feel the need to explain what you're looking at.

Each line represents a different package.

It begins with a bar graph (cleverly using unicode braille characters) to represent the "download pressure" of the last 30 days. Where a space represents a download count thay day equal to the least amount of daily downloads of this period. Whereas a ⣿ symbol represents the maximum amount (but is not used when the maximum is less than 8 downloads).

The graph is followed by the package name and some min-max numbers representing the minimum and maximum daily downloads of this period. Which is then followed by a number representing the total of downloads this period.

The lines are sorted so that the packages on top are the ones with the highest amount of downloads this period.

## Future plans

I'm planning to implement some more features to this, e.g. to get notified about packages suddenly climbing in popularity etc.

Maybe even a Slack bot to push daily notifications.

So keep an eye on this if you find that interesting.

## Funding

If you find this useful then please consider helping me out (I'm jobless and sick). For more information visit my [GitHub profile](https://github.com/JoakimCh).

## Usage as an ES module

For now there's not many functions (just enough for the CLI tool), check the documentation below to learn about them.

## Module documentation

### Auto-generated documentation from JSDoc

{{>main}}

## The End

*Aliens (as in extra-terrestrial and extra-dimensional) are visiting our planet, also abducting people. They're mostly friendly though.*
