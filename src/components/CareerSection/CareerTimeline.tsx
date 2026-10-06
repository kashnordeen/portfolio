import { careerEvents } from "@/data/portfolio";

export const CareerTimeline = () => (
  <section id="career" className="w-full max-w-7xl mx-auto px-6 py-16">
    <h2 className="text-3xl font-bold tracking-tight">Development journey</h2>
    <ol className="mt-8 divide-y divide-border border-y border-border">
      {careerEvents.slice(0, 2).map(event => (
        <li key={event.year} className="grid gap-3 py-6 md:grid-cols-[180px_1fr]">
          <p className="text-sm font-medium text-muted-foreground">{event.year}</p>
          <div>
            <h3 className="text-lg font-semibold">{event.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{event.subtitle}</p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{event.description}</p>
          </div>
        </li>
      ))}
    </ol>
    <details className="mt-3">
      <summary className="min-h-11 w-fit cursor-pointer py-3 text-sm font-medium text-primary">Earlier milestones</summary>
      <ol className="grid gap-5 py-4 md:grid-cols-2">
        {careerEvents.slice(2).map(event => (
          <li key={event.year}>
            <p className="text-xs text-muted-foreground">{event.year}</p>
            <h3 className="mt-1 font-semibold">{event.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{event.description}</p>
          </li>
        ))}
      </ol>
    </details>
  </section>
);
