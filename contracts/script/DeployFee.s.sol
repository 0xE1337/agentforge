// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import "../src/MarketplaceFee.sol";

contract DeployFeeScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // Deploy with 5% platform fee (500 bps)
        MarketplaceFee fee = new MarketplaceFee(deployer, 500);

        vm.stopBroadcast();

        console.log("MarketplaceFee deployed at:", address(fee));
        console.log("Platform fee: 5% (500 bps)");
    }
}
