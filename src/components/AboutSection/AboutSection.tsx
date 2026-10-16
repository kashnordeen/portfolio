import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Code2, CreditCard, MessageCircle, Users } from "lucide-react";
import { profile, stats } from "@/data/portfolio";
import "./AboutSection.css";

const revealEase = [0.22, 1, 0.36, 1] as const;

function ContactInvitation({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });

  return (
    <div ref={ref} className="about-contact">
      <div className="about-contact-float" style={{ animationPlayState: inView && !reduceMotion ? "running" : "paused" }}>
        <motion.a
          href="#contact"
          className="about-contact-link group"
          whileHover={reduceMotion ? undefined : { scale: 1.025 }}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <MessageCircle size={18} aria-hidden="true" />
          Discuss your idea
          <ArrowUpRight size={18} className="about-contact-arrow" aria-hidden="true" />
        </motion.a>
      </div>
      <p>Community questions or a project in mind? Let’s talk.</p>
    </div>
  );
}

export const AboutSection = () => {
  const reduceMotion = !!useReducedMotion();
  const reveal = (delay = 0) => ({
    initial: reduceMotion ? false as const : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : delay, ease: revealEase },
  });

  return (
    <section id="about" aria-labelledby="about-title" className="about-section w-full max-w-7xl mx-auto px-6 py-16 md:py-24">
      <div className="about-intro-grid">
        <motion.div {...reveal()} className="about-story">
          <h2 id="about-title">Thoughtful code.<br /><span>Useful software.</span></h2>
          <p className="about-summary">{profile.aboutSummary}</p>
          <div className="about-principles" aria-label="Engineering focus">
            <span>Security by design</span>
            <span>Built for real use</span>
          </div>
          <details className="about-details">
            <summary>More about my journey <ArrowUpRight size={16} aria-hidden="true" /></summary>
            <p>{profile.aboutDescription}</p>
          </details>
        </motion.div>

        <motion.article {...reveal(0.1)} className="about-community" aria-labelledby="community-title">
          <div className="about-community-top">
            <div className="about-community-mark"><Users size={24} strokeWidth={1.5} aria-hidden="true" /></div>
            <span>Developer community</span>
          </div>
          <h3 id="community-title">Good ideas start<br />with a conversation.</h3>
          <p>Join my community of curious minds. Get in touch to learn more and register.</p>
          <div className="about-community-fee">
            <div><span>Registration fee</span><strong>{profile.registrationCharge}</strong></div>
            <img src={profile.avatar} width="56" height="56" alt="Keshav Kumar Karn" loading="lazy" />
          </div>
        </motion.article>
      </div>

      <motion.div {...reveal(0.05)} className="about-projects" aria-labelledby="project-pricing-title">
        <div className="about-projects-heading">
          <div className="about-projects-title"><Code2 size={22} strokeWidth={1.5} aria-hidden="true" /><h3 id="project-pricing-title">Your idea. A build that fits.</h3></div>
          <p>Custom websites, apps, and software, shaped around what you need.</p>
        </div>
        <div className="about-packages">
          {[
            { name: "Basic", ...profile.projectPricing.starter },
            { name: "Medium", ...profile.projectPricing.growth },
          ].map((tier, index) => (
            <motion.div key={tier.name} {...reveal(index * 0.08)} className="about-package" whileHover={reduceMotion ? undefined : { y: -3 }}>
              <div className="about-package-label"><h4>{tier.name}</h4><span>Project range</span></div>
              <p className="about-package-price">{tier.price}</p>
              <p className="about-package-description">{tier.description}</p>
            </motion.div>
          ))}
        </div>
        <p className="about-pricing-note">{profile.projectPricing.note}</p>
        <div className="about-payment">
          <div>
            <h4>Already working together?</h4>
            <p>Review your details and enter an agreed project amount or instalment.</p>
          </div>
          <a href="/?payment=project" className="about-payment-link">
            <CreditCard size={18} aria-hidden="true" />
            Make a project payment
            <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </div>
      </motion.div>

      <ContactInvitation reduceMotion={reduceMotion} />

      <motion.dl {...reveal()} className="about-facts" aria-label="Portfolio at a glance">
        {stats.map((stat) => (
          <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>
        ))}
      </motion.dl>
    </section>
  );
};
