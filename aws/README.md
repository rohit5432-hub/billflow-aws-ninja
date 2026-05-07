# BillFlow — AWS Deployment

Hosts the app as a **static SPA on S3 + CloudFront**, with a **Lambda** API behind
**API Gateway (HTTP API)** and **DynamoDB** for storage. CloudFront routes `/api/*`
to API Gateway and everything else to the S3 origin (with SPA fallback to `index.html`).

## Architecture

```
                ┌────────────────────────┐
 Browser ─────► │       CloudFront       │
                │  / (SPA) ─► S3 bucket  │
                │  /api/*  ─► HTTP API ──┼──► Lambda ──► DynamoDB
                └────────────────────────┘
```

- **S3** — stores the built SPA (`dist/`). Locked down via Origin Access Control; only CloudFront can read.
- **CloudFront** — CDN, HTTPS, SPA 404→`index.html`, `/api/*` proxy to API Gateway.
- **API Gateway (HTTP API)** — single `ANY /{proxy+}` route forwarding to Lambda.
- **Lambda (Node 20, arm64)** — one function (`aws/lambda/index.js`) routing all REST endpoints.
- **DynamoDB** — single table, `PK`/`SK` design, on-demand billing, PITR enabled.

## Prerequisites

- AWS account + AWS CLI v2 configured (`aws configure`)
- AWS SAM CLI (`brew install aws-sam-cli` or [docs](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- Node 20+, [bun](https://bun.sh)

## Deploy

```bash
cd aws
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. `npm install` Lambda dependencies
2. `sam deploy` the CloudFormation stack (DynamoDB, Lambda, API, S3, CloudFront)
3. Build the frontend with `VITE_API_URL=/api` (so it calls the same domain)
4. Upload `dist/` to S3 with proper cache headers
5. Invalidate the CloudFront cache

Subsequent **frontend-only** deploys:

```bash
./deploy.sh --frontend-only
```

## REST Endpoints

| Method | Path                       | Description                    |
|--------|----------------------------|--------------------------------|
| GET    | `/api/health`              | Health check                   |
| GET    | `/api/company`             | Get company info               |
| PUT    | `/api/company`             | Upsert company info            |
| GET    | `/api/customers`           | List customers                 |
| POST   | `/api/customers`           | Create customer                |
| PUT    | `/api/customers/:id`       | Update customer                |
| DELETE | `/api/customers/:id`       | Delete customer                |
| GET    | `/api/invoices`            | List invoices                  |
| POST   | `/api/invoices`            | Create invoice (auto number)   |
| GET    | `/api/invoices/:id`        | Get one invoice                |
| PUT    | `/api/invoices/:id`        | Update invoice                 |
| DELETE | `/api/invoices/:id`        | Delete invoice                 |
| PUT    | `/api/invoices/:id/status` | Update status (paid/pending)   |
| GET    | `/api/users`               | List team users                |
| POST   | `/api/users`               | Create user                    |
| PUT    | `/api/users/:id`           | Update user                    |
| DELETE | `/api/users/:id`           | Delete user                    |

## Frontend API Client

The frontend uses `src/lib/api.ts` as the single REST client. It is enabled when
the `VITE_API_URL` environment variable is set at build time. When unset
(default in Lovable preview), the app falls back to its in-browser `zustand`
store so development continues to work without AWS.

## Cost (rough, low-traffic)

- DynamoDB on-demand: pennies/month at light usage
- Lambda + HTTP API: free tier covers thousands of requests
- S3 + CloudFront: < $1/mo for a small site
- No always-on resources

## Cleanup

```bash
aws cloudformation delete-stack --stack-name billflow-prod --region ap-south-1
# Then empty + delete the S3 bucket (it is retained on stack delete by default).
```

## Notes

- Stack region defaults to `ap-south-1`. Override with `AWS_REGION=us-east-1 ./deploy.sh`.
- DynamoDB schema is intentionally simple (single table). Add a GSI later if you need to query invoices by customer or date efficiently.
- Auth is **not** implemented on the API layer. For production add Cognito + a JWT authorizer on the HTTP API, or signed requests via CloudFront.
- **Static-only build**: the project is built on TanStack Start (which supports SSR). For S3 hosting we run `vite build` and rely on the SPA fallback in CloudFront (404/403 → `/index.html`). All routing happens client-side; no SSR is executed in AWS. If `dist/client` is empty after build, run `bunx vite build` directly and check `vite.config.ts` for an SSR-only output target — the `@lovable.dev/vite-tanstack-config` preset emits client assets to `dist/client/`.
