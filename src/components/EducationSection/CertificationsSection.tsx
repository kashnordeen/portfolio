import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Award, ExternalLink, Eye, CheckCircle2, X, Calendar, Building2 } from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { Button } from "@/components/ui/button";
import { certifications } from "@/data/portfolio";

export const CertificationsSection = () => {
  const [activePreview, setActivePreview] = useState<{
    isOpen: boolean;
    image: string;
    title: string;
    pdfUrl: string;
  }>({
    isOpen: false,
    image: "",
    title: "",
    pdfUrl: "",
  });

  return (
    <div id="certifications" className="space-y-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        viewport={{ once: true }}
      >
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Licenses & <span className="text-gradient-primary">Certifications</span>
          </h2>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Industry credentials and verified academy training validating technical knowledge and hands-on competencies.
        </p>
      </motion.div>

      {/* Certifications Grid */}
      <div className="grid grid-cols-1 gap-8">
        {certifications.map((cert, index) => (
          <motion.div
            key={cert.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.15, duration: 0.5 }}
            viewport={{ once: true }}
          >
            <MagicCard
              className="p-6 md:p-8 rounded-[2.25rem] border border-border/80 bg-card/80 shadow-xl overflow-hidden"
              gradientSize={350}
              gradientColor="rgba(139, 92, 246, 0.12)"
              gradientFrom="#8b5cf6"
              gradientTo="#38bdf8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Certificate Visual Preview Column */}
                <div className="lg:col-span-5 flex flex-col gap-3">
                  <div
                    onClick={() =>
                      setActivePreview({
                        isOpen: true,
                        image: cert.certificateImage,
                        title: `${cert.title} — ${cert.issuer}`,
                        pdfUrl: cert.certificatePdf,
                      })
                    }
                    className="group relative rounded-2xl overflow-hidden border border-border/80 shadow-lg cursor-pointer bg-muted/40 aspect-[4/3] flex items-center justify-center"
                  >
                    <img
                      src={cert.certificateImage}
                      alt={cert.title}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-4">
                      <span className="text-white text-xs font-semibold flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                        <Eye className="w-3.5 h-3.5 text-primary" /> Click to Expand Preview
                      </span>
                    </div>
                  </div>

                  {/* Secondary credential quick-toggle hint */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-emerald-400" /> Cisco Verified Credential
                    </span>
                    <button
                      onClick={() =>
                        setActivePreview({
                          isOpen: true,
                          image: cert.completionImage,
                          title: `${cert.title} (Course Completion Transcript) — ${cert.issuer}`,
                          pdfUrl: cert.completionPdf,
                        })
                      }
                      className="text-primary hover:underline font-medium cursor-pointer"
                    >
                      View Transcript →
                    </button>
                  </div>
                </div>

                {/* Information Column */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full text-xs font-bold border text-primary bg-primary/10 border-primary/30">
                        {cert.issuer}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${cert.badgeColor}`}>
                        {cert.badge}
                      </span>
                    </div>

                    <h3 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                      {cert.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground mt-2 pb-3 border-b border-border/60">
                      <span className="flex items-center gap-1.5 text-foreground font-bold">
                        <Building2 className="w-3.5 h-3.5 text-primary" /> {cert.institution}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5 font-mono text-primary font-bold">
                        <Calendar className="w-3.5 h-3.5" /> {cert.issueDate}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cert.description}
                  </p>

                  {/* Competencies */}
                  <div className="space-y-2">
                    <span className="text-xs uppercase tracking-wider font-bold text-foreground block">
                      Core Competencies Mastered:
                    </span>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cert.competencies.map((comp, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{comp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Skills Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {cert.skills.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-2.5 py-1 rounded-lg bg-foreground/5 border border-foreground/10 text-[11px] font-semibold text-foreground/90"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button
                      asChild
                      size="sm"
                      className="rounded-xl gap-2 font-semibold shadow-md shadow-primary/20"
                    >
                      <a href={cert.certificatePdf} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" /> View Certificate PDF
                      </a>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-2 font-semibold glass-panel border-foreground/10"
                    >
                      <a href={cert.completionPdf} target="_blank" rel="noopener noreferrer">
                        <Award className="w-4 h-4 text-emerald-400" /> Completion Transcript
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </MagicCard>
          </motion.div>
        ))}
      </div>

      {/* Modal Preview */}
      <AnimatePresence>
        {activePreview.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivePreview((prev) => ({ ...prev, isOpen: false }))}
            className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full bg-card rounded-2xl border border-border/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/30">
                <h4 className="font-bold text-foreground text-sm md:text-base line-clamp-1">
                  {activePreview.title}
                </h4>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5 text-xs">
                    <a href={activePreview.pdfUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" /> Open Full PDF
                    </a>
                  </Button>
                  <button
                    onClick={() => setActivePreview((prev) => ({ ...prev, isOpen: false }))}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 overflow-y-auto flex items-center justify-center bg-black/40">
                <img
                  src={activePreview.image}
                  alt={activePreview.title}
                  className="max-h-[75vh] w-auto object-contain rounded-lg shadow-lg border border-border/40"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
