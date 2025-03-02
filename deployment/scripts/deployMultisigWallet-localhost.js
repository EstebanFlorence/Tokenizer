const { ethers } = require("hardhat");

async function main() {
	[owner1, owner2, owner3, nonOwner] = await ethers.getSigners();
	// console.log("Deploying contract with the account:", deployer.address);

	// Define the owners and required signatures
	const owners = [
		owner1.address,
		owner2.address,
		owner3.address
	];
	const requiredSignatures = 2;

	// Deploy MultisigWallet contract
	const MultisigWallet = await ethers.getContractFactory("MultisigWallet");
	const multisigWallet = await MultisigWallet.deploy(owners, requiredSignatures);

	console.log("MultisigWallet deployed at:", await multisigWallet.getAddress());
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});