import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Download, Github, Linkedin, Mail, ScanLine } from "lucide-react";
import TechStackSection from "../TechStackSection/TechStackSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HangingIdCard } from "@/components/ui/HangingIdCard";
import { DotPattern } from "@/components/ui/dot-pattern";
import { profile } from "@/data/portfolio";
import { useLenis } from "lenis/react";

export const HeroSection = () => {
  const lenis = useLenis();
  const reduceMotion = useReducedMotion();
  return (
    <section id="hero" className="relative min-h-[100dvh] flex flex-col pt-20 md:pt-16 overflow-hidden bg-background">
      {/* Background Dot Pattern with Radial Vignette Shade */}
      <DotPattern width={16} height={16} cx={1} cy={1} cr={1} />
      
      {/* Main Content Area */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full flex-1 flex flex-col md:flex-row items-center justify-center gap-12 md:gap-20 pb-12">
        
        {/* Left Content */}
        <motion.div 
          className="flex-1 flex flex-col items-center md:items-start text-center md:text-left pt-0"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <motion.div 
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6"
          >
            <Badge variant="outline" size="lg" className="gap-2.5 py-1.5 px-4 glass-panel border-foreground/10">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs font-medium text-muted-foreground">Open to Opportunities</span>
            </Badge>
          </motion.div>

          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mb-4 text-center md:text-left"
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
              Hi, I'm
            
            {/* Theme-Aware Seamless Gradient Text */}
            <span className="text-gradient-primary font-extrabold text-[clamp(3rem,6.5vw,5.5rem)] leading-none tracking-tight block pb-2 select-none">
              {profile.name}
            </span>
            </h1>
          </motion.div>

          <motion.p 
            className="text-lg md:text-xl text-muted-foreground max-w-xl mb-8 leading-relaxed w-full"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            {profile.bio}
          </motion.p>

          <motion.div 
            className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-10 w-full md:w-auto"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <Button size="lg" onClick={() => {
              if (lenis) lenis.scrollTo('#projects', { immediate: !!reduceMotion });
              else document.getElementById('projects')?.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth' });
            }} className="rounded-full px-7 h-12 bg-primary text-primary-foreground font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors">
              View Work <ArrowRight className="w-4 h-4" />
            </Button>
            {profile.resume && (
              <Button size="lg" variant="outline" asChild className="rounded-full px-7 h-12 glass-panel text-foreground font-semibold flex items-center gap-2 hover:bg-foreground/10 transition-all hover:-translate-y-1 border-foreground/10">
                <a href={profile.resume} target="_blank" rel="noopener noreferrer">
                  Resume <Download className="w-4 h-4" />
                </a>
              </Button>
            )}
          </motion.div>

          {/* Social Links */}
          <motion.div 
            className="flex items-center gap-5 justify-center md:justify-start w-full md:w-auto"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            <a href={profile.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Linkedin className="w-5 h-5" />
            </a>
            <a href={`mailto:${profile.email}`} aria-label="Email" className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="w-5 h-5" />
            </a>
          </motion.div>
        </motion.div>

        {/* Right Content - Visual Hanging ID Card */}
        <motion.div 
          className="flex-1 w-full max-w-md relative flex justify-center items-center py-2"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <HangingIdCard
            name={profile.name}
            role={profile.role}
            badgeId={profile.badgeId}
            accentColor="#8b5cf6"
            ropeLength={75}
            ropeColor="#27272a"
            cardWidth="w-[min(18rem,calc(100vw-3rem))] sm:w-80 md:w-84"
          >
            <div className="flex flex-col h-full bg-card w-full">
              {/* Portrait panel */}
              <div className="relative h-52 flex flex-col items-center bg-slate-950 text-white overflow-hidden">
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-500/10" />
                <ScanLine aria-hidden="true" className="absolute top-6 left-5 h-5 w-5 text-slate-400" />
                <div aria-hidden="true" className="absolute top-8 w-40 h-40 rounded-full border border-white/15" />
                <img src={profile.avatar} alt="Keshav Karn's voxel avatar" width={1254} height={1254}
                  fetchPriority="high" className="relative h-60 w-60 mt-3 object-contain" />
              </div>

              {/* Card Body */}
              <div className="p-5 flex flex-col bg-card text-card-foreground gap-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight">{profile.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{profile.role}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                  </span>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Specialty</p>
                  <p className="mt-1 text-sm font-bold">{profile.specialty}</p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="mt-1 font-semibold">Patiala, India</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Experience</dt>
                    <dd className="mt-1 font-semibold">{profile.experience}</dd>
                  </div>
                </dl>
                <div className="flex items-center justify-between border-t border-border pt-3 text-[10px]">
                  <span className="text-muted-foreground">Developer ID</span>
                  <span className="font-mono font-semibold tracking-wide">{profile.badgeId}</span>
                </div>
              </div>
            </div>
          </HangingIdCard>
        </motion.div>

      </div>

      {/* Marquee appended natively to the bottom to span Full Width */}
      <div className="w-full relative z-10 mt-auto">
        <TechStackSection />
      </div>
    </section>
  );
};
