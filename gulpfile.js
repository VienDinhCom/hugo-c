const fs = require('fs');
const del = require('del');
const gulp = require('gulp');
const path = require('path');
const colors = require('colors');
const hugo = require('hugo-bin');
const cssnano = require('cssnano');
const $ = require('gulp-load-plugins')();
const postcssUrl = require('postcss-url');
const browserSync = require('browser-sync');
const autoprefixer = require('autoprefixer');
const { execFile } = require('child_process');
const bufferReplace = require('buffer-replace');
const postcssImport = require('postcss-import');
const postcssPresetEnv = require('postcss-preset-env');
const postcssCopyAssets = require('postcss-copy-assets');

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';
const publish = 'build';

function getPaths() {
  const root = __dirname;
  const src = path.join(root, 'src');
  const dist = path.join(root, publish);

  return {
    root,
    src: {
      base: src,
      layouts: path.join(src, 'layouts'),
      partials: path.join(src, 'layouts/partials'),
      global: path.join(src, 'layouts/global'),
      vendor: path.join(src, 'layouts/vendor'),
    },
    dist: {
      base: dist,
      assets: path.join(dist, 'assets'),
      app: path.join(dist, 'assets/app'),
      vendor: path.join(dist, 'assets/vendor'),
    },
  };
}

function logErrors(filePath, messages) {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array.');
  }

  if (messages.length) {
    const newFilePath = filePath.replace(`${getPaths().root}`, '').slice(1);
    console.log(newFilePath.underline); // eslint-disable-line

    messages.forEach(function({ severity, line, column, message }) {
      console.log( // eslint-disable-line
        ` ${colors.grey(`${line}:${column}`)} ${
          ' ✖ '[severity === 2 ? 'red' : 'green']
        } ${message}`
      );
    });

    console.log('\n'); // eslint-disable-line
  }
}

function getPartialFilePaths(ext) {
  const { partials } = getPaths().src;
  const globalFile = path.join(getPaths().src.layouts, `global/global${ext}`);
  const files = fs
    .readdirSync(partials)
    .filter(function(partial) {
      return fs.lstatSync(path.join(partials, partial)).isDirectory();
    })
    .map(function(partial) {
      return path.join(partials, partial, partial + ext);
    })
    .filter(function(file) {
      return fs.existsSync(file) && fs.lstatSync(file).isFile();
    });

  if (fs.existsSync(globalFile) && fs.lstatSync(globalFile).isFile()) {
    files.unshift(globalFile);
  }

  return files;
}

function checkPartialNames() {
  const prefix = 'app-';
  const partialDir = getPaths().src.partials;

  const errorPartials = fs
    .readdirSync(partialDir)
    .filter(
      partial =>
        fs.lstatSync(path.join(partialDir, partial)).isDirectory() &&
        !partial.startsWith(prefix)
    )
    .map(partial => ` ${partial}`);

  const errorLength = errorPartials.length;

  if (errorLength) {
    console.log( // eslint-disable-line
      `\n ${colors.grey(`ERROR`)} ${' ✖ '.red} The name of ${
        errorLength > 1 ? 'these' : 'this'
      } partial${
        errorLength > 1 ? 's' : ''
      } [${errorPartials} ] must start with app-[name].\n`
    );
    if (isTest || isProd) process.exit(1);
  }
}

gulp.task('hugo', function(callback) {
  const args = ['-d', `../${publish}`, '-s', 'src'];

  checkPartialNames();

  if (process.env.DEBUG) args.unshift('--debug');

  if (isProd) {
    args.unshift('--minify');
  } else {
    args.unshift('--buildDrafts');
    args.unshift('--buildFuture');
  }

  execFile(hugo, args, (err, stdout) => {
    if (err) {
      console.log(` ${colors.grey(`ERROR`)} ${' ✖ '.red} ${err}`); // eslint-disable-line
      if (isTest || isProd) process.exit(1);
      return callback();
    }

    browserSync.reload();
    return callback(null, stdout);
  });
});

gulp.task('styles', function() {
  checkPartialNames();

  return gulp
    .src(getPartialFilePaths('.scss'))
    .pipe($.sourcemaps.init())
    .pipe(
      $.tap(function(styleFile) {
        const partial = path.basename(styleFile.path).replace('.scss', '');

        if (partial === 'global') {
          return styleFile.contents
            .toString()
            .split(';')
            .filter(line => line.indexOf('@import') >= 0)
            .forEach(line => {
              const currentPath = line
                .split("'")
                .join('"')
                .split('"')[1];

              const newPath = path.join(getPaths().src.global, currentPath);

              styleFile.contents = bufferReplace( // eslint-disable-line
                Buffer.from(styleFile.contents),
                currentPath,
                newPath
              );
            });
        }

        if (styleFile.contents.toString().indexOf(':host') !== 0) {
          logErrors(styleFile.path, [
            {
              severity: 2,
              line: 1,
              column: 1,
              message: `Missing the ':host' selector at the first line.`,
            },
          ]);

          if (isTest || isProd) process.exit(1);

          return null;
        }

        styleFile.contents = bufferReplace( // eslint-disable-line
          Buffer.from(styleFile.contents),
          ':host',
          `/* Partial: .${partial}\n--------------------------------------------------*/\n.${partial}`
        );

        return null;
      })
    )
    .pipe(
      $.stylelint({
        failAfterError: isTest || isProd,
        fix: true,
        reporters: [{ formatter: 'string', console: true }],
        syntax: 'scss',
      })
    )
    .pipe($.concat('app.css', { newLine: '\n' }))
    .pipe(
      $.sass({ outputStyle: 'expanded' }).on(
        'error',
        ({ file, line, column, message }) => {
          const fileName = `${path
            .dirname(file)
            .split(path.sep)
            .pop()}.scss`;

          const filePath = file.split('app.css').join(fileName);

          logErrors(filePath, [
            {
              severity: 2,
              line,
              column,
              message,
            },
          ]);
        }
      )
    )
    .pipe(
      $.if(
        isProd,
        $.postcss([
          postcssPresetEnv(),
          autoprefixer(),
          cssnano({
            preset: [
              'default',
              {
                discardComments: {
                  removeAll: true,
                },
              },
            ],
          }),
        ])
      )
    )
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest(getPaths().dist.app))
    .pipe(browserSync.stream());
});

