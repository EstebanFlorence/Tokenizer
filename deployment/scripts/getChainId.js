const { ethers } = require("hardhat");

async function main() {
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    console.log("Chain ID:", network.chainId);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
