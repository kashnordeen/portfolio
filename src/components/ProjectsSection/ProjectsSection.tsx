import { useEffect, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { ArrowUpRight, ChevronDown, Download, Github } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { projects } from "@/data/portfolio";
import { fallbackOrganizerRelease, fetchOrganizerRelease, type OrganizerRelease } from "@/lib/organizer-release";

function OrganizerDownload() {
  const [release, setRelease] = useState<OrganizerRelease>({ ...fallbackOrganizerRelease, status: "checking" });
  useEffect(() => {
    let active = true;
    void fetchOrganizerRelease().then(result => { if (active) setRelease(result); });
    return () => { active = false; };
  }, []);
  const platforms = [
    { name: "Windows", icon: "windows11/windows11-original.svg" },
    { name: "macOS", icon: "apple/apple-original.svg" },
    { name: "Linux", icon: "linux/linux-original.svg" },
  ];
  return (
    <div className="mt-5 space-y-3 border-t border-border pt-5">
      <p className="text-sm font-semibold">Download for your device</p>
      <p role="status" className="text-xs text-muted-foreground">
        {release.status === "checking" ? `Checking the latest release. Showing ${release.version} fallback downloads.`
          : release.status === "latest" ? `Latest stable release: ${release.version}`
          : `Couldn't verify the latest release. Showing ${release.version} fallback downloads.`}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
        {platforms.map(platform => (
          <details key={platform.name} name="organizer-platform" className="group/os rounded-xl border border-border bg-background open:border-primary/60">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold hover:bg-muted rounded-xl [&::-webkit-details-marker]:hidden">
              <img src={`https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${platform.icon}`} alt="" width={22} height={22}
                loading="lazy" className={`h-5 w-5 object-contain ${platform.name === "macOS" ? "dark:invert" : ""}`} />
              {platform.name}
              <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 transition-transform group-open/os:rotate-180" />
            </summary>
            <div className="border-t border-border p-1">
              {release.downloads.filter(item => item.platform === platform.name).map(item => item.url ? (
                <a key={item.label} href={item.url} aria-label={`Download ${platform.name} ${item.label} (${release.version})`}
                  className="flex min-h-12 items-center gap-2 rounded-lg p-2 text-xs font-medium hover:bg-muted hover:text-primary">
                  <Download aria-hidden="true" className="h-4 w-4 shrink-0" /> {item.label}
                </a>
              ) : <p key={item.label} className="flex min-h-12 items-center p-2 text-xs text-muted-foreground">{item.label} · Unavailable</p>)}
            </div>
          </details>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Your OS may warn about unsigned Windows installers or macOS apps that are not notarized. Check the release notes before installing.{' '}
        <a href={release.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">Release notes & checksums</a>
      </p>
    </div>
  );
}

function ProjectCard({ project, featured }: { project: typeof projects[number]; featured: boolean }) {
  const wide = featured || project.downloads;
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(y, { stiffness: 160, damping: 25 });
  const rotateY = useSpring(x, { stiffness: 160, damping: 25 });
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 35 }}
      whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.55 }}
      className={`group overflow-hidden rounded-[2rem] border border-foreground/10 bg-card shadow-sm ${wide ? "md:col-span-12 md:grid md:grid-cols-12" : "md:col-span-6 lg:col-span-4"}`}
    >
      <figure className={`overflow-hidden bg-muted/50 p-4 sm:p-5 [perspective:1000px] ${wide ? "md:col-span-6 md:self-center" : ""}`}
        onPointerMove={event => {
          if (reduceMotion || event.pointerType !== "mouse") return;
          const rect = event.currentTarget.getBoundingClientRect();
          x.set(((event.clientX - rect.left) / rect.width - 0.5) * 5);
          y.set(-((event.clientY - rect.top) / rect.height - 0.5) * 5);
        }} onPointerLeave={() => { x.set(0); y.set(0); }}>
        <motion.img src={project.image} alt={`${project.title}: ${project.visualLabel}`} loading="lazy" decoding="async"
          width={960} height={600} style={reduceMotion ? {} : { rotateX, rotateY }}
          className={`w-full rounded-2xl object-top ${wide ? "aspect-video object-contain" : "aspect-[16/10] object-cover"}`} />
        <figcaption className="mt-3 text-xs text-muted-foreground">{project.visualLabel}</figcaption>
      </figure>
      <div className={`flex flex-col p-6 ${wide ? "md:col-span-6 md:justify-center" : ""}`}>
        <p className="mb-3 text-sm font-medium text-muted-foreground">{project.category}</p>
        <h3 className={`font-bold tracking-tight ${featured ? "text-3xl lg:text-4xl" : "text-2xl"}`}>{project.title}</h3>
        <p className="mt-3 max-w-lg text-sm sm:text-base leading-relaxed text-muted-foreground">{project.subtitle}</p>
        <p className="mt-3 text-xs font-medium text-primary">{project.status}</p>
        <ul className="my-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-foreground/80" aria-label="Project technologies">
          {project.tags.map(tag => <li key={tag}>{tag}</li>)}
        </ul>
        <div className={`${featured ? "mt-2" : "mt-auto"} flex flex-wrap items-center gap-3`}>
          {project.website && <a href={project.website} target="_blank" rel="noopener noreferrer"
            className={buttonVariants({ className: "h-11 rounded-full bg-violet-700 hover:bg-violet-800 text-white" })}>
            Go to website <ArrowUpRight aria-hidden="true" />
          </a>}
          <a href={project.link} target="_blank" rel="noopener noreferrer" aria-label={`${project.title} on GitHub`}
            className={buttonVariants({ variant: "outline", className: "h-11 rounded-full bg-transparent hover:bg-muted" })}>
            <Github aria-hidden="true" /> GitHub <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
        <details className="mt-4 border-t border-border">
          <summary className="min-h-11 w-fit cursor-pointer py-3 text-sm font-semibold text-primary">Engineering notes</summary>
          <dl className="space-y-3 text-sm leading-relaxed">
            <div><dt className="font-semibold">Problem</dt><dd className="mt-1 text-muted-foreground">{project.problem}</dd></div>
            <div><dt className="font-semibold">Implementation</dt><dd className="mt-1 text-muted-foreground">{project.decision}</dd></div>
          </dl>
          <p className="mt-3 pb-3 text-xs text-muted-foreground">Implementation details are documented in the linked repository.</p>
        </details>
        {project.downloads && <OrganizerDownload />}
      </div>
    </motion.article>
  );
};

export const ProjectsSection = () => (
  <section id="projects" className="w-full max-w-7xl mx-auto px-6 py-16">
    <div className="mb-8 md:mb-12">
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Ideas made <span className="text-gradient-primary">real.</span></h2>
      <p className="mt-4 max-w-xl text-muted-foreground text-lg">Explore the product. Try the app. Look under the hood.</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-12 items-start gap-5 md:gap-6">
      {projects.map((project, index) => <ProjectCard key={project.id} project={project} featured={index === 0} />)}
    </div>
  </section>
);
