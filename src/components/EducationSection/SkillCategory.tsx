import { motion } from "framer-motion";
import {
  BrainCircuit,
  CloudCog,
  Code2,
  Network,
  Rocket,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import {
  professionalSummary,
  softSkills,
  technicalSkillGroups,
} from "@/data/portfolio";

const categoryStyles = [
  { icon: ShieldCheck, color: "text-rose-400", surface: "bg-rose-500/10 border-rose-500/20" },
  { icon: Wrench, color: "text-amber-400", surface: "bg-amber-500/10 border-amber-500/20" },
  { icon: Code2, color: "text-sky-400", surface: "bg-sky-500/10 border-sky-500/20" },
  { icon: Network, color: "text-emerald-400", surface: "bg-emerald-500/10 border-emerald-500/20" },
  { icon: CloudCog, color: "text-violet-400", surface: "bg-violet-500/10 border-violet-500/20" },
  { icon: BrainCircuit, color: "text-fuchsia-400", surface: "bg-fuchsia-500/10 border-fuchsia-500/20" },
];

const traitStyles = [
  "text-purple-400 border-purple-500/30 bg-purple-500/10",
  "text-sky-400 border-sky-500/30 bg-sky-500/10",
  "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "text-amber-400 border-amber-500/30 bg-amber-500/10",
  "text-rose-400 border-rose-500/30 bg-rose-500/10",
  "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
];

export default function ProfessionalProfile() {
  return (
    <motion.section
      id="skills"
      className="space-y-8"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.15 } }}
      viewport={{ once: true, amount: 0.1 }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Code2 className="w-5 h-5" />
        </div>
        <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">Expertise & Skills</h3>
      </div>

      <div className="glass-panel p-5 md:p-8 rounded-[2rem] border border-foreground/15 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7 pb-4 border-b border-border/60">
          <h4 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" /> Technical Toolkit
          </h4>
          <span className="w-fit text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border/50">
            6 Core Areas
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {technicalSkillGroups.map((category, index) => {
            const style = categoryStyles[index];
            const Icon = style.icon;
            return (
              <motion.article
                key={category.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-border/60 bg-muted/25 p-4 md:p-5 hover:border-primary/30 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-xl border ${style.surface}`}>
                    <Icon className={`w-4 h-4 ${style.color}`} />
                  </div>
                  <h5 className="font-bold text-sm leading-snug text-foreground">{category.name}</h5>
                </div>
                <div className="flex flex-wrap gap-2">
                  {category.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1.5 rounded-lg bg-background/70 border border-border/60 text-xs font-medium text-muted-foreground leading-tight"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>

      <div className="glass-panel p-5 md:p-8 rounded-[2rem] border border-foreground/15 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7 pb-4 border-b border-border/60">
          <h4 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Professional Strengths
          </h4>
          <span className="w-fit text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border/50">
            How I Work
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {softSkills.map((skill, index) => (
            <motion.div
              key={skill.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 16, delay: index * 0.06 }}
              viewport={{ once: true }}
              className={`px-4 py-2.5 rounded-2xl border text-sm font-semibold shadow-sm ${traitStyles[index]}`}
            >
              {skill.name}
            </motion.div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-border/60">
          <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-purple-500/5 to-transparent border border-primary/20 flex items-start gap-3.5 shadow-sm">
            <div className="p-2 rounded-xl bg-primary/20 text-primary shrink-0 mt-0.5">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-foreground font-bold text-sm block mb-1">Product-Minded Engineering</strong>
              <p className="text-sm text-muted-foreground leading-relaxed">{professionalSummary}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
