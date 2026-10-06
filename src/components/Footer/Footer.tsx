import { ArrowUp } from "lucide-react";
import { profile } from "@/data/portfolio";
import { useLenis } from "lenis/react";
import { useReducedMotion } from "framer-motion";

export const Footer = () => {
  const lenis = useLenis();
  const reduceMotion = useReducedMotion();
  return (
  <footer className="w-full border-t border-border bg-card/60 px-6 pt-8 pb-28">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <img src={profile.avatar} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 rounded-xl object-cover object-top" />
        <div>
          <p className="text-sm font-semibold">{profile.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">© {new Date().getFullYear()} · {profile.role}</p>
        </div>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-5">
        <a href={profile.github} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm hover:text-primary">GitHub</a>
        <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm hover:text-primary">LinkedIn</a>
        <a href={`mailto:${profile.email}`} className="inline-flex min-h-11 items-center text-sm hover:text-primary">Email</a>
        <a href="#hero" onClick={event => {
          if (lenis) { event.preventDefault(); lenis.scrollTo('#hero', { immediate: !!reduceMotion }); }
        }} className="inline-flex min-h-11 items-center gap-2 text-sm hover:text-primary">Back to top <ArrowUp aria-hidden="true" size={16} /></a>
      </nav>
    </div>
  </footer>
);
};

export default Footer;
