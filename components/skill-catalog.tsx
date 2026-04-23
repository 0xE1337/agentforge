import { createPublicClient, http, formatUnits } from "viem";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Inline chain definition to avoid .ts extension import issues in Server Components
const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
} as const;

const REGISTRY = "0x27853b1D8c6E38A86B99597A2e5334c15F532f21" as const;
const GUARD = "0x80a5FfE02BFB34dF0C05541c47b77182391bE3B1" as const;

const SKILL_COLORS = ["text-sky-400", "text-emerald-400", "text-purple-400", "text-red-400", "text-amber-400"];

const ABI_GET_ACTIVE = [
  {
    type: "function",
    name: "getActiveSkills",
    inputs: [],
    outputs: [
      { name: "ids", type: "uint256[]" },
      {
        name: "skills",
        type: "tuple[]",
        components: [
          { name: "owner", type: "address" },
          { name: "name", type: "string" },
          { name: "description", type: "string" },
          { name: "endpoint", type: "string" },
          { name: "priceUSDC", type: "uint256" },
          { name: "tags", type: "string[]" },
          { name: "totalRating", type: "uint256" },
          { name: "ratingCount", type: "uint256" },
          { name: "active", type: "bool" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

interface OnChainSkill {
  id: number;
  name: string;
  description: string;
  price: string;
  tags: readonly string[];
  avgRating: number;
  ratingCount: number;
}

async function fetchSkills(): Promise<OnChainSkill[]> {
  try {
    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });

    const raw = await client.readContract({
      address: REGISTRY,
      abi: ABI_GET_ACTIVE,
      functionName: "getActiveSkills",
    });
    const ids = raw[0] as readonly bigint[];
    const skills = raw[1] as readonly {
      name: string;
      description: string;
      priceUSDC: bigint;
      tags: readonly string[];
      totalRating: bigint;
      ratingCount: bigint;
    }[];

    return ids.map((id, i) => {
      const s = skills[i];
      const rc = Number(s.ratingCount);
      return {
        id: Number(id),
        name: s.name,
        description: s.description,
        price: formatUnits(s.priceUSDC, 6),
        tags: s.tags,
        avgRating: rc > 0 ? Number(s.totalRating) / rc : 0,
        ratingCount: rc,
      };
    });
  } catch {
    return [];
  }
}

/** Server Component — reads directly from Arc Testnet SkillRegistry */
export async function SkillCatalog() {
  const skills = await fetchSkills();

  if (skills.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Unable to read SkillRegistry — check Arc Testnet RPC
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          On-Chain Skill Catalog
        </h2>
        <Badge variant="outline" className="text-[9px]">
          Live from Arc Testnet
        </Badge>
        <a
          href={`https://testnet.arcscan.app/address/${REGISTRY}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-primary hover:underline ml-auto"
        >
          {REGISTRY.slice(0, 8)}...{REGISTRY.slice(-6)}
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {skills.map((skill, idx) => (
          <Card key={skill.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className={`text-sm font-semibold ${SKILL_COLORS[idx % SKILL_COLORS.length]}`}>
                {skill.name}
              </div>
              <div className="text-xl font-mono font-bold mt-1">${skill.price}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">per request (USDC)</div>

              {/* Rating */}
              {skill.ratingCount > 0 ? (
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-amber-400 text-xs">
                    {"★".repeat(Math.round(skill.avgRating))}{"☆".repeat(5 - Math.round(skill.avgRating))}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    ({skill.ratingCount})
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-[9px] text-muted-foreground">No ratings yet</div>
              )}

              <div className="flex gap-1 mt-2 flex-wrap">
                {skill.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0">
                    {t}
                  </Badge>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                {skill.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contract info bar */}
      <div className="mt-4 rounded-md border p-3 flex flex-wrap items-center gap-4 text-[10px] font-mono text-muted-foreground">
        <span>SkillRegistry: <a href={`https://testnet.arcscan.app/address/${REGISTRY}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{REGISTRY.slice(0, 14)}...</a></span>
        <span>PaymentGuard: <a href={`https://testnet.arcscan.app/address/${GUARD}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{GUARD.slice(0, 14)}...</a></span>
        <span>Chain: Arc Testnet (5042002)</span>
        <span>{skills.length} active skills</span>
      </div>
    </div>
  );
}
