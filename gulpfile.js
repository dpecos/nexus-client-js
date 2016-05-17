var gulp = require('gulp');
var ts = require('gulp-typescript');
var mocha = require('gulp-mocha');

var tsProject = ts.createProject('tsconfig.json');

gulp.task('compile', function() {
  var tsResult = tsProject.src().pipe(ts(tsProject));

  return tsResult.js.pipe(gulp.dest('build'));
});

gulp.task('test', function() {
  gulp.src('build/test/*').pipe(mocha({reporter: 'nyan'}));
});

gulp.task('watch', ['compile', 'test'], function () {
  gulp.watch(['**/*.ts', '!build/', '!node_modules/', '!typings/'], ['compile', 'test']);
});

gulp.task('default', ['compile', 'test'], function () {});
