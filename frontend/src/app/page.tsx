import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Map, LineChart, CloudSun, Sprout, Timer, Package } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const FEATURES = [
  {
    icon: Map,
    title: "Carte interactive",
    description:
      "54 parcelles cliquables, survolables en temps réel. Achetez, cultivez, récoltez directement depuis le plan de votre exploitation.",
  },
  {
    icon: Timer,
    title: "Actions en temps réel",
    description:
      "Labourer, semer, fertiliser, récolter : chaque action prend du temps réel et mobilise votre matériel.",
  },
  {
    icon: LineChart,
    title: "Marché dynamique",
    description:
      "Les prix évoluent en continu selon l'offre, la demande et des événements aléatoires — vendez au bon moment.",
  },
  {
    icon: Package,
    title: "Boutique & inventaire",
    description:
      "Achetez véhicules, accessoires et intrants, suivez votre stock et revendez ce qui ne vous sert plus.",
  },
  {
    icon: CloudSun,
    title: "Saisons & météo",
    description:
      "Un calendrier persistant et des prévisions météo influencent vos rendements et vos décisions.",
  },
  {
    icon: Sprout,
    title: "Cycle de culture complet",
    description:
      "Chaque type de parcelle — champ, vigne, forêt, entrepôt — suit sa propre chaîne d'actions jusqu'à la récolte.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Sprout size={18} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">Verdance</span>
        </div>
        <LinkButton href="/dashboard" variant="secondary" size="sm">
          Entrer dans la ferme
        </LinkButton>
      </header>

      <section className="relative overflow-hidden px-6 pb-20 pt-12 md:px-12 md:pt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <div>
            <Badge tone="brand">Simulateur de gestion agricole</Badge>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
              Gérez votre ferme comme une vraie exploitation.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-foreground-secondary md:text-lg">
              Achetez des parcelles, cultivez au bon rythme, suivez le marché en direct et développez
              votre exploitation — sur une carte interactive pensée pour être claire, rapide et agréable
              à piloter.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/dashboard" size="lg" className="group">
                Entrer dans la ferme
                <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5" />
              </LinkButton>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-brand-50" />
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
              <Image
                src="/map/map.png"
                alt="Plan de la ferme"
                width={800}
                height={800}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface px-6 py-20 md:px-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Tout ce qu&apos;il faut pour piloter une exploitation
          </h2>
          <p className="mt-2 max-w-2xl text-foreground-secondary">
            Une interface pensée pour la clarté : chaque écran répond à une question précise, sans bruit
            visuel.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-background p-6 transition-shadow hover:shadow-md"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <feature.icon size={18} />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground-secondary">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-border px-6 py-8 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-foreground-muted md:flex-row">
          <span>Verdance — projet personnel de simulation agricole</span>
          <Link href="/dashboard" className="text-brand-700 hover:underline">
            Accéder au tableau de bord →
          </Link>
        </div>
      </footer>
    </div>
  );
}
