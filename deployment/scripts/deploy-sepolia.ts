import { ContractFactory } from "ethers";
import { ethers } from "hardhat";
import { Tokenizer, Treasury, VRFConsumer, Dealer } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

async function main(): Promise<void> {
	try {
		const { VRF_COORDINATOR_ADDRESS, VRF_KEY_HASH, VRF_SUBSCRIPTION_ID } = process.env;

		if (!VRF_COORDINATOR_ADDRESS || !VRF_KEY_HASH || !VRF_SUBSCRIPTION_ID) {
			throw new Error(
				"Missing required environment variables: VRF_COORDINATOR_ADDRESS, VRF_KEY_HASH, or VRF_SUBSCRIPTION_ID."
			);
		}

		const subscriptionId: bigint = BigInt(VRF_SUBSCRIPTION_ID);

		// Get accounts
		const [deployer, owner2, owner3]: SignerWithAddress[] = await ethers.getSigners();
		const deployerAddress: string = await deployer.getAddress();
		const owner2Address: string = await owner2.getAddress();
		const owner3Address: string = await owner3.getAddress();

		console.log("Deploying contract with the account:", deployerAddress);

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
		const MINTER_ROLE: string = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
		const BURNER_ROLE: string = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));

		await tokenizer.grantRole(MINTER_ROLE, treasuryAddress);
		console.log("Granted MINTER_ROLE to Treasury");

		await tokenizer.grantRole(BURNER_ROLE, treasuryAddress);
		console.log("Granted BURNER_ROLE to Treasury");

		// Add VRF as a consumer
		const VRFCoordinator = await ethers.getContractAt("VRFCoordinatorV2_5", VRF_COORDINATOR_ADDRESS);
		await VRFCoordinator.addConsumer(subscriptionId, vrfConsumerAddress);
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