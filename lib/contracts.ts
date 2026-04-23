import { defineChain } from "viem";

// Arc Testnet chain definition
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

// SkillRegistry contract
export const SKILL_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_SKILL_REGISTRY_ADDRESS as `0x${string}`) ??
  "0x27853b1D8c6E38A86B99597A2e5334c15F532f21";

export const SKILL_REGISTRY_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "_governor", type: "address" }],
  },
  // Views
  {
    type: "function",
    name: "governor",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "skillCount",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSkill",
    inputs: [{ name: "skillId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
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
  // Mutations
  {
    type: "function",
    name: "registerSkill",
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "priceInUSDC", type: "uint256" },
      { name: "tags", type: "string[]" },
    ],
    outputs: [{ name: "skillId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updatePrice",
    inputs: [
      { name: "skillId", type: "uint256" },
      { name: "newPrice", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rateSkill",
    inputs: [
      { name: "skillId", type: "uint256" },
      { name: "rating", type: "uint8" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deactivateSkill",
    inputs: [{ name: "skillId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "emergencyDeactivate",
    inputs: [{ name: "skillId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Events
  {
    type: "event",
    name: "SkillRegistered",
    inputs: [
      { name: "skillId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "priceUSDC", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SkillUpdated",
    inputs: [
      { name: "skillId", type: "uint256", indexed: true },
      { name: "newPrice", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SkillRated",
    inputs: [
      { name: "skillId", type: "uint256", indexed: true },
      { name: "rater", type: "address", indexed: true },
      { name: "rating", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SkillDeactivated",
    inputs: [
      { name: "skillId", type: "uint256", indexed: true },
      { name: "deactivatedBy", type: "address", indexed: true },
    ],
  },
] as const;

// MarketplaceFee contract — on-chain revenue split accounting
export const MARKETPLACE_FEE_ADDRESS =
  (process.env.NEXT_PUBLIC_MARKETPLACE_FEE_ADDRESS as `0x${string}`) ??
  "0xD321f3BD1f7E8bBA574151323614Ec2E4faD3ACB";

export const MARKETPLACE_FEE_ABI = [
  {
    type: "function",
    name: "recordPayment",
    inputs: [
      { name: "skillId", type: "uint256" },
      { name: "payer", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getStats",
    inputs: [],
    outputs: [
      { name: "_totalPayments", type: "uint256" },
      { name: "_totalVolume", type: "uint256" },
      { name: "_platformEarnings", type: "uint256" },
      { name: "_platformFeeBps", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "platformFeeBps",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "PaymentRecorded",
    inputs: [
      { name: "skillId", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "totalAmount", type: "uint256", indexed: false },
      { name: "ownerShare", type: "uint256", indexed: false },
      { name: "platformShare", type: "uint256", indexed: false },
    ],
  },
] as const;

// PaymentGuard contract
export const PAYMENT_GUARD_ADDRESS =
  (process.env.NEXT_PUBLIC_PAYMENT_GUARD_ADDRESS as `0x${string}`) ??
  "0x80a5FfE02BFB34dF0C05541c47b77182391bE3B1";

export const PAYMENT_GUARD_ABI = [
  {
    type: "function",
    name: "checkAndRecord",
    inputs: [
      { name: "agent", type: "address" },
      { name: "skillId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "remaining", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getRemainingBudget",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isSkillAllowed",
    inputs: [
      { name: "agent", type: "address" },
      { name: "skillId", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPolicy",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "epochDuration", type: "uint256" },
          { name: "maxSpendPerEpoch", type: "uint256" },
          { name: "currentEpochStart", type: "uint256" },
          { name: "currentEpochSpend", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "SpendRecorded",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "skillId", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "epochSpend", type: "uint256", indexed: false },
      { name: "remaining", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SpendingCapExceeded",
    inputs: [
      { name: "requested", type: "uint256", indexed: false },
      { name: "remaining", type: "uint256", indexed: false },
    ],
  },
] as const;
