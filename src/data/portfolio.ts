export const profile = {
  name: "Keshav Karn",
  initials: "KK",
  avatar: "/images/keshav-avatar.webp",
  role: "CSE Student",
  specialty: "Web, Android & Applied AI",
  location: "Patiala, Punjab, India",
  email: "kash.nordeen@gmail.com",
  phone: "+91 7700895535",
  github: "https://github.com/kashnordeen",
  linkedin: "https://www.linkedin.com/in/keshav-karn-933910352/",
  resume: "/resume/keshav-karn-resume.pdf",
  badgeId: "KK-27041-DEV",
  experience: "Early Career",
  bio: "Computer Science student focused on software engineering. I build secure web platforms, offline-first apps, and applied AI systems, from the first idea to a working product.",
  aboutHeading: "Secure, Intelligent Products",
  aboutSummary: "Studying Computer Science at Thapar. Building across web, Android, AI, and IoT, with security and data integrity at the center of every project.",
  aboutDescription: "I am pursuing a B.Tech in Computer Science and Engineering at Thapar Institute of Engineering and Technology, with graduation expected in May 2027. My foundation is in data structures, algorithms, object-oriented programming, and database systems. I apply it through projects in native Android, full-stack development, multimodal search, computer vision, and cloud-connected IoT. I enjoy understanding a problem, choosing an architecture, implementing it, and testing how it behaves when things go wrong.",
};

export const stats = [
  { label: "Experience", value: "Early Career" },
  { label: "Selected Projects", value: "5" },
  { label: "Technologies Used", value: "15+" },
  { label: "Expected Graduation", value: "2027" },
];

