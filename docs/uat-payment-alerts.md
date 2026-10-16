# UAT payment-delivery failure alerts

Owner-approved Resend integration, restricted to the existing protected sandbox
project and kash.nordeen@gmail.com. This is not production monitoring or a payment
receipt service. No new database permissions or dependency were added.

## Configuration and activation

- Owner creates a **Sending access** Resend key on the free plan, saves it privately,
  and enters it as Production-only Secret `RESEND_API_KEY` in `portfolio-payments-uat`.
  The `onboarding@resend.dev` sender is for the account owner's verified address only;
  a production sender requires separately approved domain verification and rollout.
- `PAYMENT_UAT_ALERTS_ENABLED` defaults false. Apply true to build and runtime only
  after owner configuration/approval. The active UAT preflight refuses a missing or
  malformed sending key. Production, preview, wrong project/origin and unsafe TLS
  cannot activate the endpoint even if this flag is true.
- Opted-in sandbox verification jobs automatically set the fixed callback URL
  `/api/payments/alerts` and privately forward the sandbox automation-bypass header.
  The API key is sent only to `https://api.resend.com/emails`, never to QStash.
- The existing paused recovery schedule must separately receive
  `Upstash-Failure-Callback` set to the fixed stable UAT `/api/payments/alerts` URL,
  plus `Upstash-Failure-Callback-Forward-x-vercel-protection-bypass` containing the
  same UAT key. Owner enters private values; never create a duplicate schedule.
- Do not resume recovery until its new-header delivery is proven. Do not claim
  alerts operational until a signed exhausted-delivery callback and receipt in
  the owner's inbox are both verified. No real payment is needed for this test.

## Security and operational boundaries

- QStash signature, exact callback URL, JSON content type, 64 KiB size limit and
  four-second body deadline are enforced before any external email request.
- Only exhausted three-retry POST failures for the exact UAT jobs/recovery routes
  qualify. Original job bodies must be an opaque UUID only; recovery must be `{}`
  with the reviewed schedule ID. Wrong-site notifications cannot trigger mail.
- Raw source/response headers, bodies, URL parameters, IPs, message IDs and customer
  data are neither logged nor emailed. The only variable email fields are the fixed
  failure category and the current UTC hour. Provider errors are generic and retryable.
- Resend idempotency coalesces each of the two categories to one accepted email per
  UTC hour (up to 48 distinct windows/day, within the provider's 24-hour idempotency
  retention). These are window summaries, not individual incident counts. No database
  is required to send, so a database outage can still produce a failure alert.
- Failure callbacks themselves can fail or reach DLQ, and this path cannot detect
  missing/paused schedules, a disabled account, quota exhaustion before publication,
  or a general outage of QStash/Resend. Check those dashboards independently; this
  integration is not an SLA or complete production observability solution.
- Keep the key private, sending-only, and out of local env files, source and logs.
  No paid upgrade, billing information, live activation or Git push is authorized.

References: [QStash failure callbacks](https://upstash.com/docs/qstash/features/callbacks),
[signature verification](https://upstash.com/docs/qstash/howto/signature),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Private API-based completion when the dashboard lacks callback forwarding

The inspected Request Builder exposed `Upstash-Forward-*` but not the separate
`Upstash-Failure-Callback-Forward-*` control. The copied saved schedule had the
correct failure URL and normal bypass header, not the callback-specific header.
No test was published from that unsent builder and no schedule was resumed.

Run `scripts/private-uat-alert-setup.ps1` yourself in a private PowerShell 7 window,
without transcription/debugging. It prompts for the existing **US Region QStash
token** and the **regenerated UAT bypass key**, using hidden input. Values are sent
to Node through stdin, never arguments, environment variables or credential files.
The token goes only to the fixed US QStash API; the UAT key goes only to that
approved service and its configured UAT deliveries. Neither value is printed.

Preparation first validates the exact existing paused schedule, origin, cadence,
normal bypass, empty body and three retries. It refuses mismatches. It then queues
one signed recovery control and one deliberately blocked job delivery (no normal
bypass) with the correct authenticated failure callback. It creates no orders,
charges nothing and changes no schedule. A failed test will leave an intentional
labelled DLQ entry as evidence; do not erase it automatically.

Keep the window open at its confirmation prompt and report `test queued` to Codex.
Only after the recovery 200, signed alert callback and expected email delivery are
verified, type `VERIFIED`. This is a separate explicit operator acknowledgement:
it permits overwriting the SAME schedule ID with the reviewed callback headers,
then resuming and reading back its state. Before this acknowledgement there is no
schedule mutation. On apply errors it attempts to pause again but cannot guarantee
a pause during an API outage; check the dashboard manually if it reports failure.
Closing the window or entering anything else stops without requesting that update.
