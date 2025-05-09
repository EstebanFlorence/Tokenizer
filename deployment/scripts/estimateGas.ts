import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ContractFactory } from "ethers";
import { ethers } from "hardhat";

export async function estimateGasCosts(
	VRFCoordinatorV2_5MockFactory: ContractFactory,
	VRFConsumerFactory: ContractFactory,
	TokenizerFactory: ContractFactory,
	TreasuryFactory: ContractFactory,
	DealerFactory: ContractFactory,
	vrfCoordinatorAddress: string,
	tokenizerAddress: string,
	treasuryAddress: string,
	subscriptionId: bigint,
	keyHash: string,
	initialSupply: bigint,
	owners: string[],
	requiredSignatures: number,
	deployer: SignerWithAddress
): Promise<void> {
	const feeData = await ethers.provider.getFeeData();
	if (!feeData.gasPrice) {
		throw new Error("Gas price is null or undefined.");
	}
	const gasPrice: bigint = feeData.gasPrice;
	console.log("Current gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");

	// Estimate gas for VRFCoordinatorV2_5Mock deployment
	const mockVRFCoordinatorGas = await deployer.estimateGas(
		await VRFCoordinatorV2_5MockFactory.getDeployTransaction(100000, 1e9, 6110300000000000)
	);
	console.log("Estimated gas for VRFCoordinatorV2_5Mock deployment:", mockVRFCoordinatorGas.toString());

	// Estimate gas for VRFConsumer deployment
	const vrfConsumerGas = await deployer.estimateGas(
		await VRFConsumerFactory.getDeployTransaction(vrfCoordinatorAddress, subscriptionId, keyHash)
	);
	console.log("Estimated gas for VRFConsumer deployment:", vrfConsumerGas.toString());

	// Estimate gas for Tokenizer deployment
	const tokenizerGas = await deployer.estimateGas(
		await TokenizerFactory.getDeployTransaction(initialSupply, vrfCoordinatorAddress)
	);
	console.log("Estimated gas for Tokenizer deployment:", tokenizerGas.toString());

	// Estimate gas for Treasury deployment
	const treasuryGas = await deployer.estimateGas(
		await TreasuryFactory.getDeployTransaction(vrfCoordinatorAddress, tokenizerAddress, owners, requiredSignatures)
	);
	console.log("Estimated gas for Treasury deployment:", treasuryGas.toString());

	// Estimate gas for Dealer deployment
	const dealerGas = await deployer.estimateGas(
		await DealerFactory.getDeployTransaction(vrfCoordinatorAddress, tokenizerAddress, treasuryAddress, ethers.parseEther("500"), ethers.parseEther("500000"), 250)
	);
	console.log("Estimated gas for Dealer deployment:", dealerGas.toString());

	// Calculate total gas cost
	const totalGas = mockVRFCoordinatorGas + vrfConsumerGas + tokenizerGas + treasuryGas;
	console.log("Total estimated gas:", totalGas);
	const estimatedCost = totalGas * gasPrice;
	console.log("Total estimated gas cost:", ethers.formatEther(estimatedCost), "ETH");
}
