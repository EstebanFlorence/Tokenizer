import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-gas-reporter";
// import "@nomiclabs/hardhat-etherscan";
import * as dotenv from "dotenv";

dotenv.config();

const { ALCHEMY_API_KEY, SEPOLIA_PRIVATE_KEY1, SEPOLIA_PRIVATE_KEY2, SEPOLIA_PRIVATE_KEY3, ETHERSCAN_API_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
const config: HardhatUserConfig = {
	solidity : {
		compilers: [
			{
				version: "0.8.19",
				settings: {
					optimizer: {
						enabled: true,
						runs:200
					}
				}
			},
			{
				version: "0.8.20",
				settings: {
					optimizer: {
						enabled: true,
						runs:200
					}
				}
			},
			{
				version: "0.8.6",
				settings: {
					optimizer: {
						enabled: true,
						runs:200
					}
				}
			}
		]
	},
	// defaultNetwork: "sepolia",
	networks: {
		hardhat: {
		  chainId: 31337,  // Default Hardhat chain ID
		},
		localhost: {
			url: "http://127.0.0.1:8545",
			chainId: 31337,
		},
		sepolia: {
			url: "https://eth-sepolia.g.alchemy.com/v2/" + ALCHEMY_API_KEY,
			accounts: [
				`0x${SEPOLIA_PRIVATE_KEY1}`,
				`0x${SEPOLIA_PRIVATE_KEY2}`,
				`0x${SEPOLIA_PRIVATE_KEY3}`
			]
		}
	},
	etherscan: {
		apiKey: {
		  sepolia: ETHERSCAN_API_KEY || "",
		},
	  },
	gasReporter: {
		enabled: true,
		currency: "USD",
		// coinmarketcap: "YOUR_COINMARKETCAP_API_KEY", // Optional for real-time gas price
	}
};

export default config;
