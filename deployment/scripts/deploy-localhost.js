const { ethers } = require("hardhat");

async function main () {

	const [deployer, owner2, owner3] = await ethers.getSigners();
	console.log("Deploying contract with the account:", deployer.address);

	// Deploy VRFCoordinatorV2_5Mock
	const VRFCoordinatorV2_5Mock = await ethers.getContractFactory("VRFCoordinatorV2_5Mock");
	const mockVRFCoordinator = await VRFCoordinatorV2_5Mock.deploy(100000, 1e9, 6110300000000000);

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
	console.log('vrfConsumer\'s coordinator address:', await vrfConsumer.s_vrfCoordinator());

	// Deploy Tokenizer contract
	const initialSupply = ethers.parseEther("1000000");
	const Tokenizer = await ethers.getContractFactory('Tokenizer');
	const tokenizer = await Tokenizer.deploy(
		initialSupply,
		await vrfConsumer.getAddress()
	);

	await tokenizer.waitForDeployment();
	console.log('Tokenizer deployed at:', await tokenizer.getAddress());

	// Deploy BiscaTreasury contract
	const BiscaTreasury = await ethers.getContractFactory('BiscaTreasury');
	const owners = [deployer.address, owner2.address, owner3.address];
	const requiredSignatures = 2;
	const biscaTreasury = await BiscaTreasury.deploy(
		await vrfConsumer.getAddress(),
		await tokenizer.getAddress(),
		owners,
		requiredSignatures
	);

	await biscaTreasury.waitForDeployment();
	console.log('BiscaTreasury deployed at:', await biscaTreasury.getAddress());

    // Grant MINTER_ROLE and BURNER_ROLE to BiscaTreasury
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));

    await tokenizer.grantRole(MINTER_ROLE, await biscaTreasury.getAddress());
    console.log("Granted MINTER_ROLE to BiscaTreasury");

    await tokenizer.grantRole(BURNER_ROLE, await biscaTreasury.getAddress());
    console.log("Granted BURNER_ROLE to BiscaTreasury");

	// Add consumer to VRF
	await mockVRFCoordinator.addConsumer(subscriptionId, await vrfConsumer.getAddress());
	console.log("Added Tokenizer\'s vrfConsumer as a VRF consumer.");

}

main()
	.then(() => process.exit(0))
	.catch (
		error => {
			console.error(error);
			process.exit(1);
		}
	);
