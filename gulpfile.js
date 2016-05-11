var gulp = require('gulp');
var ts = require('gulp-typescript');
var nodemon = require('gulp-nodemon');

var tsProject = ts.createProject('tsconfig.json');

gulp.task('compile', function() {
  var tsResult = tsProject.src().pipe(ts(tsProject));

  return tsResult.js.pipe(gulp.dest('build'));
});

gulp.task('build', ['compile'], function () {});

gulp.task('watch', ['build'], function () {
  nodemon({
    script: 'build/demo_client.js',
    ignore: ['build/', 'node_modules/', 'typings/'],
    ext: 'ts json',
    "execMap": {
      "js": "node --harmony"
    },
    tasks: ['compile']
  }).on('restart', function () {
    //console.log('Gulp: Server ready!')
  });
});

gulp.task('default', ['build'], function () {});
