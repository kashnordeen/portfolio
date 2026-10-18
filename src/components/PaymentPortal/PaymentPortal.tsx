import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle2, CircleHelp, LockKeyhole, ShieldCheck } from "lucide-react";
import { profile } from "@/data/portfolio";
import { CheckoutError, getPaymentAvailability, getPaymentStatus, startCheckout } from "@/lib/payment-client";
import type { PaymentStatus } from "@/lib/payment-client";
import { projectAmountError, projectAmountPaise } from "@/lib/project-payment-input";
import "./PaymentPortal.css";

type PaymentPurpose = "community" | "project";

export function PaymentPortal() {
  const initialPurpose = new URLSearchParams(window.location.search).get("payment") === "community" ? "community" : "project";
  const [purpose, setPurpose] = useState<PaymentPurpose>(initialPurpose);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [availability, setAvailability] = useState({ projectEnabled: false, communityEnabled: false });
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState(() => new URLSearchParams(window.location.search).get("order") ?? "");
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const requestKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const [attempted, setAttempted] = useState(false);
  const enabled = purpose === "community" ? availability.communityEnabled : availability.projectEnabled;
  useEffect(() => {
    const controller = new AbortController();
    void getPaymentAvailability(controller.signal).then(result => {
      if (!controller.signal.aborted) { setAvailability(result); setAvailabilityLoaded(true); }
    });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!order) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let polls = 0;
    const check = async () => {
      try {
        const next = await getPaymentStatus(order, controller.signal);
        if (controller.signal.aborted) return;
        setStatus(next);
        setPurpose(next.purpose);
        if (next.state === "COMPLETED") sessionStorage.removeItem("payment-request-key");
        setMessage("");
        if (["CREATED", "PENDING"].includes(next.state) && polls++ < 60) timer = setTimeout(check, 5000);
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Please contact support about this payment.");
      }
    };
    void check();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [order]);
  useEffect(() => {
    if (status?.state === "COMPLETED") successHeading.current?.focus();
  }, [status?.state]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!enabled || submitting.current || order || (purpose === "project" && projectAmountPaise(amount) === null)) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    setAttempted(true);
    try {
      // Persist only an opaque request identifier, never the customer's personal details.
      requestKey.current ??= sessionStorage.getItem("payment-request-key") ?? crypto.randomUUID();
      sessionStorage.setItem("payment-request-key", requestKey.current);
      const result = await startCheckout({ purpose, name, email, amount, reference }, requestKey.current);
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
      else { setOrder(result.orderId); setMessage(result.message ?? "Your order is being verified. Do not pay again."); }
    } catch (error) {
      // Only a first, definitively rejected request can unlock edits. Ambiguous attempts stay frozen.
      if (!attempted && error instanceof CheckoutError && error.editable) setAttempted(false);
      setMessage(error instanceof Error ? error.message : "Unable to open checkout. Please contact support.");
    }
    finally { submitting.current = false; setBusy(false); }
  };
  const statusCopy = status?.state === "FAILED" ? "This payment failed. Contact support to confirm the next step before attempting another payment."
      : status?.state === "REVIEW" ? "This payment needs review. Please contact support and do not pay again."
        : "Checkout or payment verification is still pending. This is not confirmation of payment. Please do not pay again; contact support if checkout did not open.";
  const amountError = purpose === "project" ? projectAmountError(amount) : "";
  const validAmount = purpose === "community" || projectAmountPaise(amount) !== null;
  const projectAmount = (projectAmountPaise(amount) ?? 0) / 100;
  const total = status ? status.amountPaise / 100 : purpose === "community" ? 699 : projectAmount;
  const formattedTotal = total > 0 && Number.isFinite(total)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(total)
    : "₹0";

  if (status?.state === "COMPLETED") {
    return (
      <main className="payment-portal payment-success">
        <header className="payment-header"><a href="/" className="payment-back"><ArrowLeft size={18} aria-hidden="true" /> Portfolio</a><a href={`mailto:${profile.email}`} className="payment-help">Need help? <ArrowUpRight size={16} aria-hidden="true" /></a></header>
        <section className="payment-success-card" aria-labelledby="payment-success-heading">
          <div className="payment-success-icon" aria-hidden="true"><CheckCircle2 size={36} strokeWidth={1.5} /></div>
          <p className="payment-success-label" role="status">Payment successful</p>
          <h1 id="payment-success-heading" ref={successHeading} tabIndex={-1}>Thank you!</h1>
          <p className="payment-success-intro"><strong>Your payment is confirmed.</strong><br />Thank you for your trust.</p>
          <div className="payment-success-total"><span>Amount received · INR</span><strong>{formattedTotal}</strong></div>
          <dl className="payment-success-details">
            <div><dt>Payment reference</dt><dd className="payment-reference">{status.orderId}</dd></div>
            <div><dt>Paid to</dt><dd>{profile.name}</dd></div>
            <div><dt>Payment provider</dt><dd>PhonePe</dd></div>
            {status.paidAt && <div><dt>Received on</dt><dd><time dateTime={status.paidAt}>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(status.paidAt))} IST</time></dd></div>}
          </dl>
          <p className="payment-success-note">Keep this reference for your records. {status.purpose === "project" ? "This confirms this payment only and does not settle any remaining project balance. Your agreed scope and delivery schedule are unchanged." : "Registration access and service delivery are handled separately."}</p>
          <a href="/" className="payment-success-home">Return to home <ArrowUpRight size={18} aria-hidden="true" /></a>
          <a href={`mailto:${profile.email}`} className="payment-success-help">Questions about your payment? Contact me.</a>
        </section>
        <footer className="payment-footer"><span>{profile.name}</span><span>Verified by our server. No further payment is needed for this transaction.</span></footer>
      </main>
    );
  }

  return (
    <main className="payment-portal">
      <header className="payment-header">
        <a href="/#about" className="payment-back"><ArrowLeft size={18} aria-hidden="true" /> Back to portfolio</a>
        <a href={`mailto:${profile.email}`} className="payment-help">Need help? <ArrowUpRight size={16} aria-hidden="true" /></a>
      </header>

      <div className="payment-intro">
        <div className="payment-eyebrow"><span>PROJECT PAYMENTS</span><span className="payment-availability">{!availabilityLoaded ? "Checking availability" : enabled ? "Checkout available" : "Checkout not open"}</span></div>
        <h1>For what we’re<br /><span>building together.</span></h1>
        <p>Pay the amount we’ve agreed for your project. Have a project or invoice reference? You can add it below, or leave it blank.</p>
        <ol className="payment-steps" aria-label="Payment process"><li aria-current={order ? undefined : "step"}><span>1</span> Your details</li><li><span>2</span> PhonePe checkout</li><li aria-current={order ? "step" : undefined}><span>3</span> Verified status</li></ol>
      </div>

      <div className="payment-layout">
        <section className="payment-form-panel" aria-labelledby="payment-details-heading" aria-busy={busy}>
          <div className="payment-panel-heading"><h2 id="payment-details-heading">Payment details</h2><span>01 / DETAILS</span></div>
          {order && <div className="payment-setup-notice payment-status-notice" role="status"><CircleHelp size={20} aria-hidden="true" /><p>{statusCopy}<br /><span className="payment-reference">Reference: {order}</span></p></div>}
          <fieldset className="payment-purpose" disabled={attempted || !!order}>
            <legend>What are you paying for?</legend>
            <div className="payment-options">
              <label className={purpose === "project" ? "payment-option selected" : "payment-option"}>
                <input type="radio" name="purpose" value="project" checked={purpose === "project"} onChange={() => setPurpose("project")} />
                <span><strong>Project payment</strong><small>Advance, instalment or agreed balance</small></span>
              </label>
              <label className={purpose === "community" ? "payment-option selected" : "payment-option"}>
                <input type="radio" name="purpose" value="community" disabled={!availability.communityEnabled} checked={purpose === "community"} onChange={() => setPurpose("community")} />
                <span><strong>Community registration</strong><small>{availability.communityEnabled ? "Fixed fee of ₹699" : "Not open for registration"}</small></span>
              </label>
            </div>
          </fieldset>

          <form onSubmit={submit}>
            <fieldset className="payment-fields" disabled={attempted || !!order}>
              <legend className="sr-only">Customer details</legend>
              <div><label htmlFor="payer-name">Full name</label><input id="payer-name" name="name" autoComplete="name" maxLength={100} required value={name} onChange={event => setName(event.target.value)} /></div>
              <div><label htmlFor="payer-email">Email address</label><input id="payer-email" name="email" type="email" autoComplete="email" aria-describedby="payer-email-help" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} /><p id="payer-email-help">For payment support and matching your project.</p></div>
              {purpose === "project" && <>
                <div><label htmlFor="payer-amount">Agreed amount in INR</label><div className="payment-amount-input"><span aria-hidden="true">₹</span><input id="payer-amount" name="amount" type="text" inputMode="decimal" autoComplete="off" maxLength={12} pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00" required value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={!!amountError} aria-describedby={amountError ? "payer-amount-help payer-amount-error" : "payer-amount-help"} /></div><p id="payer-amount-help">₹200 to ₹50,000. Enter only the amount agreed for your project.</p>{amountError && <p id="payer-amount-error" className="payment-field-error">{amountError}</p>}</div>
                <div><label htmlFor="payer-reference">Project or invoice reference (optional)</label><input id="payer-reference" name="projectReference" autoComplete="off" aria-describedby="payer-reference-help" placeholder="Add a reference, if you have one" maxLength={120} value={reference} onChange={event => setReference(event.target.value)} /><p id="payer-reference-help">Leave blank if you don’t have one. We’ll match your payment using your name and email.</p></div>
              </>}
            </fieldset>
            {!enabled && !order && <div className="payment-setup-notice" role="status"><LockKeyhole size={18} aria-hidden="true" /><p>{!availabilityLoaded ? "Checking whether checkout is available. No payment has started." : purpose === "community" ? "Community registration is not open yet. Benefits and access details will be shared before payments are enabled." : "Online checkout is not open yet. You can discuss your payment by email; this page cannot take a payment right now."}</p></div>}
            {message && <p className="payment-error-notice" role="alert">{message}</p>}
            <button className="payment-checkout-button" type="submit" disabled={!enabled || !validAmount || busy || !!order}>{busy ? "Opening secure checkout…" : status?.state === "FAILED" ? "Payment failed" : status?.state === "REVIEW" ? "Review required" : order ? "Payment under verification" : enabled ? "Continue to PhonePe" : "Checkout not open"} <ArrowUpRight size={18} aria-hidden="true" /></button>
            <nav className="payment-policy-links" aria-label="Payment policies"><a href="/policies/terms.html" target="_blank" rel="noopener noreferrer" aria-label="Service terms (opens in a new tab)">Service terms</a><a href="/policies/refunds.html" target="_blank" rel="noopener noreferrer" aria-label="Refund policy (opens in a new tab)">Refunds</a><a href="/policies/privacy.html" target="_blank" rel="noopener noreferrer" aria-label="Privacy notice (opens in a new tab)">Privacy</a></nav>
            <p className="payment-privacy-note"><LockKeyhole size={14} aria-hidden="true" /> Card details and UPI PINs are never entered on this website.</p>
          </form>
        </section>

        <aside className="payment-summary" aria-labelledby="payment-summary-heading">
          <div className="payment-summary-top"><div className="payment-summary-icon"><ShieldCheck size={24} strokeWidth={1.5} aria-hidden="true" /></div><span>02 / REVIEW</span></div>
          <h2 id="payment-summary-heading">Review your payment</h2>
          <p>{purpose === "community" ? "Community registration" : "Payment towards your project"}</p>
          <div className="payment-total"><span>{status ? "Server-confirmed amount" : "Amount to pay · INR"}</span><strong aria-live="polite" aria-atomic="true">{formattedTotal}</strong></div>
          <dl className="payment-merchant"><div><dt>Paid to</dt><dd>Keshav Kumar Karn</dd></div><div><dt>Checkout provider</dt><dd>PhonePe</dd></div></dl>
          <p className="payment-summary-note">{purpose === "community" ? "Registration details will be explained before checkout is enabled." : "Paying an advance or instalment does not mark the full project balance as paid."}</p>
          <div className="payment-expectations"><h3>What happens next</h3><ul><li>Continue to PhonePe’s hosted checkout when enabled.</li><li>Choose from the payment methods PhonePe makes available.</li><li>Return here for a server-verified payment status. If pending, do not pay again.</li></ul></div>
          <a href={`mailto:${profile.email}`} className="payment-summary-help">Discuss payment details <ArrowUpRight size={16} aria-hidden="true" /></a>
        </aside>
      </div>
      <footer className="payment-footer"><span>{profile.name}</span><span>Have a question? <a href={`mailto:${profile.email}`}>Contact me</a></span></footer>
    </main>
  );
}
