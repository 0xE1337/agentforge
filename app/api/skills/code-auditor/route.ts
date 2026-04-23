import { NextRequest, NextResponse } from "next/server";
import { withGateway } from "@/lib/x402";

const vulnerabilities = [
  { severity: "critical", type: "Reentrancy", location: "withdraw()", description: "State update after external call" },
  { severity: "high", type: "Unchecked Return", location: "transfer()", description: "ERC-20 transfer return value ignored" },
  { severity: "medium", type: "Floating Pragma", location: "pragma solidity ^0.8.0", description: "Use fixed compiler version" },
  { severity: "low", type: "Missing Events", location: "setOwner()", description: "State change without event emission" },
  { severity: "info", type: "Gas Optimization", location: "loop at L42", description: "Use unchecked increment in for loop" },
];

const handler = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const contract = (body as { contract?: string }).contract ?? "UnknownContract.sol";

  const findingCount = Math.floor(Math.random() * 4) + 1;
  const shuffled = [...vulnerabilities].sort(() => Math.random() - 0.5);
  const findings = shuffled.slice(0, findingCount);

  const hasCritical = findings.some((f) => f.severity === "critical");
  const hasHigh = findings.some((f) => f.severity === "high");

  return NextResponse.json({
    skillId: 4,
    skill: "Code Auditor",
    result: {
      contract,
      score: hasCritical ? 35 : hasHigh ? 62 : 88,
      totalFindings: findings.length,
      findings,
      recommendation: hasCritical
        ? "DO NOT DEPLOY — critical issues found"
        : hasHigh
          ? "Fix high-severity issues before deployment"
          : "Generally safe with minor improvements recommended",
    },
    timestamp: new Date().toISOString(),
  });
};

export const POST = withGateway(handler, "$0.008", "/api/skills/code-auditor");
