## Application

The application is exposed through a single AWS Lambda function named `api-handler`.
Routing, validation, and business logic all live inside that Lambda for these HTTP
resource trees:

- `/tasks`
- `/yearclocks`
- `/users`

The CDK package exports a reusable `YearclockyApplication` construct that creates:

- the shared Lambda
- an HTTP API
- API routes that forward the three resource trees to the same handler

### Scripts

- `npm run build` compiles the application package.
- `npm run build --workspace yearclocky-cdk` compiles the CDK package.
- `npm run cdk:synth` synthesizes the infrastructure template.
