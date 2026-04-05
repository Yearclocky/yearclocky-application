AWS_REGION ?= eu-central-1
AWS_ACCOUNT_ID ?= 533115990704
CODEARTIFACT_DOMAIN ?= yearclocky
CODEARTIFACT_REPOSITORY ?= github
PACKAGE_WORKSPACE ?= yearclocky-cdk
VERSION ?=

.PHONY: ci-install build-app build-cdk build codeartifact-login publish-package ci-publish-package next-release-version set-package-version verify-package-version

ci-install:
	npm ci

build-app:
	npm run build --workspace $(PACKAGE_WORKSPACE)

build-cdk:
	npm run build --workspace yearclocky-cdk

build: build-app build-cdk

codeartifact-login:
	aws codeartifact login --tool npm --domain $(CODEARTIFACT_DOMAIN) --domain-owner $(AWS_ACCOUNT_ID) --repository $(CODEARTIFACT_REPOSITORY) --region $(AWS_REGION)

publish-package:
	test -n "$(VERSION)"
	@package_dir=$$(mktemp -d); \
	trap 'rm -rf "$$package_dir"' EXIT; \
	cp cdk/package.json "$$package_dir/package.json"; \
	node -e "const fs=require('fs'); const path=process.argv[1]; const version=process.argv[2]; const pkg=JSON.parse(fs.readFileSync(path,'utf8')); pkg.version=version; fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');" "$$package_dir/package.json" "$(VERSION)"; \
	cp -R cdk/dist "$$package_dir/dist"; \
	cp -R cdk/lambda "$$package_dir/lambda"; \
	cp -R cdk/lib "$$package_dir/lib"; \
	npm publish "$$package_dir"

ci-publish-package: ci-install build-cdk codeartifact-login
	$(MAKE) publish-package VERSION=$(VERSION)

next-release-version:
	@latest_tag=$$(git tag --list '*.*.*' --sort=-v:refname | head -n 1); \
	if [ -z "$$latest_tag" ]; then \
		echo 0.1.0; \
	else \
		major=$${latest_tag%%.*}; \
		rest=$${latest_tag#*.}; \
		minor=$${rest%%.*}; \
		echo "$$major.$$((minor + 1)).0"; \
	fi

set-package-version:
	test -n "$(VERSION)"
	node -e "const fs=require('fs'); const pkg='cdk/package.json'; const lock='package-lock.json'; const version=process.argv[1]; const update=(file, fn) => { const data=JSON.parse(fs.readFileSync(file,'utf8')); fn(data); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); }; update(pkg, data => { data.version = version; }); update(lock, data => { if (data.packages && data.packages.cdk) data.packages.cdk.version = version; });" "$(VERSION)"

verify-package-version:
	test -n "$(VERSION)"
	test "$$(node -p "require('./cdk/package.json').version")" = "$(VERSION)"
