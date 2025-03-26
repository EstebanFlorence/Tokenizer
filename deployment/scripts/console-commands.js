/*
    npx hardhat console --network sepolia / localhost
*/

// Hardhat node
await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
await ethers.provider.send("evm_mine");

// Get signers
[deployer, owner, user1, user2] = await ethers.getSigners();
owner.address;

// Get a Deployed Contract Instance
tokenizerAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
tokenizer = await ethers.getContractAt("Tokenizer", tokenizerAddress);

// Balance
balance = await ethers.provider.getBalance(deployer.address);
ethers.formatEther(balance);
ethers.formatEther(await ethers.provider.getBalance(user1.address));

// Check if deployer has the DEFAULT_ADMIN_ROLE
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
await tokenizer.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);

// Check other roles
MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
await tokenizer.hasRole(MINTER_ROLE, owner.address);

// Check the total supply of tokens
ethers.formatEther(await tokenizer.totalSupply());

// Mint tokens (requires MINTER_ROLE)
await tokenizer.mint(user1.address, ethers.parseEther("100"));

// Burn tokens (requires BURNER_ROLE)
await tokenizer.burn(user1.address, ethers.parseEther("50"));

// Pause the contract (requires PAUSER_ROLE)
await tokenizer.pause();

// Unpause the contract (requires PAUSER_ROLE)
await tokenizer.unpause();

// Trigger a random event
requestId = await tokenizer.triggerRandomEvent();
console.log(`Random event triggered with request ID: ${requestId}`);
