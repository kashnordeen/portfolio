import { ArrowLeft, ArrowUpRight, ChevronDown, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { profile } from "@/data/portfolio";

export function PaymentHeader() {
  return <header className="payment-header">
    <a href="/" className="payment-brand" aria-label={`${profile.name} — portfolio`}><span className="payment-monogram" aria-hidden="true">kk.</span><span>{profile.name}<small>Independent developer</small></span></a>
    <nav aria-label="Payment navigation"><a href="/#about" className="payment-back" aria-label="Back to portfolio"><ArrowLeft size={16} aria-hidden="true" /><span>Portfolio</span></a><a href={`mailto:${profile.email}`} className="payment-help"><Mail size={16} aria-hidden="true" /><span>Get help</span></a></nav>
  </header>;
}

export function PaymentIntro({ loaded, enabled, order }: { loaded: boolean; enabled: boolean; order: string }) {
  return <section className="payment-intro" aria-labelledby="payment-title">
    <div className="payment-eyebrow"><span>THE PAYMENT DESK</span><span className="payment-availability" data-available={loaded && enabled}><span aria-hidden="true" />{!loaded ? "Checking availability" : enabled ? "Checkout available" : "Checkout not open"}</span></div>
    <h1 id="payment-title">Your project.<br /><span>One step forward.</span></h1>
    <p>A clear next step for what we’re building together. Pay an agreed advance, instalment or project balance through PhonePe.</p>
    <ol className="payment-steps" aria-label="Payment process"><li aria-current={order ? undefined : "step"}><span>01</span><div>Your details<small>Set your agreed amount</small></div></li><li><span>02</span><div>PhonePe checkout<small>Choose how to pay</small></div></li><li aria-current={order ? "step" : undefined}><span>03</span><div>Confirmation<small>Verified payment status</small></div></li></ol>
  </section>;
}

export function PaymentGuide() {
  return <section className="payment-guide" aria-labelledby="payment-guide-title">
    <div className="payment-guide-intro"><span className="payment-section-label">A LITTLE CLARITY</span><h2 id="payment-guide-title">Before you continue.</h2><p>Know what happens to your payment, without the small print getting in the way.</p><a href={`mailto:${profile.email}`}>Ask me a question <ArrowUpRight size={16} aria-hidden="true" /></a></div>
    <div className="payment-faq">
      <details><summary>Which amount should I enter?<ChevronDown size={18} aria-hidden="true" /></summary><p>Use the amount we agreed by email for your project or milestone. Project payments can be between ₹200 and ₹50,000. If you’re unsure, contact me before paying.</p></details>
      <details><summary>Do I need a project reference?<ChevronDown size={18} aria-hidden="true" /></summary><p>No. The reference is optional. Your name and email help match the payment to your project; add an invoice or project reference only if you have one.</p></details>
      <details><summary>What if my payment stays pending?<ChevronDown size={18} aria-hidden="true" /></summary><p>Don’t pay again. Keep the payment reference shown on this page and email me. A return from PhonePe alone does not confirm payment; the server checks its status.</p></details>
    </div>
  </section>;
}

export function PaymentFooter({ completed = false }: { completed?: boolean }) {
  return <footer className="payment-footer"><span>{profile.name}<small>Projects built with care. Payments handled clearly.</small></span><span className="payment-footer-note">{completed ? <ShieldCheck size={16} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}{completed ? "Server-verified confirmation" : "Checkout handled by PhonePe"}</span></footer>;
}
