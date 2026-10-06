import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, BrainCircuit, Code2, ShieldCheck, Smartphone } from "lucide-react";
import { useLenis } from "lenis/react";
import { services } from "@/data/portfolio";

const icons = [Smartphone, ShieldCheck, BrainCircuit];
const examples = ["GramFlow Android + Downloads Organizer", "FINDORA", "FINDORA + De-Insure"];

export const ServicesSection = () => {
  const reduceMotion = useReducedMotion();
  const lenis = useLenis();
  return (
    <section id="services" className="w-full max-w-7xl mx-auto px-6 py-16">
      <div className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight">What I <span className="text-gradient-primary">build.</span></h2>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">Useful products, from interface to infrastructure.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        <motion.article initial={reduceMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} className="lg:col-span-5 flex flex-col rounded-[2rem] border border-primary/20 bg-primary/5 p-6 md:p-8">
          <Code2 aria-hidden="true" className="h-6 w-6 text-primary mb-5" />
          <h3 className="text-2xl font-bold tracking-tight">{services[0].title}</h3>
          <p className="mt-4 mb-8 text-muted-foreground leading-relaxed">{services[0].description}</p>
          <div className="mt-auto border-t border-primary/20 pt-5">
            <p className="text-sm font-semibold">GramFlow Web</p>
            <p className="mt-2 text-xs text-muted-foreground">Inventory, FIFO ledgers, and financial insights.</p>
          </div>
        </motion.article>
        <div className="lg:col-span-7 divide-y divide-border">
          {services.slice(1).map((service, index) => {
            const Icon = icons[index];
            return <motion.article key={service.title} initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }}
              className="flex gap-4 py-6 first:pt-2 last:pb-2">
              <Icon aria-hidden="true" className="mt-1 h-6 w-6 text-primary shrink-0" />
              <div>
                <h3 className="text-xl font-bold tracking-tight">{service.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-lg">{service.description}</p>
                <p className="mt-3 text-xs font-medium">{examples[index]}</p>
              </div>
            </motion.article>;
          })}
        </div>
      </div>
      <a href="#projects" onClick={event => {
        if (lenis) { event.preventDefault(); lenis.scrollTo('#projects', { immediate: !!reduceMotion }); }
      }} className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-sm hover:text-primary transition-colors">
        Explore the projects <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
      </a>
    </section>
  );
};
