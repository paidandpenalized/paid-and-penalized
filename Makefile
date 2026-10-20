test:
	npm test

hooks:
	git config core.hooksPath .githooks

emit:
	node sites/hacrp/pipeline/emit.js

.PHONY: test hooks emit
