test:
	npm test
	python3 -I pipeline/py/run.py test

hooks:
	git config core.hooksPath .githooks

emit:
	node sites/hacrp/pipeline/emit.js
	python3 -I pipeline/py/run.py emit

build:
	npm run build

serve:
	node pipeline/site/serve.js

# make refresh SITE=hacrp: a dry run (data/pinned and data/emitted change in the working tree; nothing is committed).
# PR=1 also commits them on a branch, pushes it and opens a draft pull request. See pipeline/py/pp_pipeline/refresh.py.
refresh:
	python3 -I pipeline/py/run.py refresh $(SITE) $(if $(filter 1,$(PR)),--pr)

.PHONY: test hooks emit build serve refresh
