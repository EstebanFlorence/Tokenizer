import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract, ContractFactory, TransactionReceipt } from "ethers";
import { ethers } from "hardhat";

interface VRFCoordinatorV2_5Mock extends Contract {}
interface VRFConsumer extends Contract {}
interface Tokenizer extends Contract {}
interface BiscaTreasury extends Contract {}

async function main (): Promise<void> {
	try {
		const [deployer, owner2, owner3]: SignerWithAddress[] = await ethers.getSigners();
		const deployerAddress: string = await deployer.getAddress();
		const owner2Address: string = await owner2.getAddress();
		const owner3Address: string = await owner3.getAddress();

		console.log("Deploying contract with the account:", deployerAddress);

		// Deploy VRFCoordinatorV2_5Mock
		const VRFCoordinatorV2_5MockFactory: ContractFactory = await ethers.getContractFactory("VRFCoordinatorV2_5Mock");
		const mockVRFCoordinator = (await VRFCoordinatorV2_5MockFactory.deploy(
			100000, 1e9, 6110300000000000
		)) as VRFCoordinatorV2_5Mock;
		await mockVRFCoordinator.waitForDeployment();

		const vrfCoordinatorAddress: string = await mockVRFCoordinator.getAddress();
		console.log("Mock VRFCoordinator deployed at:", vrfCoordinatorAddress);

		// Create a VRF subscription
		const tx = await mockVRFCoordinator.createSubscription();
		const receipt = await tx.wait() as TransactionReceipt;

		if (!receipt.logs || receipt.logs.length === 0) {
			throw new Error("No logs found when creating subscription.");
		}

		// Parse the first log to get the subscription ID
		const vrfCoordinatorInterface = VRFCoordinatorV2_5MockFactory.interface;

		const parsedLog = vrfCoordinatorInterface.parseLog({
			topics: receipt.logs[0].topics as string[],
			data: receipt.logs[0].data
		});

		if (!parsedLog || !parsedLog.args) {
			throw new Error("Could not parse log to extract subscription ID.");
		}

		const subscriptionId = parsedLog.args?.[0];
		if (subscriptionId === undefined) {
			throw new Error("Could not extract subscription ID from logs.");
		}

		// Fund the VRF subscription
		await mockVRFCoordinator.fundSubscription(subscriptionId, ethers.parseEther("7"));
		console.log("Subscription created and funded. ID:", subscriptionId.toString());

		// Deploy VRFConsumer contract
		const keyHash: string = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";
		const VRFConsumerFactory: ContractFactory = await ethers.getContractFactory('VRFConsumer');
		const vrfConsumer = (await VRFConsumerFactory.deploy(
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
		const tokenizer = (await TokenizerFactory.deploy(
			initialSupply,
			vrfConsumerAddress
		)) as Tokenizer;
		await tokenizer.waitForDeployment();

		const tokenizerAddress: string = await tokenizer.getAddress();
		console.log('Tokenizer deployed at:', tokenizerAddress);

		// Deploy BiscaTreasury contract
		const BiscaTreasuryFactory: ContractFactory = await ethers.getContractFactory('BiscaTreasury');
		const owners: string[] = [deployerAddress, owner2Address, owner3Address];
		const requiredSignatures: number = 2;
		const biscaTreasury = (await BiscaTreasuryFactory.deploy(
			vrfConsumerAddress,
			tokenizerAddress,
			owners,
			requiredSignatures
		)) as BiscaTreasury;
		await biscaTreasury.waitForDeployment();

		const biscaTreasuryAddress: string = await biscaTreasury.getAddress();
		console.log('BiscaTreasury deployed at:', biscaTreasuryAddress);

		// Grant MINTER_ROLE and BURNER_ROLE to BiscaTreasury
		const MINTER_ROLE: string = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
		const BURNER_ROLE: string = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));

		await tokenizer.grantRole(MINTER_ROLE, biscaTreasuryAddress);
		console.log("Granted MINTER_ROLE to BiscaTreasury");

		await tokenizer.grantRole(BURNER_ROLE, biscaTreasuryAddress);
		console.log("Granted BURNER_ROLE to BiscaTreasury");

		// Add consumer to VRF
		await mockVRFCoordinator.addConsumer(subscriptionId, vrfConsumerAddress);
		console.log("Added Tokenizer\'s vrfConsumer as a VRF consumer.");

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
