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
	npm publish --workspace $(PACKAGE_WORKSPACE)

ci-publish-package: ci-install build-cdk codeartifact-login publish-package

next-release-version:
	@latest_tag=$$(git tag --list '*.*.*' --sort=-v:refname | head -n 1); \
	if [ -z "$$latest_tag" ]; then \
		echo 0.1.0; \
	else \
		IFS=. read -r major minor patch <<EOF; \
$$latest_tag \
EOF \
		echo "$$major.$$((minor + 1)).0"; \
	fi

set-package-version:
	test -n "$(VERSION)"
	npm version $(VERSION) --workspace $(PACKAGE_WORKSPACE) --no-git-tag-version

verify-package-version:
	test -n "$(VERSION)"
	test "$$(node -p "require('./cdk/package.json').version")" = "$(VERSION)"
