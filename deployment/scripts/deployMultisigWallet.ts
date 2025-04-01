import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseContract, ContractFactory } from "ethers";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main(): Promise<void> {
	try {
		const [owner1, owner2, owner3]: SignerWithAddress[] = await ethers.getSigners();

		const owners: string[] = [
			await owner1.getAddress(),
			await owner2.getAddress(),
			await owner3.getAddress()
		];
		const requiredSignatures: number = 2;

		const MultisigWallet: ContractFactory = await ethers.getContractFactory("MultisigWallet");
		const multisigWallet: BaseContract = await MultisigWallet.deploy(owners, requiredSignatures);

		await multisigWallet.waitForDeployment();

		const multisigWalletAddress: string = await multisigWallet.getAddress();
		console.log("MultisigWallet deployed at:", multisigWalletAddress);

		// Write the deployed address to an .env file
		// const envPath = path.resolve(__dirname, "../.tmpEnv");
		// fs.writeFileSync(envPath, `MULTISIG_WALLET_ADDRESS=${multisigWalletAddress}\n`);

		console.log("Deployment completed successfully.");

	} catch(error) {
		console.error("Deployment failed:", error);
		throw error;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});