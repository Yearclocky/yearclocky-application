## Application

The application is exposed through a single AWS Lambda function named `api-handler`.
Routing, validation, and business logic all live inside that Lambda for these HTTP
resource trees:

- `/categories`
- `/memberships`
- `/task-completions`
- `/tasks`
- `/yearclocks`
- `/users`

The CDK package exports a reusable `YearclockyApplication` construct that creates:

- the shared Lambda
- an HTTP API
- API routes that forward the six resource trees to the same handler

The application data model now follows the repository `plan.md`:

- `Yearclock`
- `User`
- `Membership`
- `Category`
- `Task`
- `TaskCompletion`

Task completion is stored as per-month events. `GET /tasks?year=YYYY&month=M&yearclockId=...`
returns the grouped month view used by the UI, with active tasks first and completed
tasks separated per category.

### Scripts

- `npm run build` compiles the application package.
- `npm run build --workspace yearclocky-application` compiles the CDK package.
- `npm run cdk:synth` synthesizes the infrastructure template.
