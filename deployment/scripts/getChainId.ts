import { Network } from "ethers";
import { ethers } from "hardhat";

async function main(): Promise<void> {
	const provider = ethers.provider;
	const network: Network = await provider.getNetwork();
	console.log("Chain ID:", network.chainId);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
