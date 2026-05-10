# Duebly Remote Backend Deployment (Worker + R2 + Terraform)

## 1. Configure Cloudflare and Kinde values

1. Create a Cloudflare API token with:
   - Account: **Workers R2 Storage (Edit)**, **Workers Scripts (Edit)**
   - Zone (`duebly.app`): **DNS (Edit)**, **Workers Routes (Edit)**
2. Collect:
   - `cloudflare_account_id`
   - `cloudflare_zone_id`
3. Collect Kinde values:
   - `KINDE_ISSUER_URL` (for your Kinde tenant, e.g. `https://<tenant>.kinde.com`)
   - `KINDE_AUDIENCE` (the API audience your frontend token is issued for)

## 2. Provision infrastructure (Terraform)

From `/infrastructure/terraform`:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Fill `terraform.tfvars`, then run:

```bash
export TF_VAR_cloudflare_api_token="<cloudflare_api_token>"
terraform init
terraform plan
terraform apply
```

## 3. Configure Worker runtime

Edit `/wrangler.toml`:

- `r2_buckets.bucket_name` must match the provisioned bucket
- `CORS_ALLOWED_ORIGINS` must include your frontend origins
- `KINDE_ISSUER_URL` and `KINDE_AUDIENCE` must match your Kinde API setup

## 4. Deploy Worker

From repo root:

```bash
npx wrangler deploy
```

**Result**
jerry@Jerrys-MacBook-Air-2 duebly-core % npx wrangler deploy
Need to install the following packages:
wrangler@4.90.0
Ok to proceed? (y) y

 ⛅️ wrangler 4.90.0
───────────────────

Cloudflare collects anonymous telemetry about your usage of Wrangler. Learn more at https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/telemetry.md
Total Upload: 12.87 KiB / gzip: 3.72 KiB
Your Worker has access to the following bindings:
Binding                                                                    Resource                  
env.TASKS_BUCKET (duebly-task-data)                                        R2 Bucket                 
env.CORS_ALLOWED_ORIGINS ("https://duebly.app,http://localhost:5...")      Environment Variable      
env.KINDE_ISSUER_URL ("https://duebly.kinde.com")                          Environment Variable      
env.KINDE_AUDIENCE ("https://api.duebly.app")                              Environment Variable      
env.MAX_TASKS_PER_USER ("5000")                                            Environment Variable      
env.MAX_PAYLOAD_BYTES ("1000000")                                          Environment Variable      

Uploaded duebly-api (2.57 sec)
Deployed duebly-api triggers (0.78 sec)
  https://duebly-api.jerryschen.workers.dev
Current Version ID: cfd53de9-a488-4b53-a2ff-3e4d36aa6f6b

## 5. Connect frontend sync calls

Frontend should call:

- `GET https://api.duebly.app/v1/tasks`
- `PUT https://api.duebly.app/v1/tasks`

With headers:

- `Authorization: Bearer <kinde_access_token>`
- `Content-Type: application/json` (for PUT)

The Worker stores user snapshots at `users/{sub}/tasks.v1.json` in R2.

So for Step 5, what remains is on the frontend side:

Call https://api.duebly.app/v1/tasks for GET/PUT.
Send Kinde access token in Authorization header.
Send Content-Type: application/json for PUT.
Serialize/deserialize the tasks payload your UI state uses.