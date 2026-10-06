import SkillCategory from "./SkillCategory";
import { CertificationsSection } from "./CertificationsSection";
import { education } from "@/data/portfolio";

export const EducationSection = () => (
  <section id="education" className="w-full max-w-7xl mx-auto px-6 py-16 space-y-16">
    <div>
      <h2 className="text-3xl font-bold tracking-tight">Education</h2>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {education.map(edu => (
          <article key={edu.degree} className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">{edu.year} · {edu.badge}</p>
            <h3 className="mt-3 text-xl font-bold tracking-tight">{edu.degree}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{edu.school}</p>
            <details className="mt-3">
              <summary className="min-h-11 w-fit cursor-pointer py-3 text-sm font-medium text-primary">Academic details</summary>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {edu.details.map(detail => <li key={detail}>{detail}</li>)}
              </ul>
            </details>
          </article>
        ))}
      </div>
    </div>
    <CertificationsSection />
    <SkillCategory />
  </section>
);
