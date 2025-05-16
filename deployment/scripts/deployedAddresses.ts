	import * as fs from 'fs';
	import * as path from 'path';

	// Function to save deployed addresses
	export const saveDeployedAddresses = (
	network: string,
	vrfConsumer: string,
	tokenizer: string,
	treasury: string,
	dealer: string
	) => {
	const deployData = {
		network,
		contracts: {
		vrfConsumer,
		tokenizer,
		treasury,
		dealer
		},
		timestamp: new Date().toISOString()
	};

	const deploymentsDir = path.join(__dirname, '../deployment');
	if (!fs.existsSync(deploymentsDir)) {
		fs.mkdirSync(deploymentsDir);
	}

	const filePath = path.join(deploymentsDir, `${network}-addresses.json`);
	fs.writeFileSync(filePath, JSON.stringify(deployData, null, 2));
	
	console.log(`Deployment addresses saved to ${filePath}`);
	};

	// Function to read deployed addresses
	export const getDeployedAddresses = (network: string) => {
	const filePath = path.join(__dirname, `../deployment/${network}-addresses.json`);
	
	if (!fs.existsSync(filePath)) {
		throw new Error(`No deployment found for network: ${network}`);
	}
	
	const fileData = fs.readFileSync(filePath, 'utf8');
	return JSON.parse(fileData);
	};