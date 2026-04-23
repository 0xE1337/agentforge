// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import "../src/PaymentGuard.sol";

contract DeployGuardScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // Deploy with deployer as governor
        PaymentGuard guard = new PaymentGuard(deployer);

        // Create a default policy for the deployer (who is also the buyer agent)
        // 100,000 = $0.10 USDC per epoch, 1 hour epochs
        // This means the agent can spend max $0.10 per hour autonomously
        guard.createPolicy(
            deployer,
            100_000, // $0.10 max per epoch (6 decimals)
            3600     // 1 hour epoch
        );

        // Allow all 5 registered skills
        for (uint256 i = 1; i <= 5; i++) {
            guard.allowSkill(deployer, i);
        }

        vm.stopBroadcast();

        console.log("PaymentGuard deployed at:", address(guard));
        console.log("Policy: $0.10/hour cap, 5 skills allowed");
    }
}
