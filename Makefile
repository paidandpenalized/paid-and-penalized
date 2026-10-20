test:
	npm test
	python3 -I pipeline/py/run.py test

hooks:
	git config core.hooksPath .githooks

emit:
	node sites/hacrp/pipeline/emit.js
	python3 -I pipeline/py/run.py emit

build:
	node pipeline/site/build.js

serve:
	node pipeline/site/serve.js

.PHONY: test hooks emit build serve
