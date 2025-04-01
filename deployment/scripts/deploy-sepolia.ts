import { Signer } from "ethers";
import { ethers } from "hardhat";

async function main(): Promise<void> {
	try {
		// Load environment variables
		const { VRF_COORDINATOR_ADDRESS, VRF_KEY_HASH, SUBSCRIPTION_ID } = process.env;

		if (!VRF_COORDINATOR_ADDRESS || !VRF_KEY_HASH || !SUBSCRIPTION_ID) {
			throw new Error("Missing required environment variables: VRF_COORDINATOR_ADDRESS, VRF_KEY_HASH, or SUBSCRIPTION_ID.");
		}

		const subscriptionId: bigint = BigInt(SUBSCRIPTION_ID);

		// Get deployer account
		const [deployer]: Signer[] = await ethers.getSigners();
		const deployerAddress: string = await deployer.getAddress();
		console.log("Deploying contract with the account:", deployerAddress);

		// Deploy VRFConsumer contract
		const VRFConsumer = await ethers.getContractFactory('VRFConsumer');
		const vrfConsumer = await VRFConsumer.deploy(
			VRF_COORDINATOR_ADDRESS,
			subscriptionId, 
			VRF_KEY_HASH
		);
		await vrfConsumer.waitForDeployment();

		const vrfConsumerAddress: string = await vrfConsumer.getAddress();
		console.log('vrfConsumer deployed at:', vrfConsumerAddress);
		console.log('vrfConsumer\'s coordinator address:', await vrfConsumer.s_vrfCoordinator());

		// Deploy Tokenizer contract
		const initialSupply = ethers.parseEther("1000000");
		const Tokenizer = await ethers.getContractFactory('Tokenizer');
		const tokenizer = await Tokenizer.deploy(
			initialSupply,
			vrfConsumerAddress
		);
		await tokenizer.waitForDeployment();

		const tokenizerAddress: string = await tokenizer.getAddress();
		console.log('Tokenizer deployed at:', tokenizerAddress);

		// Deploy BiscaTreasury contract
/* 		const BiscaTreasuryFactory = await ethers.getContractFactory('BiscaTreasury');
		const owners: string[] = [deployerAddress, owner2Address, owner3Address];
		const requiredSignatures: number = 2;
		const biscaTreasury = await BiscaTreasuryFactory.deploy(
			vrfConsumerAddress,
			tokenizerAddress,
			owners,
			requiredSignatures
		); */

		// Grant MINTER_ROLE and BURNER_ROLE to BiscaTreasury
/* 		const MINTER_ROLE: string = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
		const BURNER_ROLE: string = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));

		await tokenizer.grantRole(MINTER_ROLE, biscaTreasuryAddress);
		console.log("Granted MINTER_ROLE to BiscaTreasury");

		await tokenizer.grantRole(BURNER_ROLE, biscaTreasuryAddress);
		console.log("Granted BURNER_ROLE to BiscaTreasury"); */

		// Add Tokenizer as a VRF consumer
		const VRFCoordinator = await ethers.getContractAt("VRFCoordinatorV2_5", VRF_COORDINATOR_ADDRESS);
		await VRFCoordinator.addConsumer(subscriptionId, vrfConsumerAddress);
		console.log("Added Tokenizer\'s vrfConsumer as a VRF consumer.");

	} catch (error) {
		console.error("Deployment failed:", error);
		throw error;
	}
}

main()
	.then(() => process.exit(0))
	.catch (
		error => {
			console.error(error);
			process.exit(1);
		}
	);