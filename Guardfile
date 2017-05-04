guard :shell do
  watch %r{^src/.*\.js$} do |m|
    system "yarn run flow"
  end
end
