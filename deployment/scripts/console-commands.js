/* npx hardhat console --network sepolia */

// Balance
const [deployer] = await ethers.getSigners();
const balance = await ethers.provider.getBalance(deployer.address);
console.log(`Balance: ${ethers.formatEther(balance)} ETH`);


