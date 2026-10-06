import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, X, ExternalLink } from "lucide-react";
import { certifications } from "@/data/portfolio";

export const CertificationsSection = () => {
  const [activePreview, setActivePreview] = useState<{
    isOpen: boolean;
    image: string;
    title: string;
  }>({
    isOpen: false,
    image: "",
    title: "",
  });

  return (
    <div id="certifications" className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Certifications</h2>
        <p className="mt-3 text-sm text-muted-foreground">Cisco Networking Academy training, with public credentials on Credly.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 items-start">
        {certifications.map(cert => (
          <article key={cert.id} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <img src={cert.credlyBadgeImage} alt="" width={72} height={72} loading="lazy" decoding="async" className="h-18 w-18 shrink-0 object-contain" />
              <div>
                <p className="text-xs text-muted-foreground">{cert.issuer} · {cert.issueDate}</p>
                <h3 className="mt-2 text-xl font-bold tracking-tight">{cert.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{cert.institution}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{cert.description}</p>
            <div className="mt-4 flex flex-wrap gap-x-5">
              <a href={cert.credlyUrl} target="_blank" rel="noopener noreferrer"
                aria-label={`Verify ${cert.title} on Credly`}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline">
                Verify on Credly <ExternalLink aria-hidden="true" size={15} />
              </a>
              <button type="button"
                aria-label={`Expand ${cert.title} certificate preview`}
                onClick={() => setActivePreview({ isOpen: true, image: cert.certificateImage, title: `${cert.title} - ${cert.issuer}` })}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:text-primary">
                <Eye aria-hidden="true" size={16} /> View certificate
              </button>
            </div>
            <details className="mt-2 border-t border-border">
              <summary className="min-h-11 w-fit cursor-pointer py-3 text-sm font-medium text-muted-foreground hover:text-foreground">Topics covered</summary>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {cert.competencies.map(topic => <li key={topic}>{topic}</li>)}
              </ul>
              <ul aria-label="Certificate skills" className="mt-4 flex flex-wrap gap-2">
                {cert.skills.map(skill => <li key={skill} className="rounded-lg bg-muted px-2 py-1 text-xs">{skill}</li>)}
              </ul>
            </details>
          </article>
        ))}
      </div>

      {/* Modal Preview */}
      <AnimatePresence>
        {activePreview.isOpen && (
          <motion.dialog
            ref={dialog => { if (dialog && !dialog.open) dialog.showModal(); }}
            aria-labelledby="certificate-preview-title"
            data-lenis-prevent
            onCancel={() => setActivePreview(prev => ({ ...prev, isOpen: false }))}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivePreview((prev) => ({ ...prev, isOpen: false }))}
            className="fixed inset-0 z-[1000] m-0 w-full h-full max-w-none max-h-none bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
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
                <h4 id="certificate-preview-title" className="font-bold text-foreground text-sm md:text-base line-clamp-1">
                  {activePreview.title}
                </h4>
                <button
                  onClick={() => setActivePreview((prev) => ({ ...prev, isOpen: false }))}
                  aria-label="Close certificate preview"
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
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
          </motion.dialog>
        )}
      </AnimatePresence>
    </div>
  );
};
