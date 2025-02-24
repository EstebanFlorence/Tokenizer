const { ethers } = require("hardhat");

const { VRF_COORDINATOR_ADDRESS, VRF_KEY_HASH, SUBSCRIPTION_ID } = process.env;

const subscriptionId = BigInt(SUBSCRIPTION_ID);

async function main ()
{
	const [deployer] = await ethers.getSigners();
	console.log("Deploying contract with the account:", deployer.address);

	// Deploy VRFConsumer contract
	const VRFConsumer = await ethers.getContractFactory('VRFConsumer');
	const vrfConsumer = await VRFConsumer.deploy(
		VRF_COORDINATOR_ADDRESS,
		subscriptionId, 
		VRF_KEY_HASH
	);

	await vrfConsumer.waitForDeployment();
	console.log('vrfConsumer deployed at:', await vrfConsumer.getAddress());
	console.log('vrfConsumer\'s coordinator address:', await vrfConsumer.s_vrfCoordinator());

	// Deploy Tokenizer contract
	const initialSupply = ethers.parseEther("1000000"); // 1 million tokens
	const Tokenizer = await ethers.getContractFactory('Tokenizer');
	const tokenizer = await Tokenizer.deploy(
		initialSupply,
		await vrfConsumer.getAddress()
	);

	await tokenizer.waitForDeployment();
	console.log('Tokenizer deployed at:', await tokenizer.getAddress());

	// Add Tokenizer as a VRF consumer
	const VRFCoordinator = await ethers.getContractAt("VRFCoordinatorV2Interface", VRF_COORDINATOR_ADDRESS);
	await VRFCoordinator.addConsumer(subscriptionId, await vrfConsumer.getAddress());
	console.log("Added Tokenizer\'s vrfConsumer as a VRF consumer.");
}

main()
	.then(() => process.exit(0))
	.catch
	(
		error => 
		{
			console.error(error);
			process.exit(1);
		}
	);