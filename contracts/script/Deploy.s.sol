// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import "../src/SkillRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // Deploy with deployer as governor
        SkillRegistry registry = new SkillRegistry(deployer);

        // Register 5 Skill Agents
        string[] memory analyzerTags = new string[](2);
        analyzerTags[0] = "blockchain";
        analyzerTags[1] = "analysis";
        registry.registerSkill(
            "Chain Analyzer",
            "Analyzes on-chain transactions, token flows, and smart contract interactions",
            "/api/skills/chain-analyzer",
            5000, // $0.005 (6 decimals)
            analyzerTags
        );

        string[] memory socialTags = new string[](2);
        socialTags[0] = "social";
        socialTags[1] = "intelligence";
        registry.registerSkill(
            "Social Intel",
            "Monitors social media sentiment and trending topics for crypto projects",
            "/api/skills/social-intel",
            3000, // $0.003
            socialTags
        );

        string[] memory marketTags = new string[](2);
        marketTags[0] = "market";
        marketTags[1] = "data";
        registry.registerSkill(
            "Market Data",
            "Provides real-time and historical crypto market data and price feeds",
            "/api/skills/market-data",
            2000, // $0.002
            marketTags
        );

        string[] memory auditorTags = new string[](2);
        auditorTags[0] = "security";
        auditorTags[1] = "audit";
        registry.registerSkill(
            "Code Auditor",
            "Performs security analysis on smart contract code and identifies vulnerabilities",
            "/api/skills/code-auditor",
            8000, // $0.008
            auditorTags
        );

        string[] memory summarizerTags = new string[](2);
        summarizerTags[0] = "text";
        summarizerTags[1] = "summary";
        registry.registerSkill(
            "Summarizer",
            "Condenses long documents, threads, and reports into concise summaries",
            "/api/skills/summarizer",
            1000, // $0.001
            summarizerTags
        );

        vm.stopBroadcast();

        // Log results
        console.log("SkillRegistry deployed at:", address(registry));
        console.log("Governor:", deployer);
        console.log("Skills registered: 5");
    }
}
