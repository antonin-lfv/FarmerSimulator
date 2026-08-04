import { BankCard } from "@/components/bank/BankCard";

export default function BankPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Banque</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Emprunter ou rembourser, un seul prêt actif à la fois.
        </p>
      </div>

      <BankCard />
    </div>
  );
}
