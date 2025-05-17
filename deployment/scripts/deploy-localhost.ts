import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
	ContractFactory, ContractTransactionResponse,
	Interface, LogDescription
} from "ethers";
import { ethers } from "hardhat";
import { Dealer, Tokenizer, Treasury, VRFConsumer, VRFCoordinatorV2_5Mock } from "../typechain-types";
import { estimateGasCosts } from "./estimateGas";

async function main (): Promise<void> {
	try {
		const [deployer, owner2, owner3]: SignerWithAddress[] = await ethers.getSigners();
		const deployerAddress: string = await deployer.getAddress();
		const owner2Address: string = await owner2.getAddress();
		const owner3Address: string = await owner3.getAddress();

		console.log("Deploying contract with the account:", deployerAddress);

		// Deploy VRFCoordinatorV2_5Mock
		const VRFCoordinatorV2_5MockFactory: ContractFactory = await ethers.getContractFactory("VRFCoordinatorV2_5Mock");
		const mockVRFCoordinator: VRFCoordinatorV2_5Mock = (await VRFCoordinatorV2_5MockFactory.deploy(
			100000, 1e9, 6110300000000000
		)) as VRFCoordinatorV2_5Mock;
		await mockVRFCoordinator.waitForDeployment();

		const vrfCoordinatorAddress: string = await mockVRFCoordinator.getAddress();
		console.log("Mock VRFCoordinator deployed at:", vrfCoordinatorAddress);

		// Create a VRF subscription
		const tx: ContractTransactionResponse = await mockVRFCoordinator.createSubscription();
		const receipt = await tx.wait();

		// const receipt: TransactionReceipt | null = await ethers.provider.getTransactionReceipt(tx.hash);

		if (!receipt?.logs || receipt.logs.length === 0) {
			throw new Error("No logs found when creating subscription.");
		}

		// Parse the first log to get the subscription ID
		const vrfCoordinatorInterface: Interface = VRFCoordinatorV2_5MockFactory.interface;

		const parsedLog: LogDescription | null = vrfCoordinatorInterface.parseLog({
			topics: receipt.logs[0].topics as string[],
			data: receipt.logs[0].data
		});

		if (!parsedLog || !parsedLog.args) {
			throw new Error("Could not parse log to extract subscription ID.");
		}
		const subscriptionId: bigint = parsedLog.args?.[0];
		if (subscriptionId === undefined) {
			throw new Error("Could not extract subscription ID from logs.");
		}

		// Fund the VRF subscription
		await mockVRFCoordinator.fundSubscription(subscriptionId, ethers.parseEther("7"));
		console.log("Subscription created and funded. ID:", subscriptionId.toString());

		// Deploy VRFConsumer contract
		const keyHash: string = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";
		const VRFConsumerFactory: ContractFactory = await ethers.getContractFactory('VRFConsumer');
		const vrfConsumer: VRFConsumer = (await VRFConsumerFactory.deploy(
			vrfCoordinatorAddress,
			subscriptionId, 
			keyHash
		)) as VRFConsumer;
		await vrfConsumer.waitForDeployment();

		const vrfConsumerAddress: string = await vrfConsumer.getAddress();
		console.log('vrfConsumer deployed at:', vrfConsumerAddress);
		console.log('vrfConsumer\'s coordinator address:', await vrfConsumer.s_vrfCoordinator());

		// Deploy Tokenizer contract
		const initialSupply: bigint = ethers.parseEther("1000000");
		const TokenizerFactory: ContractFactory = await ethers.getContractFactory('Tokenizer');
		const tokenizer: Tokenizer = (await TokenizerFactory.deploy(
			initialSupply
		)) as Tokenizer;
		await tokenizer.waitForDeployment();

		const tokenizerAddress: string = await tokenizer.getAddress();
		console.log('Tokenizer deployed at:', tokenizerAddress);

		// Deploy Treasury contract
		const TreasuryFactory: ContractFactory = await ethers.getContractFactory('Treasury');
		const owners: string[] = [deployerAddress, owner2Address, owner3Address];
		const requiredSignatures: number = 2;
		const treasury: Treasury = (await TreasuryFactory.deploy(
			vrfConsumerAddress,
			tokenizerAddress,
			owners,
			requiredSignatures
		)) as Treasury;
		await treasury.waitForDeployment();

		const treasuryAddress: string = await treasury.getAddress();
		console.log('Treasury deployed at:', treasuryAddress);

		// Grant MINTER_ROLE and BURNER_ROLE to Treasury
		const DEFAULT_ADMIN_ROLE: string = "0x0000000000000000000000000000000000000000000000000000000000000000";
		const MINTER_ROLE: string = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
		const BURNER_ROLE: string = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));

		await tokenizer.grantRole(MINTER_ROLE, treasuryAddress);
		console.log("Granted MINTER_ROLE to Treasury");

		await tokenizer.grantRole(BURNER_ROLE, treasuryAddress);
		console.log("Granted BURNER_ROLE to Treasury");

		// await tokenizer.revokeRole(DEFAULT_ADMIN_ROLE, deployerAddress);
		// console.log("Revoked DEFAULT_ADMIN_ROLE to Tokenizer Deployer");

		// Add consumer to VRF
		await mockVRFCoordinator.addConsumer(subscriptionId, vrfConsumerAddress);
		console.log("Added Tokenizer\'s vrfConsumer as a VRF consumer.");

		// Deploy Dealer contract
		const DealerFactory: ContractFactory = await ethers.getContractFactory('Dealer');
		const dealer: Dealer = (await DealerFactory.deploy(
			vrfConsumerAddress,
			tokenizerAddress,
			treasuryAddress,
			ethers.parseEther("500"),
			ethers.parseEther("500000"),
			250
		)) as Dealer;
		await dealer.waitForDeployment();

		const dealerAddress: string = await dealer.getAddress();
		console.log('Dealer deployed at:', dealerAddress);

		await tokenizer.grantRole(MINTER_ROLE, deployerAddress);
		const dealerSupply: bigint = ethers.parseEther("50000");
		await tokenizer.mint(dealerAddress, dealerSupply);
		console.log(dealerSupply, ' tokens minted to Dealer');
		await tokenizer.revokeRole(MINTER_ROLE, deployerAddress);

		// Call the gas estimation function
		await estimateGasCosts(
			VRFCoordinatorV2_5MockFactory,
			VRFConsumerFactory,
			TokenizerFactory,
			TreasuryFactory,
			DealerFactory,
			vrfCoordinatorAddress,
			tokenizerAddress,
			treasuryAddress,
			subscriptionId,
			keyHash,
			initialSupply,
			owners,
			requiredSignatures,
			deployer
		);

		console.log("Deployment completed successfully.");

	} catch(error) {
		console.error("Deployment failed:", error);
		throw error;
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
