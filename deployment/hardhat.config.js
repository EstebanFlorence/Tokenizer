require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
// require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

const { API_URL, PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
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
			url: "https://eth-sepolia.g.alchemy.com/v2/" + API_URL,
			accounts: [`0x${PRIVATE_KEY}`]
		}
	},

};
