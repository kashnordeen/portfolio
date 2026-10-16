# Payment policies — UNPUBLISHED OWNER-REVIEW DRAFT

This is a starting point for review, not legal advice, a compliance certification or
approved customer terms. Do not publish with unresolved fields. No refund deadline,
retention period, automatic delivery commitment or legal business identity is invented.

## Owner decisions required before publication

| Decision | Current state |
| --- | --- |
| Legal seller/business identity and required address details | Owner must confirm; portfolio name alone does not establish these |
| Support contact | Proposed: kash.nordeen@gmail.com; confirm before publishing |
| Project delivery | Confirm how scope, milestones, acceptance and delivery dates are agreed |
| Cancellation/refund eligibility | Confirm rules before work starts, after work starts, and for delivered work |
| Refund request/processing timing | Owner must select realistic periods consistent with provider requirements |
| Payment discrepancies/duplicate debits | Confirm the investigation and customer communication process |
| Customer-data retention | Define periods, purposes, backup retention and deletion/restriction procedure |
| Community service | Not defined; registration payments remain disabled |

## Proposed service/payment notice

Project payments are for a scope and amount agreed with the customer. The payment
page accepts an agreed INR amount and project/invoice reference; the advertised
package ranges are estimates, not a binding invoice. An advance or instalment does
not settle a remaining project balance. Scope changes and delivery milestones need
separate agreement. **Owner must approve this wording and the agreement method.**

Payment is handled by PhonePe's hosted checkout. A redirect, bank debit notification
or screenshot alone is not our confirmation. The site displays completion only after
independent provider verification. If the status is pending or under review, do not
pay again; contact support with the displayed reference. Do not send passwords,
card details, UPI PINs or OTPs to support.

## Refund/cancellation section — owner choices outstanding

Before publication, state the agreed eligibility rules and request method for each
of these cases: cancellation before work starts; cancellation after work starts;
unresolved service/delivery disputes; duplicate successful charges; unsuccessful or
pending debits needing provider reconciliation. Specify review and processing
timeframes, any lawful deductions and how the customer is informed.

Do not state "no refunds," guarantee a refund time, waive statutory protections,
or promise automatic refunds without appropriate review and an actual process.
The application currently has no automated refund flow. A failed/ambiguous order
must not be treated as an automatically completed refund.

## Privacy notice — factual implementation inventory for review

The form collects name, email, project/invoice reference and agreed amount to create
and identify the payment. The backend stores payment references, amount/currency,
state/timestamps, provider order/checkout references, verification-event metadata
and operational job records. Some stored checkout references are sensitive tokens;
they belong only in access-controlled backend storage/backups, never public logs.

A secure first-party session cookie associates payment status with the originating
browser. The browser retains an opaque request identifier in session storage to
avoid duplicate checkout initiation; it does not persist the typed customer fields
there. Rate-limit identifiers are hashed. Infrastructure providers may separately
process standard network/access metadata; review their actual configured logs and
retention before publishing this notice.

Relevant processors are PhonePe for hosted payment processing, Supabase for backend
storage, Vercel for hosting, QStash for opaque verification-job delivery, and—only
when separately approved/configured—Resend for owner operational alerts. Alert emails
are designed to contain a fixed failure category and hour, not customer data or
payment details. Do not claim no third-party processing or that hashing removes
every privacy obligation.

The site does not collect card numbers, UPI PINs or OTPs in its own payment form.
PhonePe's hosted interface has its own privacy and payment terms. Confirm the
appropriate disclosures/agreements for actual business operation and jurisdiction.

**Owner must define retention and deletion/access handling before publication.**
Financial records, unresolved orders and backups need an explicit lawful retention
and recovery process; no automatic financial-record deletion is currently implemented.
Support contact and request-verification procedures must be confirmed. Do not
promise immediate deletion of records that the system cannot safely erase.

## Publication checklist

- Owner/legal review completed; all choices resolved and accurate contact/identity added.
- Actual retention, backup and support/refund procedures match the text.
- Approved policy pages are versioned and linked beside checkout and in the footer.
- Any agreement/acknowledgement UX reflects the approved terms; no preselected consent.
- Community still disabled unless its separate offering has been defined and approved.

Until then this document stays local documentation, not a public policy page.
