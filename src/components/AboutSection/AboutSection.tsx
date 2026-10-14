import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Code2, Globe2, Layout, Users } from "lucide-react";
import { profile, stats as portfolioStats } from "@/data/portfolio";

const stats = [
  { icon: <Layout className="w-6 h-6" />, label: portfolioStats[0].label, value: portfolioStats[0].value },
  { icon: <Code2 className="w-6 h-6" />, label: portfolioStats[1].label, value: portfolioStats[1].value },
  { icon: <Users className="w-6 h-6" />, label: portfolioStats[2].label, value: portfolioStats[2].value },
  { icon: <Globe2 className="w-6 h-6" />, label: portfolioStats[3].label, value: portfolioStats[3].value },
];

export const AboutSection = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="about" className="w-full max-w-7xl mx-auto px-6 py-16">
      <motion.div
        className="flex flex-col md:flex-row gap-8 items-center"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="flex-1 space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Building <span className="text-gradient-primary">with purpose.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {profile.aboutSummary}
            </p>
            <motion.div
              className="relative mt-6 overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm transition-colors hover:border-primary/40 sm:p-5"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.01 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              viewport={{ once: true, amount: 0.5 }}
            >
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl"
                animate={prefersReducedMotion ? undefined : { opacity: [0.25, 0.55, 0.25], scale: [1, 1.12, 1] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative grid gap-5 sm:grid-cols-[0.8fr_1.2fr] sm:gap-6">
                <motion.div
                  className="flex flex-col justify-center"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: -12 }}
                  whileInView={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                  transition={{ delay: 0.12, duration: 0.35 }}
                  viewport={{ once: true }}
                >
                  <p className="text-sm font-semibold text-foreground">Join the community</p>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-primary">{profile.registrationCharge}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">One-time registration</p>
                </motion.div>
                <motion.div
                  className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 12 }}
                  whileInView={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.35 }}
                  viewport={{ once: true }}
                >
                  <p className="text-sm font-semibold text-foreground">Custom projects &amp; software</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Flexible scopes for ideas at different stages.</p>
                  <div className="mt-3 grid gap-2">
                    <div className="rounded-xl border border-border/80 bg-background/70 px-3 py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-xs font-semibold text-muted-foreground">Starter build</p>
                        <p className="text-base font-extrabold tracking-tight text-foreground">{profile.projectPricing.starter.price}</p>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{profile.projectPricing.starter.description}</p>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-xs font-semibold text-primary">Growth build</p>
                        <p className="text-base font-extrabold tracking-tight text-foreground">{profile.projectPricing.growth.price}</p>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{profile.projectPricing.growth.description}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{profile.projectPricing.note}</p>
                </motion.div>
              </div>
            </motion.div>
            <div className="mt-4 flex justify-center">
              <motion.a
                href="#contact"
                className="group relative isolate inline-flex min-h-11 items-center gap-2 overflow-hidden rounded-full border border-primary/40 bg-background px-6 py-2.5 text-sm font-semibold text-primary shadow-lg shadow-primary/10 transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                animate={prefersReducedMotion ? undefined : { y: [0, -4, 0] }}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                transition={prefersReducedMotion ? undefined : { y: { duration: 2.4, repeat: Infinity, ease: "easeInOut" }, scale: { type: "spring", stiffness: 380, damping: 24 } }}
              >
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-full bg-primary/15"
                  animate={prefersReducedMotion ? undefined : { opacity: [0.2, 0.55, 0.2], scale: [0.92, 1.06, 0.92] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
                Contact for details
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" aria-hidden="true" />
              </motion.a>
            </div>
            <details className="mt-5 text-sm text-muted-foreground">
              <summary className="min-h-11 w-fit cursor-pointer py-3 font-semibold text-foreground hover:text-primary">More about me</summary>
              <p className="mt-4 leading-relaxed">{profile.aboutDescription}</p>
            </details>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4 w-full">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              className="p-4 rounded-2xl border border-border bg-card"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
            >
              <div className="text-primary mb-3">
                {stat.icon}
              </div>
              <p className="text-xl font-bold text-foreground mb-1">{stat.value}</p>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};