export const technologies = [
  { name: "React", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg" },
  { name: "Next.js", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg" },
  { name: "TypeScript", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg" },
  { name: "JavaScript", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg" },
  { name: "Node.js", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg" },
  { name: "Python", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg" },
  { name: "Kotlin", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kotlin/kotlin-original.svg" },
  { name: "Java", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg" },
  { name: "C++", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-original.svg" },
  { name: "FastAPI", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/fastapi/fastapi-original.svg" },
  { name: "PyTorch", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/pytorch/pytorch-original.svg" },
  { name: "Tailwind CSS", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg" },
  { name: "Git", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg" },
  { name: "PostgreSQL", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg" },
  { name: "MySQL", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg" },
  { name: "Docker", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg" },
  { name: "OpenCV", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/opencv/opencv-original.svg" },
  { name: "Linux", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg" },
];

export const services = [
  {
    title: "Full-stack platforms",
    description: "Connected interfaces, APIs, and databases that turn complex workflows into usable products.",
  },
  {
    title: "Android & desktop apps",
    description: "Offline-first experiences with local storage, practical automation, and safe recovery.",
  },
  {
    title: "Secure backends",
    description: "Clear API contracts, protected access, and reliable data handling.",
  },
  {
    title: "Applied AI & IoT",
    description: "Multimodal search, predictive models, and connected telemetry for real-world problems.",
  },
];

export const organizerDownloads = [
  { platform: "Windows", label: "Setup (x64)", file: "DownloadsOrganizer-1.0.0-windows-x64-setup.exe" },
  { platform: "Windows", label: "Portable (x64)", file: "DownloadsOrganizer-1.0.0-windows-x64-portable.zip" },
  { platform: "macOS", label: "Apple Silicon", file: "DownloadsOrganizer-1.0.0-macos-arm64-unsigned.dmg" },
  { platform: "macOS", label: "Intel", file: "DownloadsOrganizer-1.0.0-macos-x64-unsigned.dmg" },
  { platform: "Linux", label: "Debian / Ubuntu (x64)", file: "DownloadsOrganizer-1.0.0-linux-x64.deb" },
  { platform: "Linux", label: "Portable (x64)", file: "DownloadsOrganizer-1.0.0-linux-x64-portable.tar.gz" },
];
export const organizerRelease = "https://github.com/kashnordeen/downloads-organizer/releases/tag/v1.0.0";
export const organizerDownloadBase = "https://github.com/kashnordeen/downloads-organizer/releases/download/v1.0.0/";

export const projects: {
  id: number; title: string; subtitle: string; link: string; image: string;
  category: string; tags: string[]; website?: string; downloads?: boolean;
  status: string; visualLabel: string; problem: string; decision: string;
}[] = [
  {
    id: 1,
    title: "GramFlow Web",
    subtitle: "Inventory, FIFO ledgers, and financial insights. One connected workspace for the entire business.",
    link: "https://github.com/kashnordeen/GramFlow",
    image: "/projects/gramflow-live.webp",
    category: "Full-stack platform",
    tags: ["Next.js", "TypeScript", "PostgreSQL"],
    website: "https://gramflow-ochre.vercel.app/",
    status: "Live web app · Sign-in required",
    visualLabel: "Actual app UI · Sign-in screen",
    problem: "Keep batch inventory, sales, receivables, and accounting consistent as stock changes.",
    decision: "FIFO allocations, journals, and audit events share a database transaction. Server-side permissions protect business operations.",
  },
  {
    id: 5,
    title: "Downloads Organizer",
    subtitle: "A calmer downloads folder. Preview moves, automate your rules, and undo safely. Your files stay on your device.",
    link: "https://github.com/kashnordeen/downloads-organizer",
    image: "/projects/downloads-organizer.png",
    category: "Local-first desktop app",
    tags: ["Python", "Qt", "SQLite"],
    downloads: true,
    status: "Desktop release · v1.0.0",
    visualLabel: "Actual app UI · Demonstration files",
    problem: "Organize downloaded files without overwriting existing files or losing track of moves.",
    decision: "Preview before moving. SQLite records move history, while collision checks and verified copies support recovery and safe undo.",
  },
  {
    id: 2,
    title: "GramFlow Android",
    subtitle: "Inventory that keeps working offline. Native Android tools for FIFO batches and customer ledgers.",
    link: "https://github.com/kashnordeen/GramFlow_Android",
    image: "/projects/gramflow-android.svg",
    category: "Native Android",
    tags: ["Kotlin", "Jetpack Compose", "Room"],
    status: "Android app · Source available",
    visualLabel: "App concept illustration",
    problem: "Track inventory batches and customer balances when there is no network connection.",
    decision: "Room persists local data. MVVM and reactive flows connect inventory, FIFO allocation, and customer ledgers to the Compose interface.",
  },
  {
    id: 3,
    title: "De-Insure",
    subtitle: "From sensor to settlement. Cold-chain telemetry meets predictive models and parametric insurance.",
    link: "https://github.com/kashnordeen/De-Insure-A-Parametric-Insurance-Framework-for-Cold-Chain-Logistics",
    image: "/projects/deinsure.jpg",
    category: "IoT & machine learning",
    tags: ["PyTorch", "AWS IoT Core", "Solidity"],
    status: "Research prototype · Source available",
    visualLabel: "Architecture concept illustration",
    problem: "Connect cold-chain condition monitoring to a verifiable insurance decision.",
    decision: "Signed ESP32 telemetry travels over MQTT/TLS. Separate oracle workers validate data, evaluate spoilage, and apply excursion policy before contract consensus.",
  },
  {
    id: 4,
    title: "FINDORA",
    subtitle: "Find what matters. Multimodal AI matches lost items while keeping contact details protected.",
    link: "https://github.com/kashnordeen/FINDORA",
    image: "/projects/findora.svg",
    category: "Applied AI",
    tags: ["FastAPI", "SvelteKit", "pgvector"],
    status: "Campus project · Source available",
    visualLabel: "Product concept illustration",
    problem: "Match campus lost-and-found reports without publishing personal contact details.",
    decision: "CLIP and text embeddings retrieve candidates through pgvector. Match approval gates contact sharing, with background scoring and archival.",
  },
];

export const careerEvents = [
  {
    year: "2025 – Present",
    title: "Full-Stack & AI Project Development",
    subtitle: "Independent & Academic Projects",
    description: "Building production-oriented web, mobile, AI/ML, and IoT projects, including multimodal search, vector retrieval, telemetry pipelines, and secure full-stack applications.",
  },
  {
    year: "2023 – Present",
    title: "Computer Science & Engineering",
    subtitle: "Thapar Institute of Engineering and Technology",
    description: "Developing a strong foundation in data structures, algorithms, databases, computer networks, and system design while applying those concepts to end-to-end software projects.",
  },
  {
    year: "2022 – 2023",
    title: "Completed High School",
    subtitle: "Little Angels' High School ( Nepal )",
    description: "Graduated from Little Angels' High School under Nepal Education Board with GPA 2.91. Developed a strong foundation in mathematics and science.",
  },
  {
    year: "2021 – 2022",
    title: "Started Learning Programming",
    subtitle: "Self-Taught Journey",
    description: "Began learning programming through online resources. Explored Python, HTML/CSS, and JavaScript fundamentals. Built first personal projects and discovered a passion for web development.",
  },
];

export const education = [
  {
    degree: "B.Tech in Computer Science & Engineering",
    school: "Thapar Institute of Engineering and Technology",
    year: "2023 – 2027",
    badge: "Currently Pursuing",
    badgeColor: "text-primary bg-primary/10 border-primary/30",
    details: [
      "Pursuing Bachelor of Technology in Computer Science & Engineering; expected May 2027",
      "Building proficiency in Data Structures, Algorithms & System Design",
      "Developing full-stack web applications as personal and academic projects",
      "Actively participating in coding competitions and tech communities",
    ],
  },
  {
    degree: "High School",
    school: "Little Angels' High School ( Nepal )",
    year: "2022 – 2023",
    badge: "Completed",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    details: [
      "Completed under Nepal Education Board with GPA 2.91",
      "Strong foundation in Mathematics, Physics & Computer Science",
      "Developed analytical thinking and problem-solving skills",
      "First exposure to programming concepts and computational thinking",
    ],
  },
];

export const certifications = [
  {
    id: 1,
    title: "Network Defense",
    issuer: "Cisco Networking Academy",
    institution: "Thapar Institute of Engineering and Technology",
    instructor: "Gurpal Singh Chhabra",
    issueDate: "February 2026",
    badge: "Verified Credential",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    description:
      "Student-level credential in foundational network defense, securing Linux & Windows endpoints, simulating network firewalls, managing identity lifecycles, and configuring PKI data protection.",
    competencies: [
      "Documenting network security posture & threat models",
      "Configuring firewall rules & simulated defense barriers",
      "Hardening Linux and Windows network endpoints",
      "Implementing Identity Lifecycle & Public Key Infrastructure (PKI)",
      "Cloud security measures & virtual computing environments",
    ],
    skills: [
      "Network Security",
      "Firewall Configuration",
      "Linux & Windows Hardening",
      "Identity Management (IAM)",
      "PKI & Data Protection",
      "Cloud Security",
    ],
    certificateImage: "/certificates/cisco-network-defense-certificate.png",
    credlyBadgeImage: "/certificates/credly-network-defense.png",
    credlyUrl: "https://www.credly.com/badges/657183b7-480b-4c78-8638-5fa400758c4d/public_url",
  },
  {
    id: 2,
    title: "Cyber Threat Management",
    issuer: "Cisco Networking Academy",
    institution: "Thapar Institute of Engineering and Technology",
    instructor: "Gurpal Singh Chhabra",
    issueDate: "September 2026",
    badge: "Verified Credential",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    description:
      "Cisco Networking Academy course completion focused on cybersecurity governance and practical threat management, including vulnerability assessment, organizational risk, policy, compliance, and incident response.",
    competencies: [
      "Assessing networks for vulnerabilities",
      "Managing organizational cybersecurity risk",
      "Responding to security incidents",
      "Developing cybersecurity policies",
      "Applying ethical, legal & regulatory frameworks",
    ],
    skills: [
      "Threat Management",
      "Vulnerability Assessment",
      "Risk Management",
      "Incident Response",
      "Security Governance",
      "Policy & Compliance",
    ],
    certificateImage: "/certificates/cisco-cyber-threat-management-certificate.png",
    credlyBadgeImage: "/certificates/credly-cyber-threat-management.png",
    credlyUrl: "https://www.credly.com/badges/ff5f66f1-99af-4605-a28f-fdbc541d64b8/public_url",
  },
];

export const technicalSkillGroups = [
  {
    name: "Cybersecurity",
    skills: ["Web Application Security Testing", "Vulnerability Assessment", "Network Reconnaissance", "DNS Enumeration", "Security Scanning", "Network Security", "Threat Management", "Secure Network Configuration"],
  },
  {
    name: "Security Tools",
    skills: ["Nmap", "OWASP ZAP", "Nikto", "Wapiti", "WafW00f", "DNS Enumeration Tools", "Vulnerability Scanning"],
  },
  {
    name: "Languages",
    skills: ["Python", "TypeScript", "Kotlin", "JavaScript", "SQL", "Java", "C++", "C"],
  },
  {
    name: "Systems & Networking",
    skills: ["Linux", "Docker", "MQTT (TLS)", "RESTful APIs", "TCP/IP", "DNS", "DHCP", "Operating Systems", "Networking Concepts", "Data Structures & Algorithms", "Object-Oriented Programming", "Database Management Systems"],
  },
  {
    name: "Application, Cloud & Databases",
    skills: ["FastAPI", "PostgreSQL", "Next.js", "React", "Svelte/SvelteKit", "Node.js", "Express.js", "MySQL", "SQLAlchemy", "pgvector", "AWS IoT Core", "AWS", "Git/GitHub", "JWT", "RBAC", "Authentication & Authorization"],
  },
  {
    name: "AI/ML & Computer Vision",
    skills: ["PyTorch", "XGBoost", "Scikit-learn", "Transformers", "CLIP", "Sentence-Transformers", "NLP", "Computer Vision (OpenCV)"],
  },
];

export const softSkills = [
  { name: "Security by design", description: "Protect access. Validate inputs. Keep personal data private.", evidence: "FINDORA's protected contact sharing" },
  { name: "Systems thinking", description: "Connect interfaces, data, and infrastructure into a coherent product.", evidence: "De-Insure's sensor-to-contract pipeline" },
  { name: "Resilient engineering", description: "Plan for offline use, interrupted work, and safe recovery.", evidence: "GramFlow Android & Downloads Organizer" },
  { name: "End-to-end ownership", description: "Take an idea through implementation, testing, and release.", evidence: "Live web apps & cross-platform installers" },
];

export const professionalSummary =
  "Build with intent. Ship with care.";

export const morphingTexts = [
  "CSE Student",
  "Full-Stack Developer",
  "AI & IoT Builder",
  "Cybersecurity Learner",
  "Keshav Karn",
];
