const fs = require('fs');
const path = require('path');
const gulp = require('gulp');
const colors = require('colors');
const cssnano = require('cssnano');
const $ = require('gulp-load-plugins')();
const browserSync = require('browser-sync');
const autoprefixer = require('autoprefixer');
const bufferReplace = require('buffer-replace');
const postcssPresetEnv = require('postcss-preset-env');
const postcssImport = require('postcss-import');
const postcssUrl = require('postcss-url');
const postcssCopyAssets = require('postcss-copy-assets');

function getPaths() {
  const root = __dirname;
  const src = path.join(root, 'src/layouts');
  const dist = path.join(root, 'build');

  return {
    src: {
      base: src,
      components: path.join(src, 'partials'),
      global: path.join(src, 'global'),
      images: path.join(src, 'images/**/*'),
      vendor: path.join(src, 'vendor'),
    },
    dist: {
      base: dist,
      assets: path.join(dist, 'assets'),
      images: path.join(dist, 'assets/images'),
      vendor: path.join(dist, 'assets/vendor'),
    },
  };
}

function getComponentPaths(ext) {
  const { components } = getPaths().src;
  const globalFile = path.join(getPaths().src.base, `global/global${ext}`);
  const files = fs
    .readdirSync(components)
    .filter(function(component) {
      return fs.lstatSync(path.join(components, component)).isDirectory();
    })
    .map(function(component) {
      return path.join(components, component, component + ext);
    })
    .filter(function(file) {
      return fs.existsSync(file) && fs.lstatSync(file).isFile();
    });

  if (fs.existsSync(globalFile) && fs.lstatSync(globalFile).isFile()) {
    files.unshift(globalFile);
  }

  return files;
}

gulp.task('styles', function() {
  return gulp
    .src(getComponentPaths('.scss'))
    .pipe($.sourcemaps.init())
    .pipe(
      $.tap(function(styleFile) {
        const component = path.basename(styleFile.path).replace('.scss', '');

        if (component === 'global') {
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
          console.log('\n' + styleFile.path.underline); // eslint-disable-line
          console.log( // eslint-disable-line
            `${colors.grey(' 1:1') +
              '  ✖  '.red}Missing the ':host' selector at the first line.`
          );

          return null;
        }

        styleFile.contents = bufferReplace( // eslint-disable-line
          Buffer.from(styleFile.contents),
          ':host',
          `/* Component: .${component}\n--------------------------------------------------*/\n.${component}`
        );

        return null;
      })
    )
    .pipe($.concat('app.css', { newLine: '\n' }))
    .pipe(
      $.sass({ outputStyle: 'expanded' }).on(
        'error',
        ({ file, line, column, message }) => {
          const currentFileName = path.basename(file);

          const newFileName = `${path
            .dirname(file)
            .split(path.sep)
            .pop()}.scss`;

          console.error( // eslint-disable-line
            colors.grey(` ${line}:${column}`) +
              '  ✖  '.red +
              message.split(currentFileName).join(newFileName)
          );
        }
      )
    )
    .pipe(
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
    .pipe($.sourcemaps.write('./maps'))
    .pipe(gulp.dest(getPaths().dist.assets))
    .pipe(browserSync.stream());
});

gulp.task('scripts', function scripts() {
  return gulp
    .src(getComponentPaths('.js'))
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
        '/* Component: :host\n--------------------------------------------------*/\n'
      ))
    )
    .pipe(
      $.if(function(file) {
        return path.basename(file.path) !== 'global.js';
      }, $.insert.append('\n});\n'))
    )
    .pipe(
      $.tap(function(scriptFile) {
        const component = path.basename(scriptFile.path).replace('.js', '');

        if (component === 'global') return null;

        scriptFile.contents = bufferReplace( // eslint-disable-line
          Buffer.from(scriptFile.contents),
          ':host',
          `.${component}`
        );

        return null;
      })
    )
    .pipe(
      $.babel({
        presets: ['@babel/env'],
      })
    )
    .pipe($.concat('app.js'))
    .pipe($.uglify())
    .pipe($.sourcemaps.write('./maps'))
    .pipe(gulp.dest(getPaths().dist.assets))
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
          base: path.join(getPaths().dist.assets, 'vendor'),
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
    .pipe($.sourcemaps.write('./maps'))
    .pipe(gulp.dest(getPaths().dist.assets))
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
    .pipe($.sourcemaps.write('./maps'))
    .pipe(gulp.dest(getPaths().dist.assets))
    .on('end', function() {
      browserSync.reload();
    });
});

gulp.task('vendor', gulp.parallel('vendor-scripts', 'vendor-styles'));

gulp.task('images', function images() {
  return gulp
    .src(getPaths().src.images)
    .pipe(
      $.cache(
        $.imagemin({
          progressive: true,
          interlaced: true,
        })
      )
    )
    .pipe(gulp.dest(getPaths().dist.images))
    .on('end', function() {
      browserSync.reload();
    });
});

gulp.task('clean', function() {
  return gulp.src(`${getPaths().dist.base}/*`).pipe($.clean({ force: true }));
});

gulp.task(
  'build',
  gulp.series('clean', gulp.parallel('scripts', 'styles', 'images', 'vendor'))
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
  $.watch(
    [path.join(getPaths().src.base, 'images/**/*')],
    gulp.parallel('images')
  );

  $.watch(
    [path.join(getPaths().src.base, 'vendor/**/*.{scss,css}')],
    gulp.parallel('vendor-styles')
  );

  $.watch(
    [path.join(getPaths().src.base, 'vendor/**/*.js')],
    gulp.parallel('vendor-scripts')
  );

  $.watch(
    [
      path.join(getPaths().src.base, 'global/**/*.scss'),
      path.join(getPaths().src.components, '**/*.scss'),
    ],
    gulp.parallel('styles')
  );

  $.watch(
    [
      path.join(getPaths().src.base, 'global/**/*.js'),
      path.join(getPaths().src.components, '**/*.js'),
    ],
    gulp.parallel('scripts')
  );
});

gulp.task('default', gulp.series('build', gulp.parallel('watch', 'serve')));

// https://github.com/htanjo/css-bundling
// https://parceljs.org/getting_started.html
