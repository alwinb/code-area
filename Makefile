.PHONY: all clean

all: build/code-area.js build/code-area.min.js

build/:
	mkdir ./build

build/code-area.js: build/
	browserify ./lib/browser.js > ./build/code-area.js

build/code-area.min.js: build/code-area.js
	cat ./build/code-area.js | uglifyjs -m -c > ./build/code-area.min.js

clean:
	rm -r ./build

