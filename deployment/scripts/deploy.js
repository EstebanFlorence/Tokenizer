const { ethers } = require("hardhat");

async function main ()
{
	const [deployer] = await ethers.getSigners();

	console.log("Deploying contract with the account:", deployer.address);

	const initialSupply = ethers.parseUnits('1000', 18);
	const Tokenizer = await ethers.getContractFactory('Tokenizer');
	const tokenizer = await Tokenizer.deploy(initialSupply);

	// await tokenizer.waitForDeployment();
	console.log('Tokenizer deployed to:', await tokenizer.getAddress());
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
