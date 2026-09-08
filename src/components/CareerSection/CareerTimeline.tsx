import { ScrollTimeline } from "@/components/ui/scroll-timeline";
import { GraduationCap, Code2, BookOpen, Lightbulb } from "lucide-react";
import { careerEvents } from "@/data/portfolio";

export const CareerTimeline = () => {
  const icons = [
    <GraduationCap className="h-4 w-4 mr-2 text-primary" />,
    <Code2 className="h-4 w-4 mr-2 text-primary" />,
    <BookOpen className="h-4 w-4 mr-2 text-primary" />,
    <Lightbulb className="h-4 w-4 mr-2 text-primary" />
  ];

  const mappedEvents = careerEvents.map((event, index) => ({
    ...event,
    icon: icons[index]
  }));

  return (
    <div id="career">
      <ScrollTimeline
        events={mappedEvents}
        title="Development Journey"
        subtitle="Milestones in my path from curious beginner to software engineer"
        animationOrder="staggered"
        cardAlignment="alternating"
        cardVariant="elevated"
        parallaxIntensity={0.15}
        revealAnimation="fade"
        progressIndicator={true}
        lineColor="bg-primary/20"
        activeColor="bg-primary"
        progressLineWidth={3}
        progressLineCap="round"
      />
    </div>
  );
};
