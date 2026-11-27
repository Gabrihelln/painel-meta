"use client";

import { useRouter } from "next/navigation";

export default function CampaignSelect({
  options,
  value,
  base,
}: {
  options: { id: string; name: string }[];
  value: string;
  base: string; // URL sem o parâmetro campanha
}) {
  const router = useRouter();
  return (
    <select
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v ? `${base}&campanha=${encodeURIComponent(v)}` : base);
      }}
    >
      <option value="">Todas as campanhas</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );
}