gulp.task('scripts', function scripts() {
  checkPartialNames();

  return gulp
    .src(getPartialFilePaths('.js'))
    .pipe($.sourcemaps.init())
    .pipe(
      $.if(function(file) {
        return path.basename(file.path) !== 'global.js';
      }, $.insert.prepend("jQuery(':host').exists(function() {\n"))
    )
    .pipe(
      $.if(function(file) {
        return path.basename(file.path) !== 'global.js';
      }, $.insert.prepend(
        '/* Partial: :host\n--------------------------------------------------*/\n'
      ))
    )
    .pipe(
      $.if(function(file) {
        return path.basename(file.path) !== 'global.js';
      }, $.insert.append('\n});\n'))
    )
    .pipe(
      $.tap(function(scriptFile) {
        const partial = path.basename(scriptFile.path).replace('.js', '');

        if (partial === 'global') return null;

        scriptFile.contents = bufferReplace( // eslint-disable-line
          Buffer.from(scriptFile.contents),
          ':host',
          `.${partial}`
        );

        return null;
      })
    )
    .pipe($.eslint({ fix: true }))
    .pipe(
      $.eslint.result(({ filePath, messages }) => logErrors(filePath, messages))
    )
    .pipe($.if(isTest || isProd, $.eslint.failAfterError()))
    .pipe(
      $.babel({
        sourceType: 'script',
        presets: ['@babel/env'],
      })
    )
    .pipe($.concat('app.js', { newLine: '\n\n' }))
    .pipe($.if(isProd, $.uglify()))
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest(getPaths().dist.app))
    .on('end', function() {
      browserSync.reload();
    });
});

gulp.task('vendor-styles', function() {
  return gulp
    .src(path.join(getPaths().src.vendor, 'vendor.scss'))
    .pipe($.sourcemaps.init())
    .pipe($.sass({ outputStyle: 'expanded' }))
    .pipe(
      $.postcss([
        postcssPresetEnv(),
        postcssImport(),
        postcssUrl({ url: 'rebase' }),
        postcssCopyAssets({
          base: path.join(getPaths().dist.assets, 'vendor/media'),
        }),
        autoprefixer(),
        cssnano({
          preset: [
            'default',
            {
              discardComments: {
                removeAll: true,
              },
            },
          ],
        }),
      ])
    )
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest(getPaths().dist.vendor))
    .pipe(browserSync.stream());
});

gulp.task('vendor-scripts', function() {
  const scripts = require(path.join(getPaths().src.vendor, 'vendor.js')).map( // eslint-disable-line
    script => path.join(getPaths().src.vendor, script)
  );

  return gulp
    .src(scripts)
    .pipe($.sourcemaps.init())
    .pipe($.concat('vendor.js'))
    .pipe($.uglify())
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest(getPaths().dist.vendor))
    .on('end', function() {
      browserSync.reload();
    });
});

gulp.task('vendor', gulp.parallel('vendor-scripts', 'vendor-styles'));

gulp.task('clean', function() {
  return del([getPaths().dist.base], { dot: true });
});

gulp.task(
  'build',
  gulp.series('clean', gulp.parallel('hugo', 'vendor', 'styles', 'scripts'))
);

gulp.task('serve', function() {
  browserSync({
    notify: false,
    logPrefix: ` https://github.com/maxvien `,
    server: getPaths().dist.base,
    open: false,
    port: 8080,
  });
});

gulp.task('watch', function() {
  gulp.watch(
    [
      path.join(getPaths().src.base, 'content/**/*'),
      path.join(getPaths().src.base, 'data/**/*'),
      path.join(getPaths().src.base, 'layouts/**/*.{html,htm}'),
      path.join(getPaths().src.base, 'static/**/*'),
    ],
    gulp.parallel('hugo')
  );

  gulp.watch(
    [path.join(getPaths().src.layouts, 'vendor/**/*.{scss,css}')],
    gulp.parallel('vendor-styles')
  );

  gulp.watch(
    [path.join(getPaths().src.layouts, 'vendor/**/*.js')],
    gulp.parallel('vendor-scripts')
  );

  gulp.watch(
    [
      path.join(getPaths().src.layouts, 'global/**/*.scss'),
      path.join(getPaths().src.partials, '**/*.scss'),
    ],
    gulp.parallel('styles')
  );

  gulp.watch(
    [
      path.join(getPaths().src.layouts, 'global/**/*.js'),
      path.join(getPaths().src.partials, '**/*.js'),
    ],
    gulp.parallel('scripts')
  );
});

gulp.task('default', gulp.series('build', gulp.parallel('watch', 'serve')));
