import { motion } from "framer-motion";
import {
  BrainCircuit,
  ChevronDown,
  CloudCog,
  Code2,
  Network,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import {
  professionalSummary,
  softSkills,
  technicalSkillGroups,
  technologies,
} from "@/data/portfolio";

const categoryStyles = [
  { icon: ShieldCheck, description: "Assess vulnerabilities. Protect applications and networks." },
  { icon: Wrench, description: "Reconnaissance, enumeration, and security testing." },
  { icon: Code2, description: "From systems programming to web and native apps." },
  { icon: Network, description: "Connected systems, containers, and secure communication." },
  { icon: CloudCog, description: "Authentication, APIs, cloud services, and reliable data." },
  { icon: BrainCircuit, description: "Models that understand language, images, and context." },
];
const featuredTools = ["React", "TypeScript", "Python", "Kotlin", "FastAPI", "PyTorch", "PostgreSQL", "Docker"];

const strengthIcons = [ShieldCheck, Network, Wrench, Code2];

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
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Expertise & Skills</h2>
      </div>

      <div className="rounded-[2rem] border border-border bg-card overflow-hidden">
        <div className="p-6 md:p-8 border-b border-border bg-primary/5">
          <h3 className="text-xl font-bold tracking-tight">The tools behind the build.</h3>
          <p className="mt-3 text-muted-foreground max-w-xl">Software, security, and intelligent systems. A toolkit shaped by hands-on projects.</p>
          <ul aria-label="Selected technologies" className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5">
            {featuredTools.map(name => {
              const tool = technologies.find(item => item.name === name)!;
              return <li key={name} className="flex items-center gap-3 text-sm font-semibold">
                <img src={tool.icon} alt="" width={28} height={28} loading="lazy" decoding="async" className="h-7 w-7 object-contain" />
                {name}
              </li>;
            })}
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 px-6 md:px-8">
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
                className="py-4 border-b border-border last:border-b-0 md:[&:nth-last-child(2)]:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <Icon aria-hidden="true" className="w-5 h-5 shrink-0 text-primary" />
                  <h4 className="font-bold text-base tracking-tight">{category.name}</h4>
                </div>
                <ul aria-label={`${category.name} highlights`} className="mt-4 flex flex-wrap gap-2">
                  {category.skills.slice(0, 3).map(skill => <li key={skill} className="rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium">{skill}</li>)}
                </ul>
                <details className="group/tools mt-3">
                  <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                    More {category.name.toLowerCase()} skills <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open/tools:rotate-180" />
                  </summary>
                  <ul className="flex flex-wrap gap-2 pb-1">
                    {category.skills.slice(3).map(skill => <li key={skill} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground/80">{skill}</li>)}
                  </ul>
                </details>
              </motion.article>
            );
          })}
        </div>
      </div>

      <div className="pt-4">
        <h3 className="text-xl font-semibold">Professional Strengths</h3>
        <p className="mt-2 mb-5 text-sm text-muted-foreground">{professionalSummary}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2">
          {softSkills.map((skill, index) => {
            const Icon = strengthIcons[index];
            return (
              <motion.article key={skill.name} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                viewport={{ once: true }} transition={{ duration: 0.4, delay: index * 0.08 }}
                className="group flex gap-4 border-t border-border py-6">
                <Icon aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-primary transition-transform group-hover:-translate-y-1" />
                <div>
                  <h4 className="text-lg font-bold tracking-tight">{skill.name}</h4>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{skill.description}</p>
                  <p className="mt-3 text-xs font-medium text-foreground/75">{skill.evidence}</p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
