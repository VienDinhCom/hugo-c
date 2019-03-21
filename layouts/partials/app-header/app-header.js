function hello(callback) {
  callback();
}

hello(function() {
  return 1;
});
