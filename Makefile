AWS_REGION ?= eu-central-1
AWS_ACCOUNT_ID ?= 533115990704
CODEARTIFACT_DOMAIN ?= yearclocky
CODEARTIFACT_REPOSITORY ?= github
PACKAGE_WORKSPACE ?= yearclocky-application

.PHONY: ci-install build-app build-cdk build codeartifact-login publish-app ci-publish-app

ci-install:
	npm ci

build-app:
	npm run build --workspace $(PACKAGE_WORKSPACE)

build-cdk:
	npm run build --workspace yearclocky-cdk

build: build-app build-cdk

codeartifact-login:
	aws codeartifact login --tool npm --domain $(CODEARTIFACT_DOMAIN) --domain-owner $(AWS_ACCOUNT_ID) --repository $(CODEARTIFACT_REPOSITORY) --region $(AWS_REGION)

publish-app:
	npm publish --workspace $(PACKAGE_WORKSPACE)

ci-publish-app: ci-install build-app codeartifact-login publish-app
