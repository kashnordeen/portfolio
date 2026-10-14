import { useState } from "react";
import { ArrowLeft, ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { profile } from "@/data/portfolio";
import "./PaymentPortal.css";

type PaymentPurpose = "community" | "project";

export function PaymentPortal() {
  const initialPurpose = new URLSearchParams(window.location.search).get("payment") === "community" ? "community" : "project";
  const [purpose, setPurpose] = useState<PaymentPurpose>(initialPurpose);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const projectAmount = /^\d+(\.\d{1,2})?$/.test(amount) ? Number(amount) : 0;
  const total = purpose === "community" ? 699 : projectAmount;
  const formattedTotal = total > 0 && Number.isFinite(total)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(total)
    : "₹0";

  return (
    <main className="payment-portal">
      <header className="payment-header">
        <a href="/#about" className="payment-back"><ArrowLeft size={18} aria-hidden="true" /> Back to portfolio</a>
        <a href={`mailto:${profile.email}`} className="payment-help">Need help? <ArrowUpRight size={16} aria-hidden="true" /></a>
      </header>

      <div className="payment-intro">
        <h1>A clear payment.<br /><span>A good beginning.</span></h1>
        <p>Register for the community or pay an agreed amount towards your project.</p>
      </div>

      <div className="payment-layout">
        <section className="payment-form-panel" aria-labelledby="payment-details-heading">
          <h2 id="payment-details-heading">Payment details</h2>
          <fieldset className="payment-purpose">
            <legend>What are you paying for?</legend>
            <div className="payment-options">
              <label className={purpose === "community" ? "payment-option selected" : "payment-option"}>
                <input type="radio" name="purpose" value="community" checked={purpose === "community"} onChange={() => setPurpose("community")} />
                <span><strong>Community registration</strong><small>Fixed fee of ₹699</small></span>
              </label>
              <label className={purpose === "project" ? "payment-option selected" : "payment-option"}>
                <input type="radio" name="purpose" value="project" checked={purpose === "project"} onChange={() => setPurpose("project")} />
                <span><strong>Project payment</strong><small>Enter your agreed amount</small></span>
              </label>
            </div>
          </fieldset>

          <form onSubmit={event => event.preventDefault()}>
            <div className="payment-fields">
              <div><label htmlFor="payer-name">Full name</label><input id="payer-name" name="name" autoComplete="name" maxLength={100} required value={name} onChange={event => setName(event.target.value)} /></div>
              <div><label htmlFor="payer-email">Email address</label><input id="payer-email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} /><p>Used for your payment confirmation.</p></div>
              {purpose === "project" && <>
                <div><label htmlFor="payer-amount">Amount in INR</label><div className="payment-amount-input"><span aria-hidden="true">₹</span><input id="payer-amount" name="amount" type="text" inputMode="decimal" autoComplete="off" maxLength={12} pattern="[0-9]+([.][0-9]{1,2})?" required value={amount} onChange={event => setAmount(event.target.value)} aria-describedby="payer-amount-help" /></div><p id="payer-amount-help">Enter the amount agreed for your project. Use up to two decimal places.</p></div>
                <div><label htmlFor="payer-reference">Project or invoice reference</label><input id="payer-reference" name="reference" maxLength={120} required value={reference} onChange={event => setReference(event.target.value)} /><p>This helps us match your payment to the right project.</p></div>
              </>}
            </div>
            <div className="payment-setup-notice" role="status"><LockKeyhole size={18} aria-hidden="true" /><p>Online checkout is being set up. No payment can be taken from this page yet.</p></div>
            <button className="payment-checkout-button" type="submit" disabled>Checkout coming soon <ArrowUpRight size={18} aria-hidden="true" /></button>
          </form>
        </section>

        <aside className="payment-summary" aria-labelledby="payment-summary-heading">
          <div className="payment-summary-icon"><ShieldCheck size={26} strokeWidth={1.5} aria-hidden="true" /></div>
          <h2 id="payment-summary-heading">Your payment</h2>
          <p>{purpose === "community" ? "Community registration" : "Payment towards your project"}</p>
          <div className="payment-total"><span>Total in INR</span><strong aria-live="polite" aria-atomic="true">{formattedTotal}</strong></div>
          <p className="payment-summary-note">{purpose === "community" ? "Registration details will be explained before checkout is enabled." : "Paying an advance or instalment does not mark the full project balance as paid."}</p>
          <div className="payment-expectations"><h3>When checkout opens</h3><ul><li>Pay through PhonePe’s hosted checkout.</li><li>Scan a QR on desktop or choose an available payment option.</li><li>Receive confirmation after payment is verified.</li></ul></div>
          <a href={`mailto:${profile.email}`} className="payment-summary-help">Discuss payment details <ArrowUpRight size={16} aria-hidden="true" /></a>
        </aside>
      </div>
      <footer className="payment-footer"><span>{profile.name}</span><span>Have a question? <a href={`mailto:${profile.email}`}>Contact me</a></span></footer>
    </main>
  );
}
