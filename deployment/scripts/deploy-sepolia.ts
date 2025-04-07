import { ContractFactory } from "ethers";
import { ethers } from "hardhat";
import { Tokenizer, Treasury, VRFConsumer } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

async function main(): Promise<void> {
	try {
		const { VRF_COORDINATOR_ADDRESS, VRF_KEY_HASH, SUBSCRIPTION_ID } = process.env;

		if (!VRF_COORDINATOR_ADDRESS || !VRF_KEY_HASH || !SUBSCRIPTION_ID) {
			throw new Error(
				"Missing required environment variables: VRF_COORDINATOR_ADDRESS, VRF_KEY_HASH, or SUBSCRIPTION_ID."
			);
		}

		const subscriptionId: bigint = BigInt(SUBSCRIPTION_ID);

		// Get accounts
		const [deployer, owner2, owner3]: SignerWithAddress[] = await ethers.getSigners();
		console.log("Deploying contract with the account:", deployer.address);

		// Deploy VRFConsumer contract
		const VRFConsumerFactory: ContractFactory = await ethers.getContractFactory('VRFConsumer');
		const vrfConsumer: VRFConsumer = (await VRFConsumerFactory.deploy(
			VRF_COORDINATOR_ADDRESS,
			subscriptionId, 
			VRF_KEY_HASH
		)) as VRFConsumer;
		await vrfConsumer.waitForDeployment();

		const vrfConsumerAddress: string = await vrfConsumer.getAddress();
		console.log('vrfConsumer deployed at:', vrfConsumerAddress);
		console.log('vrfConsumer\'s coordinator address:', await vrfConsumer.s_vrfCoordinator());

		// Deploy Tokenizer contract
		const initialSupply: bigint = ethers.parseEther("1000000");
		const TokenizerFactory: ContractFactory = await ethers.getContractFactory('Tokenizer');
		const tokenizer: Tokenizer = (await TokenizerFactory.deploy(
			initialSupply,
			vrfConsumerAddress
		)) as Tokenizer;
		await tokenizer.waitForDeployment();

		const tokenizerAddress: string = await tokenizer.getAddress();
		console.log('Tokenizer deployed at:', tokenizerAddress);

		// Deploy Treasury contract
		const TreasuryFactory: ContractFactory = await ethers.getContractFactory('Treasury');
		const owners: string[] = [deployer.address, owner2.address, owner3.address];
		const requiredSignatures: number = 2;
		const treasury: Treasury = (await TreasuryFactory.deploy(
			vrfConsumerAddress,
			tokenizerAddress,
			owners,
			requiredSignatures
		)) as Treasury;
		await treasury.waitForDeployment();

		// Grant MINTER_ROLE and BURNER_ROLE to Treasury
		const treasuryAddress: string = await treasury.getAddress();
		console.log('Treasury deployed at:', treasuryAddress);

		const MINTER_ROLE: string = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
		const BURNER_ROLE: string = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));

		await tokenizer.grantRole(MINTER_ROLE, treasuryAddress);
		console.log("Granted MINTER_ROLE to Treasury");

		await tokenizer.grantRole(BURNER_ROLE, treasuryAddress);
		console.log("Granted BURNER_ROLE to Treasury");

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