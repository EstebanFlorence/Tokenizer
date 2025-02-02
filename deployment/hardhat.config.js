require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	solidity : {
		compilers: [
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
	// networks: {
	// 	hardhat: {
	// 	  chainId: 31337,  // Default Hardhat chain ID
	// 	},
	// 	localhost: {
	// 	  url: "http://127.0.0.1:8545",
	// 	  chainId: 31337,  // Same chain ID for local node
	// 	}
	//   }
};
