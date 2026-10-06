import { motion } from "framer-motion";
import { Send, MapPin, Mail, Phone, CheckCircle2, AlertCircle, ArrowUpRight, Github, Linkedin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { profile } from "@/data/portfolio";

export const ContactSection = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const message = Object.fromEntries(Object.entries(formData).map(([key, value]) => [key, value.trim()]));
    if (isLoading || !message.name || !message.email || !message.message) return;
    
    setIsLoading(true);
    setStatus("idle");

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: "53d7fa2e-64c5-4a4a-a0a5-49e08397f453",
          ...message,
          subject: `New Portfolio Message from ${message.name}`,
          from_name: "Keshav Karn Portfolio",
        }),
      });

      const result = await response.json();
      if (response.ok && result.success === true) {
        setStatus("success");
        setFormData({ name: "", email: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="contact" className="w-full max-w-7xl mx-auto px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.8 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
      >
          {/* Contact Info */}
          <div className="lg:col-span-5 space-y-8 py-2">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 max-w-sm">
                Let's build <span className="text-gradient-primary">something useful.</span>
              </h2>
              <p className="text-muted-foreground">
                Open to opportunities, collaborations, and good engineering conversations. Have something in mind? Let's talk.
              </p>
            </div>

            <div className="divide-y divide-border border-y border-border">
              <a href={`mailto:${profile.email}`} className="flex min-h-20 items-center gap-3 py-4 hover:text-primary transition-colors">
                <Mail aria-hidden="true" className="w-5 h-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground mb-1">Email directly</span><span className="font-semibold text-sm sm:text-base break-all">{profile.email}</span></span>
                <ArrowUpRight aria-hidden="true" className="w-4 h-4 shrink-0" />
              </a>
              <a href={`tel:${profile.phone.replace(/\s/g, '')}`} className="flex min-h-16 items-center gap-3 py-4 text-sm font-medium hover:text-primary transition-colors">
                <Phone aria-hidden="true" className="w-5 h-5 shrink-0 text-primary" />
                {profile.phone}
              </a>
              <div className="flex min-h-16 items-center gap-3 py-4 text-sm text-muted-foreground">
                <MapPin aria-hidden="true" className="w-5 h-5 shrink-0" />
                {profile.location}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={profile.github} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"><Github aria-hidden="true" className="h-4 w-4" /> GitHub <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>
              <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"><Linkedin aria-hidden="true" className="h-4 w-4" /> LinkedIn <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-7 bg-card p-6 md:p-8 rounded-[2rem] border border-border">
            <h3 className="text-xl font-bold tracking-tight">Send a message</h3>
            <p className="mt-2 mb-6 text-sm text-muted-foreground">All fields are required. This form sends your details to Web3Forms. You can also email directly.</p>
            <form className="space-y-5" onSubmit={handleSubmit} aria-busy={isLoading}>
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-muted-foreground mb-1.5">Your Name</label>
                <Input 
                  id="contact-name"
                  name="name"
                  type="text" 
                  autoComplete="name"
                  required
                  pattern=".*\S.*"
                  maxLength={100}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="h-12 rounded-xl py-3 px-4 bg-background border-foreground/30 text-foreground focus-visible:ring-primary"
                />
              </div>
              
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-muted-foreground mb-1.5">Your Email</label>
                <Input 
                  id="contact-email"
                  name="email"
                  type="email" 
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="h-12 rounded-xl py-3 px-4 bg-background border-foreground/30 text-foreground focus-visible:ring-primary"
                />
              </div>
              
              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-muted-foreground mb-1.5">Message</label>
                <Textarea 
                  id="contact-message"
                  name="message"
                  rows={4}
                  required
                  maxLength={5000}
                  value={formData.message}
                  onChange={(e) => {
                    e.target.setCustomValidity(e.target.value.trim() ? "" : "Enter a message, not just spaces.");
                    setFormData({...formData, message: e.target.value});
                  }}
                  className="rounded-xl py-3 px-4 bg-background border-foreground/30 text-foreground focus-visible:ring-primary resize-y min-h-[140px]"
                />
              </div>

              <Button type="submit" disabled={isLoading} size="lg" className="w-full sm:w-auto rounded-full bg-violet-700 text-white hover:bg-violet-800 font-semibold px-6 h-12">
                {isLoading ? "Sending..." : <>Send Message <Send className="w-4 h-4 ml-1" /></>}
              </Button>

              {status === "success" && (
                <div role="status" className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Message accepted by Web3Forms. Thanks for reaching out.</span>
                </div>
              )}

              {status === "error" && (
                <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Failed to send message. Please try again or email directly.</span>
                </div>
              )}
            </form>
          </div>

      </motion.div>
    </section>
  );
};
