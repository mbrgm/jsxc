// stdin -> stdout (with `-` as an arg)
// single filename in -> stdout
// dir in dir out
// --watch
// --extension

var chokidar = require('chokidar');
var fs = require('fs');
var glob = require('glob');
var optimist = require('optimist');
var path = require('path');
var transform = require('react-tools').transform;

function handleChange(args, changedPath) {
  var startTime = Date.now();
  var src = path.resolve(args.argv._[0]);
  var dest = path.resolve(args.argv._[1]);

  var absoluteChangedPath = path.resolve(changedPath);
  var newExt = 'js';
  if (args.argv.extension[0] === '.') {
    newExt = '.js';
  }
  var changedDest = absoluteChangedPath.replace(src, dest).replace(args.argv.extension, newExt);
  fs.readFile(absoluteChangedPath, {encoding: 'utf8'}, function(err, changedSrc) {
    if (err) {
      console.error(err);
      return;
    }
    fs.writeFile(changedDest, transform(changedSrc), {encoding: 'utf8'}, function(err) {
      if (err) {
        console.error(err);
      }

      if (args.argv.s) {
        return;
      }

      var duration = Date.now() - startTime;
      console.log(
        '[' + new Date() + '] ' + JSON.stringify(absoluteChangedPath) + ' -> ' + JSON.stringify(changedDest) + ' (' + duration.toFixed(0) + ' ms)'
      );
    });
  });
}

function main() {
  var args = optimist
    .usage(
      'Convert files containing JSX syntax to regular JavaScript.\n' +
      'Usage:\n' +
      '  $0 [input file] [output file] (convert a single file)\n' +
      '  $0 [input file] (convert a single file and print to stdout)\n' +
      '  $0 - (convert stdin and print to stdout)\n' +
      '  $0 [--extension .js] --watch [src dir] [dest dir] (watch src dir and place converted files in dest dir)'
    )
    .alias('w', 'watch')
    .boolean('w')
    .describe('w', 'Watch a directory for changes')
    .alias('e', 'extension')
    .string('e')
    .default('e', '.js')
    .describe('e', 'Extension of files containing JSX syntax')
    .alias('s', 'silent')
    .boolean('s')
    .describe('s', 'Don\'t display non-error logging')
    .default('s', false)
    .alias('h', 'help')
    .boolean('h')
    .describe('h', 'Show this help message');

  if (args.argv.h || args.argv._.length === 0 || args.argv._.length > 2) {
    console.error(args.help());
    process.exit(1);
  }

  if (args.argv._.length === 1) {
    if (args.argv._[0] === '-') {
      // read from stdin
      var buf = '';
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function(chunk) {
        buf += chunk;
      });
      process.stdin.on('end', function() {
        process.stdout.write(transform(buf));
        process.exit(0);
      });
    } else {
      process.stdout.write(
        transform(fs.readFileSync(args.argv._[0], {encoding: 'utf8'}))
      );
      process.exit(0);
    }
  } else if (args.argv.watch) {
    if (!args.argv._.length === 2) {
      console.error(args.help());
      process.exit(1);
    }

    var watcher = chokidar.watch(args.argv._[0], {
      ignored: function(path) {
        return path.slice(path.length - args.argv.extension.length) !== args.argv.extension;
      },
      persistent: args.argv.w
    });

    watcher.on('add', handleChange.bind(null, args));
    watcher.on('change', handleChange.bind(null, args));
  } else {
    var srcDir = fs.lstatSync(args.argv._[0]).isDirectory();
    var destDir = fs.lstatSync(args.argv._[1]).isDirectory();
    if (srcDir !== destDir) {
      console.error(args.help());
      process.exit(1);
    }

    if (!srcDir) {
      var transformedSrc = transform(
        fs.readFileSync(args.argv._[0], {encoding: 'utf8'})
      );
      fs.writeFileSync(args.argv._[1], transformedSrc, {encoding: 'utf8'});
      process.exit(0);
    } else {
      var newExt = 'js';
      if (args.argv.extension[0] === '.') {
        newExt = '.js';
      }
      glob(path.join(args.argv._[0], '**', '*' + args.argv.extension), {}, function(err, files) {
        if (err) {
          console.error(err);
          process.exit(1);
        }
        files.forEach(handleChange.bind(null, args));
      });
    }
  }
}

module.exports = {
  main: main
};