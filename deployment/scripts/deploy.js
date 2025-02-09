const { ethers } = require("hardhat");

async function main ()
{
	const [deployer] = await ethers.getSigners();
	console.log("Deploying contract with the account:", deployer.address);

	// Deploy VRFCoordinatorV2Mock (for testing)
	const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
	const mockVRFCoordinator = await VRFCoordinatorV2Mock.deploy(100000, 1e9);

	await mockVRFCoordinator.waitForDeployment();
	console.log("Mock VRFCoordinator deployed at:", await mockVRFCoordinator.getAddress());

	// Create and fund a VRF subscription
	const tx = await mockVRFCoordinator.createSubscription();
	const receipt = await tx.wait();
	const subscriptionId = receipt.logs[0].args[0];

	await mockVRFCoordinator.fundSubscription(subscriptionId, ethers.parseEther("7"));
	console.log("Subscription created and funded. ID:", subscriptionId);

	// Deploy VRFConsumer contract
	const keyHash = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";
	const VRFConsumer = await ethers.getContractFactory('VRFConsumer');
	const vrfConsumer = await VRFConsumer.deploy(
		await mockVRFCoordinator.getAddress(),
		subscriptionId, 
		keyHash
	);

	await vrfConsumer.waitForDeployment();
	console.log('vrfConsumer deployed at:', await vrfConsumer.getAddress());
	console.log('vrfConsumer\'s coordinator address:', await vrfConsumer.coordinator());

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
	await mockVRFCoordinator.addConsumer(subscriptionId, await vrfConsumer.getAddress());
	console.log(await vrfConsumer.getAddress());
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
