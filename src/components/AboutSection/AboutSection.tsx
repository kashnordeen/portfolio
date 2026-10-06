import { motion } from "framer-motion";
import { Code2, Globe2, Layout, Users } from "lucide-react";
import { profile, stats as portfolioStats } from "@/data/portfolio";

const stats = [
  { icon: <Layout className="w-6 h-6" />, label: portfolioStats[0].label, value: portfolioStats[0].value },
  { icon: <Code2 className="w-6 h-6" />, label: portfolioStats[1].label, value: portfolioStats[1].value },
  { icon: <Users className="w-6 h-6" />, label: portfolioStats[2].label, value: portfolioStats[2].value },
  { icon: <Globe2 className="w-6 h-6" />, label: portfolioStats[3].label, value: portfolioStats[3].value },
];

export const AboutSection = () => {
  return (
    <section id="about" className="w-full max-w-7xl mx-auto px-6 py-16">
      <motion.div
        className="flex flex-col md:flex-row gap-8 items-center"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="flex-1 space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Building <span className="text-gradient-primary">with purpose.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {profile.aboutSummary}
            </p>
            <details className="mt-5 text-sm text-muted-foreground">
              <summary className="min-h-11 w-fit cursor-pointer py-3 font-semibold text-foreground hover:text-primary">More about me</summary>
              <p className="mt-4 leading-relaxed">{profile.aboutDescription}</p>
            </details>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4 w-full">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              className="p-4 rounded-2xl border border-border bg-card"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
            >
              <div className="text-primary mb-3">
                {stat.icon}
              </div>
              <p className="text-xl font-bold text-foreground mb-1">{stat.value}</p>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};
