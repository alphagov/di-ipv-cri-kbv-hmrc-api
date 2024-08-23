# DI Lime - MHRC KBV API Tests - JEST Supertest API Test Framework

Jest is a JavaScript Testing Framework with a focus on simplicity, which can also be used with TypeScript.
Supertest allows for HTTP assertions.

#### The purpose of this project is automate API functionality of the HMRC KBV CRI. The framework configurations can be found in jest-cucumber-config.js file in the feature-tests folder of the project.

## This project uses:

- Cucumber-Jest
- Supertest
- Typescript
- npm
- docker

## Command to run tests

Set up the following env vars.

```shell
cd feature-tests
npm install && npm build
```

To run all API tests locally in Jest via Jest.

API Feature-Tests

```shell
tagFilter=@pre-merge npm test
```

FE Feature-Tests

```shell
npm test:browser
```

To run all API tests locally as the Test Container would do.

```shell
sh run-tests.sh
```

## Command to build and run in docker

Builds an image using assets in project then create a running instance of the image.

```shell
cd feature-tests
docker build -t hmrc-kbv-api-feature-tests-image .
```

once the docker image is built, run the following the execute the dockerfile

```shell
docker run hmrc-kbv-api-feature-tests-image:latest
```

## Environment configuration

If new values are added to **endpoints.ts**, associated values will then need to be added to the main template

## ESLint for Typescript

ES Lint has been configured for the typescript code within the framework

To check the ES Linting, run **lint:code** in the command line

run **lint:code:fix** to fix some issues found
